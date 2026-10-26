import { createCipheriv, createDecipheriv, randomBytes, randomInt, randomUUID, createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { openDatabase } from './database.js'
import { calculateLoveLevel, getMilestoneMessage } from './love-level.js'
import { createMediaStorage, parseImageDataUrlToBuffer, MEDIA_CATEGORIES } from './cloudinary-storage.js'
import { createMediaService, mediaContentPath, MAX_IMAGE_BYTES, MAX_PAYMENT_IMAGE_BYTES } from './media-service.js'

const COOKIE_NAME = 'lfy_session'
const SESSION_DAYS = 30
const COIN_PRICE_VND = 304
const BANK_CACHE_ID = 'vietqr-bank-list'
const BANK_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const BANK_CACHE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000
const BANK_VERIFICATION_TTL_MS = 5 * 60 * 1000
const DEPOSIT_PAYMENT_TTL_MS = 15 * 60 * 1000
const WITHDRAWAL_MIN_COINS = 100
const TERMS_VERSION = '1.0'
const TRANSACTION_CODE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const ENTRY_TYPES = new Set(['journal', 'memory', 'letter'])
const GIFT_CATALOG = new Map([
  ['rose-bouquet', { name: 'Bó hoa hồng', price: 50 }],
  ['love-teddy', { name: 'Gấu bông tình yêu', price: 100 }],
  ['crystal-heart', { name: 'Trái tim pha lê', price: 200 }],
  ['sweet-cake', { name: 'Bánh ngọt', price: 300 }],
  ['love-car', { name: 'Siêu xe tình yêu', price: 500 }],
  ['love-fireworks', { name: 'Pháo hoa tình yêu', price: 1000 }],
  ['heart-crown', { name: 'Vương miện', price: 2000 }],
  ['love-flight', { name: 'Chuyến bay tình yêu', price: 5000 }],
])
const DEFAULT_PINNED_QUICK_ACTIONS = ['love-letter', 'memory', 'gift', 'countdown']
const QUICK_ACTION_IDS = new Set(['love-letter', 'memory', 'gift', 'countdown', 'private-room', 'daily-question'])
const DUMMY_PASSWORD_HASH = `${'a'.repeat(32)}:${scryptSync('not-a-real-password', 'a'.repeat(32), 64).toString('hex')}`

function normalizePinnedQuickActions(value) {
  const pinned = Array.isArray(value)
    ? [...new Set(value.filter((id) => typeof id === 'string' && QUICK_ACTION_IDS.has(id)))].slice(0, 4)
    : [...DEFAULT_PINNED_QUICK_ACTIONS]
  if (pinned.length === 3) {
    const additional = DEFAULT_PINNED_QUICK_ACTIONS.find((id) => !pinned.includes(id))
    if (additional) pinned.push(additional)
  }
  return pinned
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode, expose: statusCode < 500 || statusCode === 503 })
}

export function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 6
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = storedHash.split(':')
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseImageDataUrl(value, maxBytes = MAX_PAYMENT_IMAGE_BYTES) {
  const parsed = parseImageDataUrlToBuffer(value, maxBytes)
  if (!parsed) throw httpError(400, 'Ảnh cần ở định dạng JPEG, PNG hoặc WebP hợp lệ và trong giới hạn dung lượng.')
  return { buffer: parsed.buffer, contentType: parsed.mime, format: parsed.format }
}

function isMediaId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function entryImageCategory(type) {
  if (type === 'journal') return 'entry_journal'
  if (type === 'memory') return 'entry_memory'
  if (type === 'letter') return 'entry_letter'
  return 'other'
}

function resolveStoredImageRef(item, { mediaIdField, legacyField, legacyAltField } = {}) {
  const mediaId = item?.[mediaIdField]
  if (isMediaId(mediaId)) return mediaContentPath(mediaId)
  const legacy = item?.[legacyField] ?? item?.[legacyAltField]
  if (typeof legacy === 'string' && legacy) return legacy
  return ''
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function createTransactionCode(prefix) {
  return `${prefix}${Array.from({ length: 9 }, () => TRANSACTION_CODE_ALPHABET[randomInt(TRANSACTION_CODE_ALPHABET.length)]).join('')}`
}

function vietnamDateValue(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function isAllowedOrigin(origin, clientOrigin) {
  if (origin === clientOrigin) return true
  if (process.env.NODE_ENV === 'production' || typeof origin !== 'string') return false
  try {
    const parsed = new URL(origin)
    if (parsed.protocol !== 'http:' || parsed.port !== '5173') return false
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]') return true
    const octets = parsed.hostname.split('.').map(Number)
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false
    return octets[0] === 10
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 169 && octets[1] === 254)
  } catch {
    return false
  }
}

function isUserOnline(user, now = new Date()) {
  if (!user?.lastSeenAt) return false
  return now.getTime() - new Date(user.lastSeenAt).getTime() < 60_000
}

function publicUser(user) {
  return {
    publicId: user.publicId,
    email: user.email,
    displayName: user.displayName,
    online: isUserOnline(user),
    role: user.role ?? 'member',
  }
}

async function ensureDefaultAdmin(users, logger) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!adminEmail) {
    logger.warn('Admin bootstrap is not configured; set ADMIN_EMAIL and ADMIN_PASSWORD to create an administrator.')
    return
  }
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword || !isStrongPassword(adminPassword)) {
    logger.error('Admin bootstrap requires a strong ADMIN_PASSWORD; no administrator was created or promoted.')
    return
  }
  const existing = await users.findOne({ email: adminEmail })
  if (existing) {
    if (existing.role === 'admin') return
    if (!verifyPassword(adminPassword, existing.passwordHash)) {
      logger.error('The configured admin email belongs to a non-admin account; its password must match ADMIN_PASSWORD before promotion.')
      return
    }
    await users.updateOne({ _id: existing._id }, { $set: { role: 'admin' } })
    return
  }
  const now = new Date()
  await users.insertOne({
    _id: randomUUID(),
    publicId: randomInt(0, 1_000_000).toString().padStart(6, '0'),
    email: adminEmail,
    displayName: 'System Administrator',
    dateOfBirth: '',
    gender: 'prefer_not_to_say',
    passwordHash: hashPassword(adminPassword),
    termsAcceptedAt: now,
    termsVersion: TERMS_VERSION,
    createdAt: now,
    relationshipStart: '',
    lastSeenAt: now,
    role: 'admin',
  })
}

function publicEntry(entry) {
  const image = resolveStoredImageRef(entry, { mediaIdField: 'imageMediaId', legacyField: 'image' })
  return {
    id: entry._id,
    type: entry.type,
    title: entry.title,
    date: entry.date,
    text: entry.text,
    ...(image ? { image } : {}),
    ...(entry.imageMediaId ? { imageMediaId: entry.imageMediaId } : {}),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

function validateEntry(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Dữ liệu gửi lên không hợp lệ.')
  const allowed = new Set(['type', 'title', 'date', 'text', 'image', 'imageMediaId'])
  if (Object.keys(body).some((key) => !allowed.has(key))) throw httpError(400, 'Dữ liệu gửi lên có trường không được hỗ trợ.')
  if (!partial && !ENTRY_TYPES.has(body.type)) throw httpError(400, 'Loại nội dung không hợp lệ.')
  if (partial && body.type !== undefined) throw httpError(400, 'Không thể đổi loại nội dung đã lưu.')
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 72) throw httpError(400, 'Tiêu đề cần có từ 1 đến 72 ký tự.')
  }
  if (!partial || body.date !== undefined) {
    if (!isDate(body.date)) throw httpError(400, 'Ngày không hợp lệ.')
  }
  if (!partial || body.text !== undefined) {
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) throw httpError(400, 'Nội dung cần có từ 1 đến 2.000 ký tự.')
  }
  if (body.imageMediaId !== undefined && body.imageMediaId !== null && body.imageMediaId !== '') {
    if (!isMediaId(body.imageMediaId)) throw httpError(400, 'Định danh ảnh không hợp lệ.')
  }
  if (body.image !== undefined && body.image !== null && body.image !== '') {
    if (typeof body.image !== 'string') throw httpError(400, 'Ảnh không hợp lệ.')
    if (body.image.startsWith('data:image/')) {
      if (!parseImageDataUrlToBuffer(body.image, MAX_IMAGE_BYTES)) {
        throw httpError(400, 'Ảnh cần ở định dạng JPEG, PNG hoặc WebP hợp lệ và trong giới hạn dung lượng.')
      }
    } else if (!isMediaId(body.image) && !body.image.startsWith('/api/media/')) {
      throw httpError(400, 'Ảnh cần được tải lên qua API lưu trữ.')
    }
  }
}

function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

function setSessionCookie(reply, token, secureCookies, rememberMe = true) {
  const options = {
    path: '/',
    httpOnly: true,
    secure: secureCookies,
    sameSite: secureCookies ? 'none' : 'lax',
  }
  if (rememberMe) options.maxAge = SESSION_DAYS * 24 * 60 * 60
  reply.setCookie(COOKIE_NAME, token, options)
}

function saveSession(database, userId, token, session) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000)
  return database.collection('sessions').insertOne({
    _id: randomUUID(),
    tokenHash: hashToken(token),
    userId,
    createdAt: now,
    expiresAt,
  }, session ? { session } : {}).then(() => {
    return token
  })
}

async function touchUserPresence(database, userId) {
  const now = new Date()
  await database.collection('users').updateOne({ _id: userId }, { $set: { lastSeenAt: now } })
}

function publicInvitation(invitation, account) {
  return {
    id: invitation._id,
    message: invitation.message,
    relationshipStart: invitation.relationshipStart ?? '',
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    publicId: account.publicId,
    displayName: account.displayName,
  }
}

export async function createApp({
  mongoUri = process.env.MONGODB_URI,
  databaseName = process.env.MONGODB_DB_NAME,
  clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  secureCookies = process.env.NODE_ENV === 'production',
  logger = true,
  generatePublicId = () => randomInt(0, 1_000_000).toString().padStart(6, '0'),
  fetchImpl = globalThis.fetch,
  vietqrClientId = process.env.VIETQR_CLIENT_ID,
  vietqrApiKey = process.env.VIETQR_API_KEY,
  bankAccountEncryptionKey = process.env.BANK_ACCOUNT_ENCRYPTION_KEY,
  mediaStorage = createMediaStorage({
    forceMemory: process.env.CLOUDINARY_FORCE_MEMORY === '1'
      || (!process.env.CLOUDINARY_CLOUD_NAME && !process.env.CLOUDINARY_API_KEY && !process.env.CLOUDINARY_API_SECRET),
  }),
} = {}) {
  const connection = await openDatabase({ ...(mongoUri ? { uri: mongoUri } : {}), ...(databaseName ? { databaseName } : {}) })
  const { database } = connection
  const users = database.collection('users')
  const sessions = database.collection('sessions')
  const entries = database.collection('entries')
  const walletTransactions = database.collection('walletTransactions')
  const walletAccounts = database.collection('walletAccounts')
  const chatMessages = database.collection('chatMessages')
  const chatPresence = database.collection('chatPresence')
  const invitations = database.collection('invitations')
  const relationships = database.collection('relationships')
  const blocks = database.collection('blocks')
  const notifications = database.collection('notifications')
  const loveMilestones = database.collection('loveMilestones')
  const adminAuditLogs = database.collection('adminAuditLogs')
  const paymentMethods = database.collection('paymentMethods')
  const topupPackages = database.collection('topupPackages')
  const depositRequests = database.collection('depositRequests')
  const mediaService = createMediaService({ database, storage: mediaStorage, relationships })
  const depositPaymentWindowFilter = (now) => ({
    $or: [
      { status: 'info_requested' },
      {
        status: 'awaiting_payment',
        $or: [
          { expiresAt: { $gt: now } },
          { expiresAt: { $exists: false }, createdAt: { $gt: new Date(now.getTime() - DEPOSIT_PAYMENT_TTL_MS) } },
        ],
      },
    ],
  })
  const expireUnpaidDeposits = async (userId, now = new Date()) => {
    const cutoff = new Date(now.getTime() - DEPOSIT_PAYMENT_TTL_MS)
    const filter = {
      status: 'awaiting_payment',
      ...(userId ? { userId } : {}),
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false }, createdAt: { $lte: cutoff } },
      ],
    }
    const cursor = depositRequests.find(filter, { projection: { _id: 1, createdAt: 1, expiresAt: 1 } })
    for await (const deposit of cursor) {
      const expiryFilter = deposit.expiresAt instanceof Date
        ? { expiresAt: { $lte: now } }
        : { expiresAt: { $exists: false }, createdAt: { $lte: cutoff } }
      await depositRequests.updateOne({ _id: deposit._id, status: 'awaiting_payment', ...expiryFilter }, {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          cancellationReason: 'Hết hạn thanh toán sau 15 phút.',
        },
        $unset: { activeDepositUserId: '' },
        $push: {
          history: {
            status: 'cancelled',
            reason: 'Hết hạn thanh toán sau 15 phút.',
            createdAt: now,
          },
        },
      })
    }
  }
  const withdrawalRequests = database.collection('withdrawalRequests')
  const transactionCodes = database.collection('transactionCodes')
  const refundRequests = database.collection('refundRequests')
  const balanceAdjustments = database.collection('balanceAdjustments')
  const bankCatalogCache = database.collection('bankCatalogCache')
  const bankVerifications = database.collection('bankVerifications')
  const bankAccounts = database.collection('bankAccounts')
  for (const deposit of await depositRequests.find({ code: { $type: 'string' } }, { projection: { _id: 1, code: 1, createdAt: 1 } }).toArray()) {
    try {
      await transactionCodes.updateOne(
        { code: deposit.code },
        { $setOnInsert: { code: deposit.code, type: 'deposit', transactionId: deposit._id, createdAt: deposit.createdAt ?? new Date() } },
        { upsert: true },
      )
    } catch (error) {
      if (error?.code !== 11000 || !await transactionCodes.findOne({ code: deposit.code })) throw error
    }
    await walletTransactions.updateMany(
      { depositRequestId: deposit._id, transactionCode: { $exists: false } },
      { $set: { transactionCode: deposit.code, transactionType: 'deposit' } },
    )
  }
  const reserveTransactionCode = (code, type, transactionId, createdAt, session) => transactionCodes.insertOne({
    code,
    type,
    transactionId,
    createdAt,
  }, { session })
  const getOrCreateWalletAccount = async (userId, session, now = new Date()) => {
    let account = await walletAccounts.findOne({ userId }, { session })
    if (account) return account
    const [ledger] = await walletTransactions.aggregate([
      { $match: { userId } },
      { $group: { _id: null, balance: { $sum: '$amount' } } },
    ], { session }).toArray()
    account = { _id: randomUUID(), userId, balance: ledger?.balance ?? 0, updatedAt: now }
    await walletAccounts.insertOne(account, { session })
    return account
  }
  let bankRefreshPromise = null
  let loveLevelSweep = null
  let depositExpirySweep = null
  const app = Fastify({ logger, bodyLimit: 8 * 1024 * 1024 })
  const defaultRateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX ?? '5000', 10)
  const rateLimitWindow = process.env.RATE_LIMIT_WINDOW ?? '15 minutes'
  const rateLimitConfig = (max = defaultRateLimitMax) => ({
    max: Number.isFinite(max) && max > 0 ? max : defaultRateLimitMax,
    timeWindow: rateLimitWindow,
  })
  const accountEncryptionKey = typeof bankAccountEncryptionKey === 'string' && /^[a-fA-F0-9]{64}$/.test(bankAccountEncryptionKey)
    ? Buffer.from(bankAccountEncryptionKey, 'hex')
    : null
  await app.register(cookie)
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: MAX_IMAGE_BYTES,
      fields: 8,
    },
  })
  const globalRateLimit = Number.parseInt(process.env.RATE_LIMIT_MAX ?? '', 10)
  await app.register(rateLimit, {
    global: true,
    max: Number.isFinite(globalRateLimit) && globalRateLimit > 0 ? globalRateLimit : defaultRateLimitMax,
    timeWindow: rateLimitWindow,
  })
  await app.register(websocket)
  app.decorateRequest('user', null)
  const chatSockets = new Map()

  await ensureDefaultAdmin(users, app.log)

  function broadcastChat(relationshipId, event, excludedUserId = null) {
    const sockets = chatSockets.get(relationshipId)
    if (!sockets) return
    const payload = JSON.stringify(event)
    for (const socket of sockets) {
      if (socket.readyState === 1 && socket.userId !== excludedUserId) socket.send(payload)
    }
  }

  app.decorate('requireAuth', async function requireAuth(request, reply) {
    const token = request.cookies[COOKIE_NAME]
    if (!token) throw httpError(401, 'Vui lòng đăng nhập để tiếp tục.')
    const session = await sessions.findOne({ tokenHash: hashToken(token) })
    const user = session && session.expiresAt > new Date() ? await users.findOne({ _id: session.userId }) : null
    if (!user) {
      if (session) await sessions.deleteOne({ _id: session._id })
      reply.clearCookie(COOKIE_NAME, { path: '/' })
      throw httpError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }
    if (user.accountStatus === 'locked') {
      await sessions.deleteMany({ userId: user._id })
      reply.clearCookie(COOKIE_NAME, { path: '/' })
      throw httpError(403, 'Tài khoản đã bị khóa. Vui lòng liên hệ bộ phận hỗ trợ.')
    }
    await touchUserPresence(database, user._id)
    request.user = {
      id: user._id,
      publicId: user.publicId,
      email: user.email,
      displayName: user.displayName,
      online: isUserOnline(user, new Date()),
      role: user.role ?? 'member',
    }
  })

  app.decorate('requireAdmin', async function requireAdmin(request, reply) {
    await app.requireAuth(request, reply)
    if (request.user?.role !== 'admin') {
      throw httpError(403, 'Bạn không có quyền truy cập khu vực quản trị.')
    }
  })

  async function getBankCatalog() {
    const cached = await bankCatalogCache.findOne({ _id: BANK_CACHE_ID })
    if (cached?.cachedAt instanceof Date && Date.now() - cached.cachedAt.getTime() < BANK_CACHE_TTL_MS) {
      return cached.banks
    }
    if (!bankRefreshPromise) {
      bankRefreshPromise = (async () => {
        try {
          const response = await fetchImpl('https://api.vietqr.io/v2/banks', {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
          })
          if (!response.ok) throw new Error('upstream_http_error')
          const payload = await response.json()
          if (payload?.code !== '00' || !Array.isArray(payload.data)) throw new Error('upstream_payload_invalid')
          const banks = payload.data.filter((bank) =>
            Number.isSafeInteger(bank?.id)
            && typeof bank.name === 'string' && bank.name.trim().length > 0
            && typeof bank.code === 'string' && bank.code.trim().length > 0
            && typeof bank.bin === 'string' && /^\d{6}$/.test(bank.bin)
            && typeof bank.shortName === 'string' && bank.shortName.trim().length > 0
            && typeof bank.logo === 'string'
            && (() => {
              try {
                const logoUrl = new URL(bank.logo)
                return logoUrl.protocol === 'https:' && (logoUrl.hostname === 'vietqr.io' || logoUrl.hostname.endsWith('.vietqr.io'))
              } catch { return false }
            })()
            && (bank.lookupSupported === 0 || bank.lookupSupported === 1)
            && (bank.transferSupported === 0 || bank.transferSupported === 1))
            .map((bank) => ({
              id: bank.id,
              name: bank.name.trim(),
              code: bank.code.trim(),
              bin: bank.bin,
              shortName: bank.shortName.trim(),
              logo: bank.logo,
              lookupSupported: bank.lookupSupported,
              transferSupported: bank.transferSupported,
            }))
          if (banks.length === 0) throw new Error('upstream_bank_list_empty')
          await bankCatalogCache.updateOne(
            { _id: BANK_CACHE_ID },
            { $set: { banks, cachedAt: new Date(), source: 'vietqr' } },
            { upsert: true },
          )
          return banks
        } catch (error) {
          app.log.warn({ reason: error?.name === 'TimeoutError' ? 'timeout' : 'refresh_failed' }, 'VietQR bank list refresh failed')
          if (cached?.cachedAt instanceof Date && Date.now() - cached.cachedAt.getTime() <= BANK_CACHE_MAX_STALE_MS) {
            return cached.banks
          }
          throw httpError(503, 'Chưa thể tải danh sách ngân hàng. Vui lòng thử lại sau.')
        } finally {
          bankRefreshPromise = null
        }
      })()
    }
    return bankRefreshPromise
  }

  function encryptSensitiveValue(value) {
    if (!accountEncryptionKey) return null
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', accountEncryptionKey, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return {
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    }
  }

  function decryptBankAccountValue(encryptedValue) {
    if (!accountEncryptionKey) {
      app.log.error({ reason: 'missing_bank_account_encryption_key' }, 'Bank account data is unavailable because encryption key is not configured')
      throw httpError(503, 'Chưa thể truy cập dữ liệu tài khoản ngân hàng. Vui lòng thử lại sau.')
    }
    if (!encryptedValue) throw httpError(500, 'Dữ liệu tài khoản ngân hàng không hợp lệ.')
    const decipher = createDecipheriv('aes-256-gcm', accountEncryptionKey, Buffer.from(encryptedValue.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(encryptedValue.tag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue.data, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  }

  const publicBankAccount = (account) => ({
    id: account._id,
    bankName: account.bankName,
    bankShortName: account.bankShortName,
    bankBin: account.bankBin,
    accountName: decryptBankAccountValue(account.accountNameEncrypted),
    maskedAccountNumber: `••••${account.accountLastFour}`,
    isDefault: account.isDefault,
    verifiedAt: account.verifiedAt?.toISOString?.() ?? '',
  })

  app.get('/api/banks', { config: { rateLimit: rateLimitConfig(30) } }, async () => ({
    banks: await getBankCatalog(),
  }))

  app.post('/api/bank-accounts/verify', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig(10) },
  }, async (request, reply) => {
    const { bankBin, accountNumber } = request.body ?? {}
    if (typeof bankBin !== 'string' || !/^\d{6}$/.test(bankBin)
      || typeof accountNumber !== 'string' || !/^[A-Za-z0-9]{4,25}$/.test(accountNumber.trim())) {
      throw httpError(400, 'Ngân hàng hoặc số tài khoản không hợp lệ.')
    }
    const normalizedAccountNumber = accountNumber.trim()
    let banks
    try {
      banks = await getBankCatalog()
    } catch {
      return reply.code(503).send({ status: 'temporarily_unavailable', message: 'Chưa thể tải danh sách ngân hàng để xác minh.' })
    }
    const bank = banks.find((item) => item.bin === bankBin)
    if (!bank) throw httpError(400, 'Ngân hàng đã chọn không hợp lệ.')
    if (bank.lookupSupported !== 1) return { status: 'unsupported', message: 'Ngân hàng này chưa hỗ trợ xác minh số tài khoản.' }
    if (!accountEncryptionKey) {
      app.log.error({ reason: 'missing_bank_account_encryption_key' }, 'Bank account verification is unavailable because encryption key is not configured')
      return reply.code(503).send({ status: 'temporarily_unavailable', message: 'Hiện chưa thể xác minh tài khoản. Vui lòng thử lại sau.' })
    }
    if (!vietqrClientId || !vietqrApiKey) {
      app.log.error({ reason: 'missing_vietqr_credentials' }, 'VietQR lookup is unavailable because credentials are not configured')
      return reply.code(503).send({ status: 'temporarily_unavailable', message: 'Hiện chưa thể xác minh tài khoản. Vui lòng thử lại sau.' })
    }
    let payload
    try {
      const response = await fetchImpl('https://api.vietqr.io/v2/lookup', {
        method: 'POST',
        headers: {
          'x-client-id': vietqrClientId,
          'x-api-key': vietqrApiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ bin: Number(bank.bin), accountNumber: normalizedAccountNumber }),
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) {
        app.log.error({ statusCode: response.status }, 'VietQR account lookup returned an unsuccessful HTTP status')
        return reply.code(503).send({ status: 'temporarily_unavailable', message: 'Hiện chưa thể xác minh tài khoản. Vui lòng thử lại sau.' })
      }
      payload = await response.json()
    } catch (error) {
      app.log.warn({ reason: error?.name === 'TimeoutError' ? 'timeout' : 'lookup_failed' }, 'VietQR account lookup failed')
      return reply.code(503).send({ status: 'temporarily_unavailable', message: 'Hiện chưa thể xác minh tài khoản. Vui lòng thử lại sau.' })
    }
    if (payload?.code === '41') return { status: 'unsupported', message: 'Ngân hàng này chưa hỗ trợ xác minh số tài khoản.' }
    if (payload?.code === '21' || payload?.code === '22' || payload?.code === '42') {
      return { status: 'not_found', message: 'Không tìm thấy tài khoản phù hợp. Hãy kiểm tra ngân hàng và số tài khoản.' }
    }
    const accountName = typeof payload?.data?.accountName === 'string' ? payload.data.accountName.trim() : ''
    if (payload?.code !== '00' || !accountName || accountName.length > 200) {
      if (payload?.code === '00') app.log.warn({ reason: 'missing_account_name' }, 'VietQR lookup omitted a valid account name')
      return reply.code(503).send({ status: 'temporarily_unavailable', message: 'Chưa nhận được kết quả xác minh hợp lệ. Vui lòng thử lại sau.' })
    }
    const sessionToken = request.cookies[COOKIE_NAME]
    const sessionTokenHash = hashToken(sessionToken)
    const verificationId = randomUUID()
    const accountNumberHash = createHmac('sha256', accountEncryptionKey).update(normalizedAccountNumber).digest('hex')
    const now = new Date()
    await bankVerifications.deleteMany({ userId: request.user.id, sessionTokenHash })
    await bankVerifications.insertOne({
      _id: verificationId,
      verificationId,
      userId: request.user.id,
      sessionTokenHash,
      bankBin: bank.bin,
      bankCode: bank.code,
      bankName: bank.name,
      bankShortName: bank.shortName,
      accountNumberHash,
      accountLastFour: normalizedAccountNumber.slice(-4),
      accountNameEncrypted: encryptSensitiveValue(accountName),
      createdAt: now,
      expiresAt: new Date(now.getTime() + BANK_VERIFICATION_TTL_MS),
    })
    return { status: 'verified', verificationId, bank: { bin: bank.bin, name: bank.name, shortName: bank.shortName }, accountName }
  })

  app.post('/api/bank-accounts/continue', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig(10) },
  }, async (request, reply) => {
    const { verificationId, bankBin, accountNumber } = request.body ?? {}
    if (typeof verificationId !== 'string' || typeof bankBin !== 'string'
      || typeof accountNumber !== 'string' || !/^[A-Za-z0-9]{4,25}$/.test(accountNumber.trim())) {
      throw httpError(400, 'Thông tin xác minh không hợp lệ.')
    }
    if (!accountEncryptionKey) {
      app.log.error({ reason: 'missing_bank_account_encryption_key' }, 'Bank account persistence is unavailable because encryption key is not configured')
      return reply.code(503).send({ status: 'temporarily_unavailable', message: 'Chưa thể lưu tài khoản đã xác minh. Vui lòng thử lại sau.' })
    }
    const sessionTokenHash = hashToken(request.cookies[COOKIE_NAME])
    const verification = await bankVerifications.findOne({
      verificationId,
      userId: request.user.id,
      sessionTokenHash,
      bankBin,
      accountNumberHash: createHmac('sha256', accountEncryptionKey).update(accountNumber.trim()).digest('hex'),
      expiresAt: { $gt: new Date() },
    })
    if (!verification) throw httpError(409, 'Kết quả xác minh đã hết hạn hoặc thông tin đã thay đổi. Hãy xác minh lại.')
    const encryptedAccountNumber = encryptSensitiveValue(accountNumber.trim())
    const now = new Date()
    const existingDefault = await bankAccounts.findOne({ userId: request.user.id, isDefault: true })
    const account = {
      _id: randomUUID(),
      userId: request.user.id,
      bankBin: verification.bankBin,
      bankCode: verification.bankCode,
      bankName: verification.bankName,
      bankShortName: verification.bankShortName,
      accountNameEncrypted: verification.accountNameEncrypted,
      accountNumberEncrypted: encryptedAccountNumber,
      accountLastFour: verification.accountLastFour,
      verifiedAt: verification.createdAt,
      createdAt: now,
      isDefault: !existingDefault,
    }
    try {
      await connection.withTransaction(async (session) => {
        await bankAccounts.insertOne(account, { session })
        await bankVerifications.deleteOne({ _id: verification._id }, { session })
      })
    } catch (error) {
      if (error?.code === 11000) throw httpError(409, 'Tài khoản vừa được lưu ở một yêu cầu khác. Hãy tải lại danh sách.')
      throw error
    }
    return reply.code(201).send({ account: publicBankAccount(account) })
  })

  app.get('/api/bank-accounts', { preHandler: app.requireAuth }, async (request) => {
    const accounts = await bankAccounts.find({ userId: request.user.id }).sort({ isDefault: -1, createdAt: -1 }).toArray()
    return { accounts: accounts.map(publicBankAccount) }
  })

  app.delete('/api/bank-accounts/:id', { preHandler: app.requireAuth }, async (request) => {
    const account = await bankAccounts.findOne({ _id: request.params.id, userId: request.user.id })
    if (!account) throw httpError(404, 'Không tìm thấy tài khoản ngân hàng.')
    await connection.withTransaction(async (session) => {
      await bankAccounts.deleteOne({ _id: account._id, userId: request.user.id }, { session })
      if (account.isDefault) {
        const nextDefault = await bankAccounts.find({ userId: request.user.id, _id: { $ne: account._id } }, { session })
          .sort({ createdAt: -1 }).limit(1).next()
        if (nextDefault) await bankAccounts.updateOne({ _id: nextDefault._id }, { $set: { isDefault: true } }, { session })
      }
    })
    return { deleted: true }
  })

  async function getLoveLevelForRelationship(relationship, userId, now = new Date()) {
    const partnerId = relationship.members.find((memberId) => memberId !== userId)
    const partner = await users.findOne({ _id: partnerId }, { projection: { displayName: 1 } })
    const todayInVietnam = new Date(`${vietnamDateValue(now)}T00:00:00.000Z`)
    const loveLevel = calculateLoveLevel(relationship.relationshipStart, todayInVietnam)
    if (!loveLevel) throw httpError(409, 'Ngày bắt đầu yêu nhau của hai bạn chưa hợp lệ.')
    const currentSnapshot = {
      ...loveLevel.currentLevel,
      daysTogether: loveLevel.daysTogether,
      duration: loveLevel.duration,
      nextLevel: loveLevel.nextLevel,
      progressPercent: loveLevel.progressPercent,
      calculatedAt: todayInVietnam,
    }
    if (JSON.stringify(relationship.loveLevel ?? null) !== JSON.stringify(currentSnapshot)) {
      await relationships.updateOne(
        { _id: relationship._id, members: userId },
        { $set: { loveLevel: currentSnapshot } },
      )
    }

    const connectedOn = relationship.createdAt instanceof Date ? vietnamDateValue(relationship.createdAt) : ''
    const achieved = loveLevel.milestones.filter((item) => item.achieved)
    for (const milestone of achieved) {
      const levelUp = milestone.level !== null
      const achievedAt = new Date(`${milestone.date}T00:00:00.000Z`)
      const event = {
        relationshipId: relationship._id,
        milestoneId: milestone.id,
        title: milestone.title,
        date: milestone.date,
        level: milestone.level,
        badge: milestone.icon,
        achievedAt,
      }
      try {
        await loveMilestones.updateOne(
          { relationshipId: relationship._id, milestoneId: milestone.id },
          { $set: event, $setOnInsert: { createdAt: now } },
          { upsert: true },
        )
      } catch (error) {
        if (error.code !== 11000 || !await loveMilestones.findOne({ relationshipId: relationship._id, milestoneId: milestone.id })) throw error
      }
      if (connectedOn && milestone.date >= connectedOn) {
        for (const memberId of relationship.members) {
          const actorUserId = relationship.members.find((id) => id !== memberId)
          const dedupeKey = `love-level:${relationship._id}:${milestone.id}`
          const notification = {
            _id: randomUUID(),
            userId: memberId,
            actorUserId,
            relationshipId: relationship._id,
            milestoneId: milestone.id,
            dedupeKey,
            type: levelUp ? 'love_level_up' : 'relationship_milestone',
            title: levelUp ? `Đạt Love Level LV.${milestone.level}` : milestone.title,
            message: getMilestoneMessage(milestone),
            createdAt: achievedAt,
            readAt: '',
          }
          try {
            await notifications.updateOne(
              { userId: memberId, dedupeKey },
              { $setOnInsert: notification },
              { upsert: true },
            )
          } catch (error) {
            if (error.code !== 11000 || !await notifications.findOne({ userId: memberId, dedupeKey })) throw error
          }
        }
      }
    }

    const achievedIds = achieved.map((item) => item.id)
    const [events, milestoneNotifications] = await Promise.all([
      loveMilestones.find({ relationshipId: relationship._id, milestoneId: { $in: achievedIds } }).sort({ achievedAt: -1 }).toArray(),
      notifications.find({
        userId,
        relationshipId: relationship._id,
        milestoneId: { $in: achievedIds },
      }).toArray(),
    ])
    const notificationByMilestone = new Map(milestoneNotifications.map((item) => [item.milestoneId, item]))
    const eventByMilestone = new Map(events.map((item) => [item.milestoneId, item]))
    const couplesAhead = await relationships.countDocuments({
      members: { $size: 2 },
      relationshipStart: { $type: 'string' },
      $or: [
        { relationshipStart: { $lt: loveLevel.relationshipStart } },
        { relationshipStart: loveLevel.relationshipStart, _id: { $lt: relationship._id } },
      ],
    })
    return {
      relationshipId: relationship._id,
      coupleRank: couplesAhead + 1,
      partnerName: partner?.displayName ?? '',
      relationshipStart: loveLevel.relationshipStart,
      daysTogether: loveLevel.daysTogether,
      duration: loveLevel.duration,
      currentLevel: loveLevel.currentLevel,
      levels: loveLevel.levels,
      nextLevel: loveLevel.nextLevel,
      progressPercent: loveLevel.progressPercent,
      daysToNextLevel: loveLevel.daysToNextLevel,
      milestones: achieved.map((item) => {
        const event = eventByMilestone.get(item.id)
        const notification = notificationByMilestone.get(item.id)
        return {
          id: item.id,
          title: item.title,
          date: item.date,
          level: item.level,
          icon: item.icon,
          achievedAt: event?.achievedAt?.toISOString?.() ?? `${item.date}T00:00:00.000Z`,
          message: getMilestoneMessage(item),
          notificationId: notification?._id ?? '',
          readAt: notification?.readAt ?? '',
        }
      }),
      upcomingMilestones: loveLevel.milestones.filter((item) => !item.achieved).slice(0, 5),
    }
  }

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin
    if (typeof origin === 'string') {
      reply.header('Vary', 'Origin')
      if (isAllowedOrigin(origin, clientOrigin)) {
        reply
          .header('Access-Control-Allow-Origin', origin)
          .header('Access-Control-Allow-Credentials', 'true')
          .header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS')
          .header('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key')
      }
    }
    if (request.method === 'OPTIONS') return reply.code(204).send()
    if (['GET', 'HEAD'].includes(request.method)) return
    if (!isAllowedOrigin(request.headers.origin, clientOrigin)) {
      return reply.code(403).send({ error: 'Nguồn yêu cầu không được phép.' })
    }
  })
  app.addHook('onClose', async () => {
    if (loveLevelSweep) clearInterval(loveLevelSweep)
    if (depositExpirySweep) clearInterval(depositExpirySweep)
    for (const sockets of chatSockets.values()) {
      for (const socket of sockets) socket.close()
    }
    await connection.close()
  })
  app.setErrorHandler((error, request, reply) => {
    if (error.statusCode && (error.statusCode < 500 || error.expose)) return reply.code(error.statusCode).send({ error: error.message })
    if (error.code === 11000 && error.keyPattern?.email) return reply.code(409).send({ error: 'Email này đã được đăng ký.' })
    if (error.code === 11000 && error.keyPattern?.publicId) return reply.code(503).send({ error: 'Hiện không thể cấp ID LoveForYou. Vui lòng thử lại sau.' })
    if (error.code === 11000 && error.keyPattern?.pairKey) return reply.code(409).send({ error: 'Đã có lời mời đang chờ giữa hai tài khoản.' })
    if (error.statusCode === 413) return reply.code(413).send({ error: 'Dữ liệu gửi lên vượt quá giới hạn.' })
    request.log.error(error)
    return reply.code(500).send({ error: 'Đã có lỗi máy chủ. Vui lòng thử lại sau.' })
  })

  app.get('/api/health', async () => {
    await database.command({ ping: 1 })
    return { status: 'ok' }
  })

  app.post('/api/auth/register', {
    config: { rateLimit: rateLimitConfig() },
  }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Thông tin đăng ký không hợp lệ.')
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const dateOfBirth = body.dateOfBirth === undefined ? '' : body.dateOfBirth
    const gender = body.gender === undefined ? '' : body.gender
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw httpError(400, 'Email không hợp lệ.')
    if (displayName.length < 1 || displayName.length > 48) throw httpError(400, 'Tên hiển thị cần có từ 1 đến 48 ký tự.')
    if (typeof dateOfBirth !== 'string' || dateOfBirth !== '' && (!isDate(dateOfBirth) || dateOfBirth > new Date().toISOString().slice(0, 10))) {
      throw httpError(400, 'Ngày sinh không hợp lệ.')
    }
    if (typeof gender !== 'string' || !['', 'female', 'male', 'other', 'prefer_not_to_say'].includes(gender)) {
      throw httpError(400, 'Vui lòng chọn giới tính hợp lệ.')
    }
    if (!isStrongPassword(password)) {
      throw httpError(400, 'Mật khẩu cần từ 6 đến 128 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.')
    }
    if (body.termsAccepted !== true) throw httpError(400, 'Bạn cần đồng ý với điều khoản để tạo tài khoản.')

    const now = new Date()
    const token = createSessionToken()
    const user = {
      _id: randomUUID(),
      publicId: '',
      email,
      displayName,
      dateOfBirth,
      gender,
      passwordHash: hashPassword(password),
      termsAcceptedAt: now,
      termsVersion: TERMS_VERSION,
      createdAt: now,
      relationshipStart: '',
      lastSeenAt: now,
      role: 'member',
      accountStatus: 'active',
    }
    let createdUser = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      user.publicId = generatePublicId()
      if (!/^\d{6}$/.test(user.publicId)) throw new Error('Public ID generator returned an invalid value.')
      try {
        await connection.withTransaction(async (session) => {
          await users.insertOne(user, { session })
          await saveSession(database, user._id, token, session)
        })
        createdUser = user
        break
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.publicId) continue
        throw error
      }
    }
    if (!createdUser) throw httpError(503, 'Hiện không thể cấp ID LoveForYou. Vui lòng thử lại sau.')
    setSessionCookie(reply, token, secureCookies)
    return reply.code(201).send({ user: publicUser(createdUser) })
  })

  app.post('/api/auth/login', {
    config: { rateLimit: rateLimitConfig() },
  }, async (request, reply) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const rawPassword = typeof request.body?.password === 'string' ? request.body.password : ''
    const rememberMe = request.body?.rememberMe === undefined ? true : request.body.rememberMe
    if (typeof rememberMe !== 'boolean') throw httpError(400, 'Tuỳ chọn ghi nhớ đăng nhập không hợp lệ.')
    const password = rawPassword.length <= 128 ? rawPassword : ''
    const user = await users.findOne({ email })
    const passwordMatches = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
    if (!user || !passwordMatches) throw httpError(401, 'Email hoặc mật khẩu chưa chính xác.')
    if (user.accountStatus === 'locked') throw httpError(403, 'Tài khoản đã bị khóa. Vui lòng liên hệ bộ phận hỗ trợ.')
    const token = createSessionToken()
    await Promise.all([
      saveSession(database, user._id, token),
      users.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date(), lastLoginAt: new Date() } }),
    ])
    setSessionCookie(reply, token, secureCookies, rememberMe)
    return { user: publicUser(user) }
  })

  app.get('/api/auth/me', { preHandler: app.requireAuth }, async (request) => {
    const currentUser = await users.findOne({ _id: request.user.id }, { projection: { publicId: 1, email: 1, displayName: 1, lastSeenAt: 1, role: 1 } })
    return { user: publicUser(currentUser) }
  })

  app.get('/api/admin/overview', { preHandler: app.requireAdmin }, async () => {
    const now = new Date()
    const [totalUsers, activeUsers, activeCouples, totalCoinsTransferred, sentGifts, recentUsers, recentActivities, chartRows] = await Promise.all([
      users.countDocuments(),
      users.countDocuments({ lastSeenAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) } }),
      relationships.countDocuments({ members: { $size: 2 } }),
      walletTransactions.aggregate([
        { $group: { _id: null, totalTransferred: { $sum: { $abs: '$amount' } } } },
      ]).toArray(),
      notifications.countDocuments({ type: 'gift_received' }),
      users.find({}, { projection: { displayName: 1, publicId: 1, lastSeenAt: 1, createdAt: 1 } }).sort({ lastSeenAt: -1 }).limit(5).toArray(),
      notifications.find({
        type: { $in: ['chat_message', 'gift_received', 'couple_invitation', 'couple_invitation_accepted', 'couple_connected', 'love_level_up', 'relationship_milestone'] },
      }).sort({ createdAt: -1 }).limit(4).toArray(),
      users.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $project: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } },
          },
        },
        { $group: { _id: '$day', value: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray(),
    ])

    const dayLabels = []
    for (let index = 6; index >= 0; index -= 1) {
      const day = new Date(now.getTime() - index * 24 * 60 * 60 * 1000)
      dayLabels.push({
        key: vietnamDateValue(day),
        label: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(day),
      })
    }

    const chartMap = new Map(chartRows.map((item) => [item._id, item.value]))
    const chart = dayLabels.map(({ key, label }) => ({ label, value: Number(chartMap.get(key) ?? 0) }))

    const topUsers = recentUsers.map((user, index) => ({
      id: user.publicId ?? user._id ?? `#${index + 1}`,
      displayName: user.displayName ?? 'Người dùng',
      city: 'Chưa cập nhật',
      plan: 'Thành viên',
      points: 0,
      status: user.lastSeenAt && new Date(user.lastSeenAt) >= new Date(now.getTime() - 30 * 60 * 1000) ? 'Đang hoạt động' : 'Đã offline',
      joinedAt: user.createdAt?.toISOString?.() ?? '',
    }))

    const activities = recentActivities.map((notification) => {
      const titles = {
        chat_message: 'Có tin nhắn mới',
        gift_received: 'Có quà tặng mới',
        couple_invitation: 'Có lời mời kết nối mới',
        couple_invitation_accepted: 'Lời mời kết nối được chấp nhận',
        couple_connected: 'Có kết nối mới',
        love_level_up: 'Có cặp đôi đạt cấp độ mới',
        relationship_milestone: 'Có cột mốc tình yêu mới',
      }
      const createdAt = notification.createdAt instanceof Date ? notification.createdAt : new Date(notification.createdAt)
      const minutes = Math.max(1, Math.round((now.getTime() - createdAt.getTime()) / 60_000))
      const time = minutes < 60 ? `${minutes} phút trước` : `${Math.max(1, Math.floor(minutes / 60))} giờ trước`
      return {
        title: titles[notification.type] ?? 'Hoạt động hệ thống',
        subtitle: 'Hoạt động hệ thống',
        time,
      }
    })

    const systemStatus = [
      { title: 'Máy chủ', value: 'Ổn định' },
      { title: 'Cơ sở dữ liệu', value: 'Đã đồng bộ' },
      { title: 'Bot cảnh báo', value: 'Hoạt động' },
      { title: 'Phân tích', value: `Cập nhật ${new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(now)}` },
    ]

    return {
      summary: {
        totalUsers,
        activeUsers,
        activeCouples,
        totalCoinsTransferred: totalCoinsTransferred[0]?.totalTransferred ?? 0,
        sentGifts,
      },
      chart,
      topUsers,
      activities,
      systemStatus,
    }
  })

  app.get('/api/admin/users', { preHandler: app.requireAdmin }, async (request) => {
    const rawSearch = typeof request.query?.search === 'string' ? request.query.search.trim() : ''
    const search = rawSearch.slice(0, 100)
    const statusFilter = typeof request.query?.status === 'string' ? request.query.status : 'all'
    const page = Number.parseInt(request.query?.page ?? '1', 10)
    const pageSize = Number.parseInt(request.query?.pageSize ?? '25', 10)
    const registeredFrom = request.query?.registeredFrom
    const registeredTo = request.query?.registeredTo
    if (!['all', 'active', 'locked'].includes(statusFilter)) throw httpError(400, 'Bộ lọc trạng thái không hợp lệ.')
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw httpError(400, 'Thông tin phân trang không hợp lệ.')
    }
    if (registeredFrom !== undefined && !isDate(registeredFrom) || registeredTo !== undefined && !isDate(registeredTo)) {
      throw httpError(400, 'Khoảng ngày đăng ký không hợp lệ.')
    }
    if (registeredFrom && registeredTo && registeredFrom > registeredTo) throw httpError(400, 'Ngày bắt đầu không thể sau ngày kết thúc.')
    const now = new Date()
    const filter = { role: { $ne: 'admin' } }
    if (search) {
      const safeSearch = escapeRegExp(search)
      filter.$or = [
        { displayName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { publicId: { $regex: safeSearch, $options: 'i' } },
      ]
    }
    if (statusFilter === 'active') filter.accountStatus = { $ne: 'locked' }
    if (statusFilter === 'locked') filter.accountStatus = 'locked'
    if (registeredFrom || registeredTo) {
      filter.createdAt = {}
      if (registeredFrom) filter.createdAt.$gte = new Date(`${registeredFrom}T00:00:00.000Z`)
      if (registeredTo) filter.createdAt.$lt = new Date(new Date(`${registeredTo}T00:00:00.000Z`).getTime() + 86_400_000)
    }

    const [totalUsers, activeUsers, blockedUsers, filteredCount, usersList] = await Promise.all([
      users.countDocuments({ role: { $ne: 'admin' } }),
      users.countDocuments({ role: { $ne: 'admin' }, accountStatus: { $ne: 'locked' } }),
      users.countDocuments({ role: { $ne: 'admin' }, accountStatus: 'locked' }),
      users.countDocuments(filter),
      users.find(filter, {
        projection: {
          _id: 1, publicId: 1, displayName: 1, email: 1, phone: 1, role: 1,
          accountStatus: 1, createdAt: 1, lastSeenAt: 1, lastLoginAt: 1, lockReason: 1, lockedAt: 1,
        },
      }).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ])

    return {
      summary: { totalUsers, activeUsers, blockedUsers },
      pagination: { page, pageSize, total: filteredCount, totalPages: Math.ceil(filteredCount / pageSize) },
      users: usersList.map((user) => ({
        id: user._id,
        publicId: user.publicId,
        name: user.displayName,
        email: user.email,
        phone: user.phone ?? '',
        role: 'Người dùng',
        status: user.accountStatus === 'locked' ? 'Bị khóa' : 'Đang hoạt động',
        online: isUserOnline(user, now),
        joinedAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : '',
        lastSeenAt: user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : '',
        lockReason: user.lockReason ?? '',
        lockedAt: user.lockedAt ? new Date(user.lockedAt).toISOString() : '',
        avatar: (user.displayName || 'U').trim().charAt(0).toUpperCase(),
      })),
    }
  })

  app.get('/api/admin/users/:id', { preHandler: app.requireAdmin }, async (request) => {
    const user = await users.findOne({ _id: request.params.id, role: { $ne: 'admin' } }, {
      projection: {
        _id: 1, publicId: 1, displayName: 1, email: 1, phone: 1, role: 1,
        accountStatus: 1, createdAt: 1, lastSeenAt: 1, lastLoginAt: 1, lockReason: 1, lockedAt: 1,
      },
    })
    if (!user) throw httpError(404, 'Không tìm thấy tài khoản người dùng phù hợp.')
    const transactions = await walletTransactions.find({ userId: user._id }, {
      projection: { _id: 1, description: 1, amount: 1, createdAt: 1, transferId: 1 },
    }).sort({ createdAt: -1 }).limit(20).toArray()
    return {
      user: {
        id: user._id,
        publicId: user.publicId,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone ?? '',
        accountStatus: user.accountStatus === 'locked' ? 'locked' : 'active',
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : '',
        lastLoginAt: user.lastLoginAt instanceof Date ? user.lastLoginAt.toISOString() : '',
        lastSeenAt: user.lastSeenAt instanceof Date ? user.lastSeenAt.toISOString() : '',
        lockReason: user.lockReason ?? '',
        lockedAt: user.lockedAt instanceof Date ? user.lockedAt.toISOString() : '',
      },
      walletTransactions: transactions.map((transaction) => ({
        id: transaction._id,
        description: transaction.description ?? '',
        amount: Number(transaction.amount) || 0,
        reference: transaction.transferId ?? '',
        createdAt: transaction.createdAt instanceof Date ? transaction.createdAt.toISOString() : '',
      })),
    }
  })

  app.get('/api/admin/users/export', { preHandler: app.requireAdmin }, async (request, reply) => {
    const rawSearch = typeof request.query?.search === 'string' ? request.query.search.trim() : ''
    const search = rawSearch.slice(0, 100)
    const status = typeof request.query?.status === 'string' ? request.query.status : 'all'
    const registeredFrom = request.query?.registeredFrom
    const registeredTo = request.query?.registeredTo
    if (!['all', 'active', 'locked'].includes(status)) throw httpError(400, 'Bộ lọc trạng thái không hợp lệ.')
    if (registeredFrom !== undefined && !isDate(registeredFrom) || registeredTo !== undefined && !isDate(registeredTo)) {
      throw httpError(400, 'Khoảng ngày đăng ký không hợp lệ.')
    }
    if (registeredFrom && registeredTo && registeredFrom > registeredTo) throw httpError(400, 'Ngày bắt đầu không thể sau ngày kết thúc.')
    const filter = { role: { $ne: 'admin' } }
    if (search) {
      const safeSearch = escapeRegExp(search)
      filter.$or = [
        { displayName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { publicId: { $regex: safeSearch, $options: 'i' } },
      ]
    }
    if (status === 'active') filter.accountStatus = { $ne: 'locked' }
    if (status === 'locked') filter.accountStatus = 'locked'
    if (registeredFrom || registeredTo) {
      filter.createdAt = {}
      if (registeredFrom) filter.createdAt.$gte = new Date(`${registeredFrom}T00:00:00.000Z`)
      if (registeredTo) filter.createdAt.$lt = new Date(new Date(`${registeredTo}T00:00:00.000Z`).getTime() + 86_400_000)
    }
    const exportedUsers = await users.find(filter, {
      projection: { publicId: 1, displayName: 1, email: 1, phone: 1, accountStatus: 1, createdAt: 1, lastLoginAt: 1, lockedAt: 1, lockReason: 1 },
    }).sort({ createdAt: -1, _id: 1 }).limit(10_000).toArray()
    const csvCell = (value) => {
      const text = String(value ?? '')
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replaceAll('"', '""')}"`
    }
    const lines = [
      ['ID', 'Tên', 'Email', 'Điện thoại', 'Trạng thái', 'Ngày đăng ký', 'Đăng nhập gần nhất', 'Khóa lúc', 'Lý do khóa'].map(csvCell).join(','),
      ...exportedUsers.map((user) => [
        user.publicId,
        user.displayName,
        user.email,
        user.phone,
        user.accountStatus === 'locked' ? 'Bị khóa' : 'Đang hoạt động',
        user.createdAt?.toISOString?.() ?? '',
        user.lastLoginAt?.toISOString?.() ?? '',
        user.lockedAt?.toISOString?.() ?? '',
        user.lockReason ?? '',
      ].map(csvCell).join(',')),
    ]
    await adminAuditLogs.insertOne({
      _id: randomUUID(),
      actorUserId: request.user.id,
      actorPublicId: request.user.publicId,
      action: 'users.exported',
      filters: { search, status, registeredFrom: registeredFrom ?? '', registeredTo: registeredTo ?? '' },
      count: exportedUsers.length,
      createdAt: new Date(),
    })
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="loveforyou-users.csv"')
      .send(`\uFEFF${lines.join('\r\n')}`)
  })

  function normalizePaymentMethod(body, current = {}) {
    const fields = ['name', 'bankName', 'bankCode', 'bankBin', 'accountHolder', 'accountNumber', 'paymentQrImage', 'transferTemplate', 'instructions', 'enabled', 'isDefault']
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !fields.includes(key))) {
      throw httpError(400, 'Thông tin phương thức thanh toán không hợp lệ.')
    }
    const merged = { ...current, ...body }
    if (merged.paymentQrImage === undefined) merged.paymentQrImage = current.paymentQrImage ?? current.qrImage
    if (merged.name === undefined) merged.name = merged.bankName
    for (const [field, label, max] of [
      ['name', 'Tên phương thức thanh toán', 100],
      ['bankName', 'Tên ngân hàng', 100],
      ['accountHolder', 'Tên chủ tài khoản', 100],
      ['accountNumber', 'Số tài khoản', 40],
      ['transferTemplate', 'Mẫu nội dung chuyển khoản', 120],
      ['instructions', 'Hướng dẫn thanh toán', 1000],
    ]) {
      if (typeof merged[field] !== 'string' || !merged[field].trim() || merged[field].trim().length > max) throw httpError(400, `${label} không hợp lệ.`)
      merged[field] = merged[field].trim()
    }
    if (!/^\d{4,40}$/.test(merged.accountNumber)) throw httpError(400, 'Số tài khoản chỉ được chứa từ 4 đến 40 chữ số.')
    if (typeof merged.bankCode !== 'string' || merged.bankCode.trim().length > 30) throw httpError(400, 'Mã ngân hàng không hợp lệ.')
    if (merged.bankBin !== undefined && (typeof merged.bankBin !== 'string' || !/^\d{6}$/.test(merged.bankBin))) throw httpError(400, 'Mã BIN ngân hàng không hợp lệ.')
    if (!merged.transferTemplate.includes('{code}')) throw httpError(400, 'Mẫu chuyển khoản phải có mã yêu cầu {code}.')
    if (typeof merged.enabled !== 'boolean' || typeof merged.isDefault !== 'boolean') {
      throw httpError(400, 'Trạng thái bật/tắt và mặc định không hợp lệ.')
    }
    if (!merged.enabled) merged.isDefault = false
    if (merged.paymentQrImage === '' || merged.paymentQrImage == null) {
      return {
        name: merged.name,
        bankName: merged.bankName,
        bankCode: merged.bankCode.trim(),
        bankBin: merged.bankBin ?? '',
        accountHolder: merged.accountHolder,
        accountNumber: merged.accountNumber,
        paymentQrImageContentType: '',
        paymentQrImage: '',
        paymentQrMediaId: null,
        clearPaymentQr: true,
        transferTemplate: merged.transferTemplate,
        instructions: merged.instructions,
        enabled: merged.enabled,
        isDefault: merged.isDefault,
      }
    }
    if (isMediaId(merged.paymentQrImage)) {
      return {
        name: merged.name,
        bankName: merged.bankName,
        bankCode: merged.bankCode.trim(),
        bankBin: merged.bankBin ?? '',
        accountHolder: merged.accountHolder,
        accountNumber: merged.accountNumber,
        paymentQrImageContentType: 'image/*',
        paymentQrImage: '',
        paymentQrMediaId: merged.paymentQrImage,
        transferTemplate: merged.transferTemplate,
        instructions: merged.instructions,
        enabled: merged.enabled,
        isDefault: merged.isDefault,
      }
    }
    parseImageDataUrl(merged.paymentQrImage)
    return {
      name: merged.name,
      bankName: merged.bankName,
      bankCode: merged.bankCode.trim(),
      bankBin: merged.bankBin ?? '',
      accountHolder: merged.accountHolder,
      accountNumber: merged.accountNumber,
      paymentQrImageContentType: 'pending-upload',
      paymentQrImage: merged.paymentQrImage,
      paymentQrMediaId: undefined,
      transferTemplate: merged.transferTemplate,
      instructions: merged.instructions,
      enabled: merged.enabled,
      isDefault: merged.isDefault,
    }
  }

  async function persistPaymentMethodImage(ownerId, next, previous = {}) {
    if (next.clearPaymentQr) {
      if (previous.paymentQrMediaId) {
        await mediaService.deleteOwnedMedia(previous.paymentQrMediaId, { id: ownerId, role: 'admin' }).catch(() => undefined)
      }
      const { clearPaymentQr, paymentQrImage, ...rest } = next
      return { ...rest, paymentQrImage: '', paymentQrMediaId: null, paymentQrImageContentType: '' }
    }
    if (next.paymentQrMediaId) {
      const mediaDoc = await mediaService.getAccessibleMedia(next.paymentQrMediaId, { id: ownerId, role: 'admin' }, { forAdmin: true })
      if (mediaDoc.category !== 'payment_qr') throw httpError(400, 'Ảnh QR không hợp lệ.')
      const { paymentQrImage, ...rest } = next
      return { ...rest, paymentQrImage: '', paymentQrImageContentType: mediaDoc.format ? `image/${mediaDoc.format}` : 'image/*' }
    }
    if (typeof next.paymentQrImage === 'string' && next.paymentQrImage.startsWith('data:image/')) {
      const uploaded = await mediaService.uploadFromDataUrl(ownerId, next.paymentQrImage, {
        category: 'payment_qr',
        replaceMediaId: previous.paymentQrMediaId ?? null,
        maxBytes: MAX_PAYMENT_IMAGE_BYTES,
      })
      const { paymentQrImage, ...rest } = next
      return {
        ...rest,
        paymentQrImage: '',
        paymentQrMediaId: uploaded._id,
        paymentQrImageContentType: `image/${uploaded.format}`,
      }
    }
    const { paymentQrImage, clearPaymentQr, ...rest } = next
    return {
      ...rest,
      paymentQrImage: previous.paymentQrImage ?? '',
      paymentQrMediaId: previous.paymentQrMediaId ?? null,
      paymentQrImageContentType: previous.paymentQrImageContentType ?? '',
    }
  }

  function normalizeTopupPackage(body, current = {}) {
    const fields = ['name', 'priceVnd', 'bonusCoins', 'enabled', 'displayOrder']
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !fields.includes(key))) {
      throw httpError(400, 'Thông tin gói nạp không hợp lệ.')
    }
    const merged = { ...current, ...body }
    if (typeof merged.name !== 'string' || !merged.name.trim() || merged.name.trim().length > 80) throw httpError(400, 'Tên gói nạp cần có từ 1 đến 80 ký tự.')
    if (!Number.isSafeInteger(merged.priceVnd) || merged.priceVnd < 1000 || merged.priceVnd > 100_000_000) throw httpError(400, 'Giá gói nạp phải từ 1.000 đến 100.000.000 VND.')
    const coins = Math.floor(merged.priceVnd / COIN_PRICE_VND)
    if (!Number.isSafeInteger(coins) || coins < 1 || coins > 1_000_000_000) throw httpError(400, 'Giá gói không tạo được số xu hợp lệ.')
    if (!Number.isSafeInteger(merged.bonusCoins) || merged.bonusCoins < 0 || merged.bonusCoins > 1_000_000_000) throw httpError(400, 'Số xu thưởng không hợp lệ.')
    if (!Number.isSafeInteger(merged.displayOrder) || merged.displayOrder < 0 || merged.displayOrder > 10_000) throw httpError(400, 'Thứ tự hiển thị không hợp lệ.')
    if (typeof merged.enabled !== 'boolean') throw httpError(400, 'Trạng thái gói nạp không hợp lệ.')
    return {
      name: merged.name.trim(),
      priceVnd: merged.priceVnd,
      coins,
      bonusCoins: merged.bonusCoins,
      enabled: merged.enabled,
      displayOrder: merged.displayOrder,
    }
  }

  const publicPaymentMethod = (method) => ({
    id: method._id,
    name: method.name ?? method.bankName,
    bankName: method.bankName,
    bankCode: method.bankCode,
    bankBin: method.bankBin ?? '',
    accountHolder: method.accountHolder,
    accountNumber: method.accountNumber,
    paymentQrImage: resolveStoredImageRef(method, {
      mediaIdField: 'paymentQrMediaId',
      legacyField: 'paymentQrImage',
      legacyAltField: 'qrImage',
    }),
    transferTemplate: method.transferTemplate,
    instructions: method.instructions,
    enabled: method.enabled,
    isDefault: method.isDefault,
  })

  app.get('/api/admin/payment-methods', { preHandler: app.requireAdmin }, async () => {
    const methods = await paymentMethods.find({}).sort({ isDefault: -1, createdAt: -1 }).toArray()
    return { methods: methods.map((method) => ({ ...publicPaymentMethod(method), createdAt: method.createdAt?.toISOString?.() ?? '', updatedAt: method.updatedAt?.toISOString?.() ?? '', updatedBy: method.updatedBy ?? '' })) }
  })

  app.post('/api/admin/payment-methods', { preHandler: app.requireAdmin }, async (request, reply) => {
    const now = new Date()
    const normalized = normalizePaymentMethod(request.body)
    const imageFields = await persistPaymentMethodImage(request.user.id, normalized)
    const method = { _id: randomUUID(), ...imageFields, createdAt: now, updatedAt: now, updatedBy: request.user.id }
    try {
      await connection.withTransaction(async (session) => {
        if (method.isDefault) await paymentMethods.updateMany({}, { $set: { isDefault: false } }, { session })
        await paymentMethods.insertOne(method, { session })
        await adminAuditLogs.insertOne({ _id: randomUUID(), actorUserId: request.user.id, actorPublicId: request.user.publicId, action: 'payment_method.created', targetId: method._id, createdAt: now }, { session })
      })
    } catch (error) {
      if (error?.code === 11000) throw httpError(409, 'Phương thức mặc định vừa được thay đổi. Hãy tải lại và thử lại.')
      throw error
    }
    return reply.code(201).send({ method: { ...publicPaymentMethod(method), updatedAt: now.toISOString() } })
  })

  app.patch('/api/admin/payment-methods/:id', { preHandler: app.requireAdmin }, async (request) => {
    const existing = await paymentMethods.findOne({ _id: request.params.id })
    if (!existing) throw httpError(404, 'Không tìm thấy phương thức thanh toán.')
    const normalized = normalizePaymentMethod(request.body, existing)
    const next = await persistPaymentMethodImage(request.user.id, normalized, existing)
    const now = new Date()
    try {
      await connection.withTransaction(async (session) => {
        if (next.isDefault) await paymentMethods.updateMany({ _id: { $ne: existing._id } }, { $set: { isDefault: false } }, { session })
        await paymentMethods.updateOne({ _id: existing._id }, {
          $set: { ...next, updatedAt: now, updatedBy: request.user.id },
          $unset: { qrImage: '', qrImageContentType: '' },
        }, { session })
        await adminAuditLogs.insertOne({ _id: randomUUID(), actorUserId: request.user.id, actorPublicId: request.user.publicId, action: 'payment_method.updated', targetId: existing._id, changedFields: Object.keys(request.body), createdAt: now }, { session })
      })
    } catch (error) {
      if (error?.code === 11000) throw httpError(409, 'Phương thức mặc định vừa được thay đổi. Hãy tải lại và thử lại.')
      throw error
    }
    return { method: { ...publicPaymentMethod({ ...existing, ...next, _id: existing._id }), updatedAt: now.toISOString() } }
  })

  app.get('/api/admin/topup-packages', { preHandler: app.requireAdmin }, async () => {
    const [packages, purchases] = await Promise.all([
      topupPackages.find({}).sort({ displayOrder: 1, createdAt: 1 }).toArray(),
      depositRequests.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$packageSnapshot.packageId', purchases: { $sum: 1 }, revenueVnd: { $sum: '$packageSnapshot.priceVnd' } } },
      ]).toArray(),
    ])
    const byPackage = new Map(purchases.map((item) => [item._id, item]))
    return { coinPriceVnd: COIN_PRICE_VND, packages: packages.map((item) => ({
      id: item._id, name: item.name, priceVnd: item.priceVnd, coins: Math.floor(item.priceVnd / COIN_PRICE_VND), bonusCoins: item.bonusCoins,
      enabled: item.enabled, displayOrder: item.displayOrder, purchases: byPackage.get(item._id)?.purchases ?? 0,
      revenueVnd: byPackage.get(item._id)?.revenueVnd ?? 0, createdAt: item.createdAt?.toISOString?.() ?? '', updatedAt: item.updatedAt?.toISOString?.() ?? '',
    })) }
  })

  app.post('/api/admin/topup-packages', { preHandler: app.requireAdmin }, async (request, reply) => {
    const now = new Date()
    const item = { _id: randomUUID(), ...normalizeTopupPackage(request.body), createdAt: now, updatedAt: now, updatedBy: request.user.id }
    await topupPackages.insertOne(item)
    await adminAuditLogs.insertOne({ _id: randomUUID(), actorUserId: request.user.id, actorPublicId: request.user.publicId, action: 'topup_package.created', targetId: item._id, createdAt: now })
    return reply.code(201).send({ package: {
      id: item._id, name: item.name, priceVnd: item.priceVnd, coins: item.coins,
      bonusCoins: item.bonusCoins, enabled: item.enabled, displayOrder: item.displayOrder,
    } })
  })

  app.patch('/api/admin/topup-packages/:id', { preHandler: app.requireAdmin }, async (request) => {
    const existing = await topupPackages.findOne({ _id: request.params.id })
    if (!existing) throw httpError(404, 'Không tìm thấy gói nạp.')
    const next = normalizeTopupPackage(request.body, existing)
    const now = new Date()
    await topupPackages.updateOne({ _id: existing._id }, { $set: { ...next, updatedAt: now, updatedBy: request.user.id } })
    await adminAuditLogs.insertOne({ _id: randomUUID(), actorUserId: request.user.id, actorPublicId: request.user.publicId, action: 'topup_package.updated', targetId: existing._id, changedFields: Object.keys(request.body), createdAt: now })
    return { package: { id: existing._id, ...next, updatedAt: now.toISOString() } }
  })

  app.get('/api/wallet/topup-options', { preHandler: app.requireAuth }, async () => {
    const [methods, packages] = await Promise.all([
      paymentMethods.find({ enabled: true, isDefault: true }).sort({ createdAt: -1 }).toArray(),
      topupPackages.find({ enabled: true }).sort({ displayOrder: 1, createdAt: 1 }).toArray(),
    ])
    return {
      coinPriceVnd: COIN_PRICE_VND,
      paymentMethods: methods.map(publicPaymentMethod),
      packages: packages.map((item) => ({
        id: item._id, name: item.name, priceVnd: item.priceVnd,
        coins: Math.floor(item.priceVnd / COIN_PRICE_VND), bonusCoins: item.bonusCoins,
      })),
    }
  })

  const serializeDeposit = (item, { payment = false, receipt = false } = {}) => {
    const paymentProofImage = receipt
      ? resolveStoredImageRef(item, {
        mediaIdField: 'paymentProofMediaId',
        legacyField: 'paymentProofImage',
        legacyAltField: 'receipt',
      })
      : ''
    return {
      id: item._id,
      code: item.code,
      package: item.packageSnapshot,
      ...(payment ? {
        paymentMethod: {
          ...item.paymentSnapshot,
          paymentQrImage: resolveStoredImageRef(item.paymentSnapshot ?? {}, {
            mediaIdField: 'paymentQrMediaId',
            legacyField: 'paymentQrImage',
            legacyAltField: 'qrImage',
          }),
          name: item.paymentSnapshot.name ?? item.paymentSnapshot.bankName,
          bankBin: item.paymentSnapshot.bankBin ?? '',
        },
      } : {}),
      status: item.status,
      ...(receipt && paymentProofImage ? { paymentProofImage } : {}),
      rejectionReason: item.rejectionReason ?? '',
      cancellationReason: item.cancellationReason ?? '',
      reviewMessage: item.reviewMessage ?? '',
      bankReference: item.bankReference ?? '',
      createdAt: item.createdAt?.toISOString?.() ?? '',
      expiresAt: (item.expiresAt ?? new Date(item.createdAt.getTime() + DEPOSIT_PAYMENT_TTL_MS)).toISOString(),
      paymentProofUploadedAt: (item.paymentProofUploadedAt ?? item.receiptUploadedAt)?.toISOString?.() ?? '',
      confirmedAt: item.confirmedAt?.toISOString?.() ?? '',
      reviewedAt: item.reviewedAt?.toISOString?.() ?? '',
      history: (item.history ?? []).map((entry) => ({
        status: entry.status,
        createdAt: entry.createdAt?.toISOString?.() ?? '',
        reason: entry.reason ?? '',
      })),
    }
  }

  function depositHasReceipt(item) {
    return Boolean(item?.paymentProofMediaId)
      || (typeof item?.paymentProofImage === 'string' && item.paymentProofImage.length > 0)
      || (typeof item?.receipt === 'string' && item.receipt.length > 0)
  }

  app.post('/api/wallet/deposits', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'packageId')
      || typeof body.packageId !== 'string') throw httpError(400, 'Gói nạp không hợp lệ.')
    const now = new Date()
    await expireUnpaidDeposits(request.user.id, now)
    const activeDeposit = await depositRequests.findOne({
      $or: [
        { activeDepositUserId: request.user.id },
        { userId: request.user.id, status: { $in: ['awaiting_payment', 'awaiting_review', 'info_requested'] } },
      ],
    }, { sort: { createdAt: -1 } })
    if (activeDeposit) {
      if (!activeDeposit.activeDepositUserId) {
        try {
          await depositRequests.updateOne({ _id: activeDeposit._id, activeDepositUserId: { $exists: false } }, {
            $set: { activeDepositUserId: request.user.id },
          })
        } catch (error) {
          if (error?.code !== 11000) throw error
        }
      }
      const currentActive = activeDeposit.activeDepositUserId
        ? activeDeposit
        : await depositRequests.findOne({ activeDepositUserId: request.user.id }) ?? activeDeposit
      return reply.send({ deposit: serializeDeposit(currentActive, { payment: true }) })
    }
    const [packageData, method] = await Promise.all([
      topupPackages.findOne({ _id: body.packageId, enabled: true }),
      paymentMethods.findOne({ enabled: true, isDefault: true }),
    ])
    if (!packageData) throw httpError(404, 'Gói nạp không khả dụng.')
    if (!method) throw httpError(503, 'Hiện chưa có phương thức thanh toán QR đang bật.')
    const id = randomUUID()
    let item
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createTransactionCode('LFN')
      const transferContent = method.transferTemplate.replaceAll('{code}', code)
      item = {
        _id: id,
        code,
        userId: request.user.id,
        activeDepositUserId: request.user.id,
        packageSnapshot: {
          packageId: packageData._id,
          name: packageData.name,
          priceVnd: packageData.priceVnd,
          coins: Math.floor(packageData.priceVnd / COIN_PRICE_VND),
          bonusCoins: packageData.bonusCoins,
        },
        paymentSnapshot: {
          paymentMethodId: method._id,
          name: method.name ?? method.bankName,
          bankName: method.bankName,
          bankCode: method.bankCode,
          bankBin: method.bankBin ?? '',
          accountHolder: method.accountHolder,
          accountNumber: method.accountNumber,
          paymentQrImage: method.paymentQrImage ?? method.qrImage,
          transferContent,
          instructions: method.instructions,
        },
        status: 'awaiting_payment',
        expiresAt: new Date(now.getTime() + DEPOSIT_PAYMENT_TTL_MS),
        history: [{ status: 'awaiting_payment', actorUserId: request.user.id, createdAt: now }],
        createdAt: now,
      }
      try {
        await connection.withTransaction(async (session) => {
          await reserveTransactionCode(code, 'deposit', id, now, session)
          await depositRequests.insertOne(item, { session })
        })
        break
      } catch (error) {
        if (error?.code !== 11000) throw error
        if (await transactionCodes.findOne({ code })) continue
        const existing = await depositRequests.findOne({
          $or: [
            { activeDepositUserId: request.user.id },
            { userId: request.user.id, status: { $in: ['awaiting_payment', 'awaiting_review', 'info_requested'] } },
          ],
        }, { sort: { createdAt: -1 } })
        if (existing) return reply.send({ deposit: serializeDeposit(existing, { payment: true }) })
        throw error
      }
    }
    if (!item || !await depositRequests.findOne({ _id: id })) throw httpError(503, 'Không thể tạo mã giao dịch duy nhất. Vui lòng thử lại.')
    return reply.code(201).send({ deposit: serializeDeposit(item, { payment: true }) })
  })

  app.post('/api/wallet/deposits/:id/receipt', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig(30) },
  }, async (request) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 1 || typeof body.paymentProofImage !== 'string') throw httpError(400, 'Ảnh chứng từ không hợp lệ.')
    parseImageDataUrl(body.paymentProofImage, MAX_PAYMENT_IMAGE_BYTES)
    const now = new Date()
    await expireUnpaidDeposits(request.user.id, now)
    const current = await depositRequests.findOne({
      _id: request.params.id,
      userId: request.user.id,
      status: { $in: ['awaiting_payment', 'info_requested'] },
      ...depositPaymentWindowFilter(now),
    })
    if (!current) throw httpError(409, 'Yêu cầu này không nhận thêm chứng từ ở trạng thái hiện tại.')
    const uploaded = await mediaService.uploadFromDataUrl(request.user.id, body.paymentProofImage, {
      category: 'deposit_proof',
      replaceMediaId: current.paymentProofMediaId ?? null,
      maxBytes: MAX_PAYMENT_IMAGE_BYTES,
    })
    const updated = await depositRequests.findOneAndUpdate({
      _id: current._id,
      userId: request.user.id,
      status: { $in: ['awaiting_payment', 'info_requested'] },
    }, {
      $set: {
        paymentProofMediaId: uploaded._id,
        paymentProofContentType: `image/${uploaded.format}`,
        paymentProofUploadedAt: now,
      },
      $push: { history: { status: 'receipt_uploaded', actorUserId: request.user.id, createdAt: now } },
      $unset: {
        reviewMessage: '',
        receipt: '',
        receiptContentType: '',
        receiptUploadedAt: '',
        paymentProofImage: '',
      },
    }, { returnDocument: 'after' })
    if (!updated) {
      await mediaService.deleteOwnedMedia(uploaded._id, request.user).catch(() => undefined)
      throw httpError(409, 'Yêu cầu này không nhận thêm chứng từ ở trạng thái hiện tại.')
    }
    return {
      uploaded: true,
      paymentProofUploadedAt: now.toISOString(),
      paymentProofImage: mediaContentPath(uploaded._id),
      mediaId: uploaded._id,
    }
  })

  app.delete('/api/wallet/deposits/:id/receipt', { preHandler: app.requireAuth }, async (request) => {
    const now = new Date()
    await expireUnpaidDeposits(request.user.id, now)
    const current = await depositRequests.findOne({
      _id: request.params.id,
      userId: request.user.id,
      status: { $in: ['awaiting_payment', 'info_requested'] },
      ...depositPaymentWindowFilter(now),
    })
    if (!current) throw httpError(409, 'Không thể xóa chứng từ ở trạng thái hiện tại.')
    const previousMediaId = current.paymentProofMediaId
    const updated = await depositRequests.findOneAndUpdate({
      _id: current._id,
      userId: request.user.id,
      status: { $in: ['awaiting_payment', 'info_requested'] },
    }, {
      $unset: {
        paymentProofImage: '', paymentProofContentType: '', paymentProofUploadedAt: '',
        paymentProofMediaId: '',
        receipt: '', receiptContentType: '', receiptUploadedAt: '',
      },
    }, { returnDocument: 'after' })
    if (!updated) throw httpError(409, 'Không thể xóa chứng từ ở trạng thái hiện tại.')
    if (previousMediaId) {
      await mediaService.deleteOwnedMedia(previousMediaId, request.user).catch(() => undefined)
    }
    return { removed: true }
  })

  app.post('/api/wallet/deposits/:id/confirm', { preHandler: app.requireAuth }, async (request) => {
    const now = new Date()
    await expireUnpaidDeposits(request.user.id, now)
    const updated = await depositRequests.findOneAndUpdate({
      _id: request.params.id,
      userId: request.user.id,
      status: { $in: ['awaiting_payment', 'info_requested'] },
      $or: [
        { paymentProofMediaId: { $type: 'string' } },
        { paymentProofImage: { $type: 'string' } },
        { receipt: { $type: 'string' } },
      ],
      $and: [
        depositPaymentWindowFilter(now),
        {
          $or: [
            { paymentProofUploadedAt: { $type: 'date' } },
            { receiptUploadedAt: { $type: 'date' } },
          ],
        },
      ],
    }, {
      $set: { status: 'awaiting_review', confirmedAt: now },
      $push: { history: { status: 'awaiting_review', actorUserId: request.user.id, createdAt: now } },
    }, { returnDocument: 'after' })
    if (!updated) {
      const current = await depositRequests.findOne({
        _id: request.params.id,
        userId: request.user.id,
        status: 'awaiting_review',
      })
      if (current) return { deposit: serializeDeposit(current) }
      throw httpError(409, 'Hãy tải chứng từ hợp lệ lên trước khi gửi yêu cầu xác nhận.')
    }
    return { deposit: serializeDeposit(updated) }
  })

  app.get('/api/wallet/deposits', { preHandler: app.requireAuth }, async (request) => {
    await expireUnpaidDeposits(request.user.id)
    const items = await depositRequests.find({ userId: request.user.id }).sort({ createdAt: -1 }).limit(100).toArray()
    return { deposits: items.map((item) => serializeDeposit(item)) }
  })

  app.get('/api/wallet/deposits/:id', { preHandler: app.requireAuth }, async (request) => {
    await expireUnpaidDeposits(request.user.id)
    const item = await depositRequests.findOne({ _id: request.params.id, userId: request.user.id })
    if (!item) throw httpError(404, 'Không tìm thấy yêu cầu nạp tiền.')
    return { deposit: serializeDeposit(item, { payment: true, receipt: true }) }
  })

  const serializeWithdrawal = (item, includeBankDetails = false) => ({
    id: item._id,
    code: item.code,
    status: item.status,
    coins: item.coins,
    amountVnd: item.amountVnd,
    feeVnd: item.feeVnd,
    receiveAmountVnd: item.receiveAmountVnd,
    bankAccount: {
      bankName: item.bankSnapshot.bankName,
      bankShortName: item.bankSnapshot.bankShortName,
      accountName: includeBankDetails ? decryptBankAccountValue(item.bankSnapshot.accountNameEncrypted) : '',
      accountNumber: includeBankDetails ? decryptBankAccountValue(item.bankSnapshot.accountNumberEncrypted) : `••••${item.bankSnapshot.accountLastFour}`,
      accountLastFour: item.bankSnapshot.accountLastFour,
    },
    reason: item.reason ?? '',
    bankReference: item.bankReference ?? '',
    createdAt: item.createdAt?.toISOString?.() ?? '',
    updatedAt: item.updatedAt?.toISOString?.() ?? '',
    reviewedAt: item.reviewedAt?.toISOString?.() ?? '',
    history: (item.history ?? []).map((entry) => ({
      status: entry.status,
      createdAt: entry.createdAt?.toISOString?.() ?? '',
      reason: entry.reason ?? '',
      actor: entry.actorPublicId ?? '',
    })),
  })

  app.post('/api/wallet/withdrawals', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig(10) },
  }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['bankAccountId', 'coins'].includes(key))
      || typeof body.bankAccountId !== 'string'
      || !Number.isSafeInteger(body.coins) || body.coins < WITHDRAWAL_MIN_COINS || body.coins > 1_000_000_000) {
      throw httpError(400, `Yêu cầu rút cần tài khoản đã xác minh và từ ${WITHDRAWAL_MIN_COINS} xu trở lên.`)
    }
    if (!accountEncryptionKey) {
      app.log.error({ reason: 'missing_bank_account_encryption_key' }, 'Withdrawal requests are unavailable because account encryption is not configured')
      throw httpError(503, 'Hiện chưa thể tạo yêu cầu rút tiền. Vui lòng thử lại sau.')
    }
    const user = await users.findOne({ _id: request.user.id }, { projection: { accountStatus: 1, role: 1 } })
    if (!user || user.role === 'admin' || user.accountStatus === 'locked') throw httpError(403, 'Tài khoản này không thể tạo yêu cầu rút tiền.')
    const linkedAccount = await bankAccounts.findOne({
      _id: body.bankAccountId,
      userId: request.user.id,
      verifiedAt: { $type: 'date' },
    })
    if (!linkedAccount) throw httpError(400, 'Hãy chọn tài khoản ngân hàng đã xác minh thuộc tài khoản của bạn.')
    const now = new Date()
    const id = randomUUID()
    const amountVnd = body.coins * COIN_PRICE_VND
    if (!Number.isSafeInteger(amountVnd)) throw httpError(400, 'Số tiền quy đổi vượt giới hạn.')
    const bankSnapshot = {
      bankName: linkedAccount.bankName,
      bankShortName: linkedAccount.bankShortName,
      bankBin: linkedAccount.bankBin,
      accountLastFour: linkedAccount.accountLastFour,
      accountNameEncrypted: linkedAccount.accountNameEncrypted,
      accountNumberEncrypted: linkedAccount.accountNumberEncrypted,
    }
    let withdrawal
    let result
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createTransactionCode('LFR')
      withdrawal = {
        _id: id,
        code,
        userId: request.user.id,
        bankAccountId: linkedAccount._id,
        bankSnapshot,
        coins: body.coins,
        amountVnd,
        feeVnd: 0,
        receiveAmountVnd: amountVnd,
        status: 'pending_review',
        history: [{ status: 'pending_review', actorUserId: request.user.id, actorPublicId: request.user.publicId, createdAt: now }],
        createdAt: now,
        updatedAt: now,
      }
      try {
        result = await connection.withTransaction(async (session) => {
          const account = await getOrCreateWalletAccount(request.user.id, session, now)
          if (account.balance < body.coins) return { error: 'Số dư khả dụng không đủ để rút xu.', statusCode: 409 }
          await reserveTransactionCode(code, 'withdrawal', id, now, session)
          const held = await walletAccounts.updateOne(
            { _id: account._id, balance: { $gte: body.coins } },
            { $inc: { balance: -body.coins }, $set: { updatedAt: now } },
            { session },
          )
          if (!held.matchedCount) return { error: 'Số dư vừa thay đổi. Vui lòng tải lại Ví và thử lại.', statusCode: 409 }
          await withdrawalRequests.insertOne(withdrawal, { session })
          await walletTransactions.insertOne({
            _id: `withdrawal:${id}:hold`,
            transactionCode: code,
            transactionType: 'withdrawal',
            withdrawalRequestId: id,
            userId: request.user.id,
            description: `Giữ xu cho yêu cầu rút ${code}`,
            amount: -body.coins,
            createdAt: now,
          }, { session })
          await notifications.insertOne({
            _id: randomUUID(),
            userId: request.user.id,
            type: 'withdrawal_created',
            title: 'Đã gửi yêu cầu rút tiền',
            message: `Yêu cầu ${code} đang chờ Admin xử lý.`,
            createdAt: now,
            readAt: '',
          }, { session })
          const admins = await users.find({ role: 'admin' }, { projection: { _id: 1 }, session }).toArray()
          if (admins.length) await notifications.insertMany(admins.map((admin) => ({
            _id: randomUUID(),
            userId: admin._id,
            actorUserId: request.user.id,
            type: 'withdrawal_requested',
            title: 'Có yêu cầu rút tiền mới',
            message: `Yêu cầu ${code} đang chờ xử lý.`,
            createdAt: now,
            readAt: '',
          })), { session })
          return { withdrawal }
        })
        if (result.error) throw httpError(result.statusCode, result.error)
        return reply.code(201).send({ withdrawal: serializeWithdrawal(result.withdrawal, true) })
      } catch (error) {
        if (error?.code !== 11000) throw error
        if (await transactionCodes.findOne({ code })) continue
        throw error
      }
    }
    throw httpError(503, 'Không thể tạo mã rút tiền duy nhất. Vui lòng thử lại.')
  })

  app.get('/api/wallet/withdrawals', { preHandler: app.requireAuth }, async (request) => {
    const items = await withdrawalRequests.find({ userId: request.user.id }).sort({ createdAt: -1 }).limit(100).toArray()
    return { withdrawals: items.map((item) => serializeWithdrawal(item, true)) }
  })

  app.get('/api/wallet/withdrawals/:id', { preHandler: app.requireAuth }, async (request) => {
    const item = await withdrawalRequests.findOne({ _id: request.params.id, userId: request.user.id })
    if (!item) throw httpError(404, 'Không tìm thấy yêu cầu rút tiền.')
    return { withdrawal: serializeWithdrawal(item, true) }
  })

  app.post('/api/wallet/withdrawals/:id/cancel', { preHandler: app.requireAuth }, async (request) => {
    const now = new Date()
    const result = await connection.withTransaction(async (session) => {
      const item = await withdrawalRequests.findOne({
        _id: request.params.id,
        userId: request.user.id,
        status: 'pending_review',
      }, { session })
      if (!item) return { error: 'Chỉ có thể hủy yêu cầu đang chờ Admin duyệt.', statusCode: 409 }
      const changed = await withdrawalRequests.updateOne({ _id: item._id, status: 'pending_review' }, {
        $set: { status: 'cancelled', updatedAt: now, reviewedAt: now },
        $push: { history: { status: 'cancelled', actorUserId: request.user.id, actorPublicId: request.user.publicId, createdAt: now } },
      }, { session })
      if (!changed.modifiedCount) return { error: 'Yêu cầu vừa được xử lý. Hãy tải lại danh sách.', statusCode: 409 }
      const account = await walletAccounts.findOne({ userId: item.userId }, { session })
      if (!account) throw httpError(500, 'Không tìm thấy ví cần giải phóng số dư.')
      await walletAccounts.updateOne({ _id: account._id }, { $inc: { balance: item.coins }, $set: { updatedAt: now } }, { session })
      await walletTransactions.insertOne({
        _id: `withdrawal:${item._id}:release`,
        transactionCode: item.code,
        transactionType: 'withdrawal_release',
        withdrawalRequestId: item._id,
        userId: item.userId,
        description: `Hoàn giữ xu cho yêu cầu ${item.code}`,
        amount: item.coins,
        createdAt: now,
      }, { session })
      await notifications.insertOne({
        _id: randomUUID(),
        userId: item.userId,
        type: 'withdrawal_cancelled',
        title: 'Yêu cầu rút tiền đã hủy',
        message: `Yêu cầu ${item.code} đã hủy và xu được trả lại Ví.`,
        createdAt: now,
        readAt: '',
      }, { session })
      return { withdrawal: { ...item, status: 'cancelled', updatedAt: now } }
    })
    if (result.error) throw httpError(result.statusCode, result.error)
    return { withdrawal: serializeWithdrawal(result.withdrawal, true) }
  })

  app.get('/api/admin/withdrawals', { preHandler: app.requireAdmin }, async (request) => {
    const status = typeof request.query?.status === 'string' ? request.query.status : 'all'
    const from = request.query?.from
    const to = request.query?.to
    const search = typeof request.query?.search === 'string' ? request.query.search.trim().slice(0, 100) : ''
    if (!['all', 'pending_review', 'approved', 'processing', 'paid', 'rejected', 'cancelled', 'failed'].includes(status)) {
      throw httpError(400, 'Trạng thái yêu cầu rút không hợp lệ.')
    }
    if (from !== undefined && !isDate(from) || to !== undefined && !isDate(to)
      || from && to && from > to) throw httpError(400, 'Khoảng ngày lọc yêu cầu rút không hợp lệ.')
    const filter = status === 'all' ? {} : { status }
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`)
      if (to) filter.createdAt.$lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000)
    }
    if (search) {
      const matchingUsers = await users.find({
        $or: [
          { publicId: { $regex: escapeRegExp(search), $options: 'i' } },
          { displayName: { $regex: escapeRegExp(search), $options: 'i' } },
          { email: { $regex: escapeRegExp(search), $options: 'i' } },
        ],
      }, { projection: { _id: 1 } }).limit(500).toArray()
      filter.$or = [
        { code: { $regex: escapeRegExp(search), $options: 'i' } },
        { userId: { $in: matchingUsers.map((user) => user._id) } },
      ]
    }
    const items = await withdrawalRequests.find(filter).sort({ createdAt: -1 }).limit(500).toArray()
    const accounts = await users.find({ _id: { $in: [...new Set(items.map((item) => item.userId))] } }, {
      projection: { _id: 1, publicId: 1, displayName: 1, email: 1 },
    }).toArray()
    const accountById = new Map(accounts.map((account) => [account._id, account]))
    return {
      withdrawals: items.map((item) => ({
        ...serializeWithdrawal(item, true),
        user: {
          id: item.userId,
          publicId: accountById.get(item.userId)?.publicId ?? '',
          displayName: accountById.get(item.userId)?.displayName ?? 'Người dùng',
          email: accountById.get(item.userId)?.email ?? '',
        },
      })),
    }
  })

  app.patch('/api/admin/withdrawals/:id', { preHandler: app.requireAdmin }, async (request) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['action', 'reason', 'bankReference'].includes(key))
      || !['approve', 'reject', 'processing', 'paid', 'failed'].includes(body.action)) {
      throw httpError(400, 'Thông tin xử lý yêu cầu rút không hợp lệ.')
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const bankReference = typeof body.bankReference === 'string' ? body.bankReference.trim() : ''
    if (['reject', 'failed'].includes(body.action) && (reason.length < 3 || reason.length > 500)) {
      throw httpError(400, 'Cần ghi lý do từ 3 đến 500 ký tự.')
    }
    if (body.action === 'paid' && (!bankReference || bankReference.length > 120)) {
      throw httpError(400, 'Cần mã tham chiếu ngân hàng để xác nhận đã chuyển tiền.')
    }
    const now = new Date()
    const result = await connection.withTransaction(async (session) => {
      const item = await withdrawalRequests.findOne({ _id: request.params.id }, { session })
      if (!item) return { error: 'Không tìm thấy yêu cầu rút tiền.', statusCode: 404 }
      const transitions = {
        approve: { from: ['pending_review'], to: 'approved' },
        reject: { from: ['pending_review', 'approved'], to: 'rejected' },
        processing: { from: ['approved'], to: 'processing' },
        paid: { from: ['processing'], to: 'paid' },
        failed: { from: ['approved', 'processing'], to: 'failed' },
      }
      const transition = transitions[body.action]
      if (!transition.from.includes(item.status)) return { error: 'Yêu cầu không thể chuyển sang trạng thái đã chọn.', statusCode: 409 }
      const changed = await withdrawalRequests.updateOne({ _id: item._id, status: item.status }, {
        $set: {
          status: transition.to,
          updatedAt: now,
          reviewedAt: now,
          reviewedBy: request.user.id,
          ...(reason ? { reason } : {}),
          ...(body.action === 'paid' ? { bankReference } : {}),
        },
        $push: { history: { status: transition.to, actorUserId: request.user.id, actorPublicId: request.user.publicId, reason, createdAt: now } },
      }, { session })
      if (!changed.modifiedCount) return { error: 'Yêu cầu vừa được xử lý bởi một quản trị viên khác.', statusCode: 409 }
      if (['reject', 'failed'].includes(body.action)) {
        const account = await walletAccounts.findOne({ userId: item.userId }, { session })
        if (!account) throw httpError(500, 'Không tìm thấy ví cần giải phóng số dư.')
        await walletAccounts.updateOne({ _id: account._id }, { $inc: { balance: item.coins }, $set: { updatedAt: now } }, { session })
        await walletTransactions.insertOne({
          _id: `withdrawal:${item._id}:release`,
          transactionCode: item.code,
          transactionType: 'withdrawal_release',
          withdrawalRequestId: item._id,
          userId: item.userId,
          description: `Hoàn giữ xu cho yêu cầu ${item.code}`,
          amount: item.coins,
          createdAt: now,
        }, { session })
      }
      await notifications.insertOne({
        _id: randomUUID(),
        userId: item.userId,
        actorUserId: request.user.id,
        type: `withdrawal_${transition.to}`,
        title: `Yêu cầu rút tiền: ${transition.to}`,
        message: `${item.code}: ${reason || (body.action === 'paid' ? `Đã chuyển tiền. Mã ngân hàng: ${bankReference}` : 'Trạng thái đã được cập nhật.')}`,
        createdAt: now,
        readAt: '',
      }, { session })
      await adminAuditLogs.insertOne({
        _id: randomUUID(),
        actorUserId: request.user.id,
        actorPublicId: request.user.publicId,
        action: `withdrawal.${transition.to}`,
        targetId: item._id,
        reason,
        bankReference: body.action === 'paid' ? bankReference : '',
        createdAt: now,
      }, { session })
      return { withdrawal: { ...item, status: transition.to, updatedAt: now, reviewedAt: now, reason, bankReference } }
    })
    if (result.error) throw httpError(result.statusCode, result.error)
    return { withdrawal: serializeWithdrawal(result.withdrawal, true) }
  })

  app.get('/api/admin/deposits', { preHandler: app.requireAdmin }, async (request) => {
    await expireUnpaidDeposits()
    const status = typeof request.query?.status === 'string' ? request.query.status : 'all'
    const search = typeof request.query?.search === 'string' ? request.query.search.trim().slice(0, 100) : ''
    const from = request.query?.from
    const to = request.query?.to
    const amountMin = request.query?.amountMin === undefined ? undefined : Number(request.query.amountMin)
    const amountMax = request.query?.amountMax === undefined ? undefined : Number(request.query.amountMax)
    if (!['all', 'awaiting_payment', 'awaiting_review', 'info_requested', 'approved', 'rejected', 'cancelled'].includes(status)) throw httpError(400, 'Trạng thái yêu cầu nạp không hợp lệ.')
    if (from !== undefined && !isDate(from) || to !== undefined && !isDate(to)) throw httpError(400, 'Khoảng ngày không hợp lệ.')
    if (from && to && from > to) throw httpError(400, 'Ngày bắt đầu không thể sau ngày kết thúc.')
    if (amountMin !== undefined && (!Number.isSafeInteger(amountMin) || amountMin < 0)
      || amountMax !== undefined && (!Number.isSafeInteger(amountMax) || amountMax < 0)
      || amountMin !== undefined && amountMax !== undefined && amountMin > amountMax) {
      throw httpError(400, 'Khoảng số tiền không hợp lệ.')
    }
    const filter = status === 'all' ? {} : { status }
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`)
      if (to) filter.createdAt.$lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000)
    }
    if (amountMin !== undefined || amountMax !== undefined) {
      filter['packageSnapshot.priceVnd'] = {}
      if (amountMin !== undefined) filter['packageSnapshot.priceVnd'].$gte = amountMin
      if (amountMax !== undefined) filter['packageSnapshot.priceVnd'].$lte = amountMax
    }
    const items = await depositRequests.find(filter).sort({ createdAt: -1 }).limit(500).toArray()
    const accountIds = [...new Set(items.flatMap((item) => [
      item.userId,
      item.reviewedBy,
      ...(item.history ?? []).map((entry) => entry.actorUserId),
    ]).filter(Boolean))]
    const accounts = await users.find({ _id: { $in: accountIds } }, { projection: { _id: 1, publicId: 1, displayName: 1, email: 1 } }).toArray()
    const usersById = new Map(accounts.map((account) => [account._id, account]))
    const deposits = items.filter((item) => {
      if (!search) return true
      const account = usersById.get(item.userId)
      const needle = search.toLowerCase()
      return item.code.toLowerCase().includes(needle)
        || String(account?.publicId ?? '').includes(search)
        || String(account?.displayName ?? '').toLowerCase().includes(needle)
        || String(account?.email ?? '').toLowerCase().includes(needle)
    }).map((item) => ({
      ...serializeDeposit(item, { payment: true, receipt: true }),
      history: (item.history ?? []).map((entry) => {
        const actor = usersById.get(entry.actorUserId)
        return {
          status: entry.status,
          createdAt: entry.createdAt?.toISOString?.() ?? '',
          reason: entry.reason ?? '',
          actor: actor ? { publicId: actor.publicId ?? '', displayName: actor.displayName ?? 'Admin' } : null,
        }
      }),
      reviewedBy: usersById.get(item.reviewedBy)
        ? { publicId: usersById.get(item.reviewedBy).publicId ?? '', displayName: usersById.get(item.reviewedBy).displayName ?? 'Admin' }
        : null,
      user: {
        publicId: usersById.get(item.userId)?.publicId ?? '',
        displayName: usersById.get(item.userId)?.displayName ?? 'Người dùng',
        email: usersById.get(item.userId)?.email ?? '',
      },
    }))
    return { deposits }
  })

  app.patch('/api/admin/deposits/:id', { preHandler: app.requireAdmin }, async (request) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['action', 'reason', 'verifiedReceived', 'receivedAmountVnd', 'bankReference'].includes(key))) {
      throw httpError(400, 'Thông tin xử lý yêu cầu nạp không hợp lệ.')
    }
    if (!['approve', 'reject', 'needs_info'].includes(body.action)) throw httpError(400, 'Hành động xử lý không hợp lệ.')
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (body.action !== 'approve' && (reason.length < 3 || reason.length > 500)) throw httpError(400, 'Cần ghi lý do từ 3 đến 500 ký tự.')
    if (body.action === 'approve' && (body.verifiedReceived !== true
      || !Number.isSafeInteger(body.receivedAmountVnd)
      || typeof body.bankReference !== 'string' || !body.bankReference.trim() || body.bankReference.trim().length > 120)) {
      throw httpError(400, 'Để duyệt, hãy xác nhận đã đối chiếu tiền thực nhận, số tiền và mã tham chiếu ngân hàng.')
    }
    const now = new Date()
    const result = await connection.withTransaction(async (session) => {
      const item = await depositRequests.findOne({ _id: request.params.id }, { session })
      if (!item || !['awaiting_payment', 'awaiting_review', 'info_requested'].includes(item.status)
        || body.action !== 'reject' && item.status === 'awaiting_payment') {
        return { error: 'Yêu cầu này không còn chờ xử lý.', statusCode: 409 }
      }
      if (body.action === 'approve' && (!depositHasReceipt(item)
        || !(item.paymentProofUploadedAt ?? item.receiptUploadedAt))) {
        return { error: 'Người dùng chưa tải chứng từ chuyển khoản.', statusCode: 409 }
      }
      if (body.action === 'approve' && body.receivedAmountVnd !== item.packageSnapshot.priceVnd) {
        return { error: 'Số tiền thực nhận không khớp số tiền của yêu cầu.', statusCode: 409 }
      }
      const nextStatus = body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : 'info_requested'
      if (body.action === 'approve') {
        const creditedCoins = item.packageSnapshot.coins + item.packageSnapshot.bonusCoins
        let account = await walletAccounts.findOne({ userId: item.userId }, { session })
        if (!account) {
          const [ledger] = await walletTransactions.aggregate([
            { $match: { userId: item.userId } },
            { $group: { _id: null, balance: { $sum: '$amount' } } },
          ], { session }).toArray()
          account = { _id: randomUUID(), userId: item.userId, balance: ledger?.balance ?? 0, updatedAt: now }
          await walletAccounts.insertOne(account, { session })
        }
        await walletAccounts.updateOne({ _id: account._id }, { $inc: { balance: creditedCoins }, $set: { updatedAt: now } }, { session })
        await walletTransactions.insertOne({
          _id: `deposit:${item._id}`,
          transactionCode: item.code,
          transactionType: 'deposit',
          userId: item.userId,
          description: `Nạp xu: ${item.packageSnapshot.name}`,
          amount: creditedCoins,
          depositRequestId: item._id,
          reference: body.bankReference.trim(),
          createdAt: now,
        }, { session })
      }
      const stateChange = await depositRequests.updateOne({ _id: item._id, status: item.status }, {
        $set: {
          status: nextStatus,
          reviewedAt: now,
          reviewedBy: request.user.id,
          ...(body.action === 'approve' ? {
            bankReference: body.bankReference.trim(),
            receivedAmountVnd: body.receivedAmountVnd,
            creditedCoins: item.packageSnapshot.coins + item.packageSnapshot.bonusCoins,
          } : {}),
          ...(body.action === 'reject' ? { rejectionReason: reason } : {}),
          ...(body.action === 'needs_info' ? { reviewMessage: reason } : {}),
        },
        ...(body.action === 'approve' || body.action === 'reject' ? { $unset: { activeDepositUserId: '' } } : {}),
        ...(body.action === 'needs_info' ? { $unset: {
          paymentProofImage: '', paymentProofContentType: '', paymentProofUploadedAt: '',
          receipt: '', receiptContentType: '', receiptUploadedAt: '',
        } } : {}),
        $push: { history: { status: nextStatus, actorUserId: request.user.id, reason, createdAt: now } },
      }, { session })
      if (!stateChange.modifiedCount) throw httpError(409, 'Yêu cầu vừa được xử lý bởi một quản trị viên khác.')
      await adminAuditLogs.insertOne({
        _id: randomUUID(),
        actorUserId: request.user.id,
        actorPublicId: request.user.publicId,
        action: `deposit.${nextStatus}`,
        targetId: item._id,
        reason,
        bankReference: body.action === 'approve' ? body.bankReference.trim() : '',
        createdAt: now,
      }, { session })
      await notifications.insertOne({
        _id: randomUUID(),
        userId: item.userId,
        type: `deposit_${nextStatus}`,
        title: body.action === 'approve' ? 'Yêu cầu nạp tiền đã được xác nhận'
          : body.action === 'reject' ? 'Yêu cầu nạp tiền bị từ chối'
            : 'Yêu cầu nạp tiền cần bổ sung thông tin',
        message: reason,
        createdAt: now,
        readAt: '',
      }, { session })
      return { id: item._id, status: nextStatus }
    })
    if (result.error) throw httpError(result.statusCode, result.error)
    return result
  })

  app.patch('/api/admin/users/:id/status', { preHandler: app.requireAdmin }, async (request) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['status', 'reason'].includes(key))) {
      throw httpError(400, 'Thông tin cập nhật trạng thái không hợp lệ.')
    }
    if (!['active', 'locked'].includes(body.status)) throw httpError(400, 'Trạng thái tài khoản không hợp lệ.')
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (body.status === 'locked' && (reason.length < 3 || reason.length > 500)) {
      throw httpError(400, 'Lý do khóa tài khoản cần có từ 3 đến 500 ký tự.')
    }
    if (body.status === 'active' && reason.length > 500) throw httpError(400, 'Ghi chú tối đa 500 ký tự.')

    const target = await users.findOne({ _id: request.params.id }, {
      projection: { _id: 1, publicId: 1, displayName: 1, email: 1, role: 1, accountStatus: 1 },
    })
    if (!target || target.role === 'admin') throw httpError(404, 'Không tìm thấy tài khoản người dùng phù hợp.')
    const now = new Date()
    await connection.withTransaction(async (session) => {
      const update = body.status === 'locked'
        ? { $set: { accountStatus: 'locked', lockReason: reason, lockedAt: now, lockedBy: request.user.id } }
        : { $set: { accountStatus: 'active' }, $unset: { lockReason: '', lockedAt: '', lockedBy: '' } }
      const changed = await users.updateOne({ _id: target._id, role: { $ne: 'admin' } }, update, { session })
      if (!changed.matchedCount) throw httpError(404, 'Không tìm thấy tài khoản người dùng phù hợp.')
      if (body.status === 'locked') await sessions.deleteMany({ userId: target._id }, { session })
      await adminAuditLogs.insertOne({
        _id: randomUUID(),
        actorUserId: request.user.id,
        actorPublicId: request.user.publicId,
        action: body.status === 'locked' ? 'user.locked' : 'user.unlocked',
        targetUserId: target._id,
        targetPublicId: target.publicId,
        reason: reason || '',
        createdAt: now,
      }, { session })
    })
    return { id: target._id, status: body.status, updatedAt: now.toISOString() }
  })

  app.get('/api/admin/couples', { preHandler: app.requireAdmin }, async (request) => {
    const rawSearch = typeof request.query?.search === 'string' ? request.query.search.trim() : ''
    const search = rawSearch.slice(0, 100)
    const status = typeof request.query?.status === 'string' ? request.query.status : 'all'
    if (!['all', 'connected', 'pending', 'rejected', 'cancelled', 'expired'].includes(status)) {
      throw httpError(400, 'Bộ lọc trạng thái kết nối không hợp lệ.')
    }
    const safeSearch = escapeRegExp(search)
    const userFilter = search ? {
      $or: [
        { publicId: { $regex: safeSearch, $options: 'i' } },
        { displayName: { $regex: safeSearch, $options: 'i' } },
      ],
    } : {}
    const matchingUsers = search
      ? await users.find(userFilter, { projection: { _id: 1 } }).limit(500).toArray()
      : []
    const matchingIds = matchingUsers.map((user) => user._id)
    const relationshipFilter = status === 'all' || status === 'connected'
      ? { ...(search ? { members: { $in: matchingIds } } : {}) }
      : null
    const invitationFilter = status === 'all' || status !== 'connected'
      ? {
        ...(status === 'all' ? {} : { status }),
        ...(search ? { $or: [{ senderUserId: { $in: matchingIds } }, { recipientUserId: { $in: matchingIds } }] } : {}),
      }
      : null
    const [couples, invitationRows] = await Promise.all([
      relationshipFilter ? relationships.find(relationshipFilter).sort({ createdAt: -1 }).limit(200).toArray() : [],
      invitationFilter ? invitations.find(invitationFilter, {
        projection: {
          _id: 1, senderUserId: 1, recipientUserId: 1, relationshipStart: 1,
          status: 1, createdAt: 1, actedAt: 1, expiresAt: 1,
        },
      }).sort({ createdAt: -1 }).limit(200).toArray() : [],
    ])
    const participantIds = [...new Set([
      ...couples.flatMap((couple) => couple.members),
      ...invitationRows.flatMap((invitation) => [invitation.senderUserId, invitation.recipientUserId]),
    ])]
    const participants = await users.find({ _id: { $in: participantIds } }, {
      projection: { _id: 1, publicId: 1, displayName: 1 },
    }).toArray()
    const participantById = new Map(participants.map((user) => [user._id, {
      publicId: user.publicId ?? '',
      displayName: user.displayName ?? 'Người dùng',
    }]))
    const results = [
      ...couples.map((couple) => ({
        id: couple._id,
        status: 'connected',
        participants: couple.members.map((id) => ({ id, ...participantById.get(id) })),
        relationshipStart: couple.relationshipStart ?? '',
        createdAt: couple.createdAt instanceof Date ? couple.createdAt.toISOString() : new Date(couple.createdAt).toISOString(),
        actedAt: '',
      })),
      ...invitationRows.map((invitation) => ({
        id: invitation._id,
        status: invitation.status,
        participants: [invitation.senderUserId, invitation.recipientUserId].map((id) => ({ id, ...participantById.get(id) })),
        relationshipStart: invitation.relationshipStart ?? '',
        createdAt: invitation.createdAt instanceof Date ? invitation.createdAt.toISOString() : new Date(invitation.createdAt).toISOString(),
        actedAt: invitation.actedAt instanceof Date ? invitation.actedAt.toISOString() : '',
      })),
    ].filter((item) => !search || item.participants.some((participant) => (
      participant.publicId.toLowerCase().includes(search.toLowerCase())
      || participant.displayName.toLowerCase().includes(search.toLowerCase())
    )))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 200)
    return { couples: results }
  })

  app.post('/api/auth/logout', { preHandler: app.requireAuth }, async (request, reply) => {
    const token = request.cookies[COOKIE_NAME]
    await sessions.deleteOne({ tokenHash: hashToken(token) })
    reply.clearCookie(COOKIE_NAME, { path: '/' })
    return reply.code(204).send()
  })

  app.get('/api/admin/wallets', { preHandler: app.requireAdmin }, async (request) => {
    const search = typeof request.query?.search === 'string' ? request.query.search.trim().slice(0, 100) : ''
    const status = typeof request.query?.status === 'string' ? request.query.status : 'all'
    const page = Number.parseInt(request.query?.page ?? '1', 10)
    const pageSize = Number.parseInt(request.query?.pageSize ?? '25', 10)
    if (!['all', 'balanced', 'mismatch'].includes(status)
      || !Number.isInteger(page) || page < 1 || page > 100_000
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw httpError(400, 'Bộ lọc hoặc phân trang ví không hợp lệ.')
    }
    const searchMatch = search ? { $or: [
      { publicId: { $regex: escapeRegExp(search), $options: 'i' } },
      { displayName: { $regex: escapeRegExp(search), $options: 'i' } },
      { email: { $regex: escapeRegExp(search), $options: 'i' } },
    ] } : null
    const pipeline = [
      { $match: { role: { $ne: 'admin' }, ...(searchMatch ?? {}) } },
      { $lookup: { from: 'walletAccounts', localField: '_id', foreignField: 'userId', as: 'walletAccount' } },
      { $lookup: { from: 'walletTransactions', localField: '_id', foreignField: 'userId', as: 'ledger' } },
      { $set: {
        ledgerBalance: { $sum: '$ledger.amount' },
        availableBalance: { $ifNull: [{ $arrayElemAt: ['$walletAccount.balance', 0] }, 0] },
        transactionCount: { $size: '$ledger' },
      } },
      { $set: { hasMismatch: { $ne: ['$ledgerBalance', '$availableBalance'] } } },
      ...(status === 'all' ? [] : [{ $match: { hasMismatch: status === 'mismatch' } }]),
      { $facet: {
        metadata: [{ $count: 'total' }],
        summary: [{ $group: {
          _id: null,
          totalWallets: { $sum: 1 },
          totalLedgerCoins: { $sum: '$ledgerBalance' },
          mismatchCount: { $sum: { $cond: ['$hasMismatch', 1, 0] } },
        } }],
        wallets: [
          { $sort: { ledgerBalance: -1, _id: 1 } },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          { $project: {
            _id: 0, userId: '$_id', publicId: 1, displayName: 1, email: 1,
            ledgerBalance: 1, availableBalance: 1, transactionCount: 1, hasMismatch: 1,
          } },
        ],
      } },
    ]
    const [result] = await users.aggregate(pipeline).toArray()
    const summary = result?.summary?.[0] ?? { totalWallets: 0, totalLedgerCoins: 0, mismatchCount: 0 }
    const total = result?.metadata?.[0]?.total ?? 0
    return {
      summary: { totalWallets: summary.totalWallets, totalLedgerCoins: summary.totalLedgerCoins, mismatchCount: summary.mismatchCount },
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      wallets: result?.wallets ?? [],
    }
  })

  app.get('/api/admin/transactions', { preHandler: app.requireAdmin }, async (request) => {
    const search = typeof request.query?.search === 'string' ? request.query.search.trim().slice(0, 100) : ''
    const direction = typeof request.query?.direction === 'string' ? request.query.direction : 'all'
    const type = typeof request.query?.type === 'string' ? request.query.type : 'all'
    const from = request.query?.from
    const to = request.query?.to
    const amountMin = request.query?.amountMin === undefined ? undefined : Number(request.query.amountMin)
    const amountMax = request.query?.amountMax === undefined ? undefined : Number(request.query.amountMax)
    const page = Number.parseInt(request.query?.page ?? '1', 10)
    const pageSize = Number.parseInt(request.query?.pageSize ?? '50', 10)
    if (!['all', 'credit', 'debit'].includes(direction)
      || !['all', 'deposit', 'withdrawal', 'refund', 'adjustment', 'other'].includes(type)
      || from !== undefined && !isDate(from) || to !== undefined && !isDate(to)
      || from && to && from > to
      || amountMin !== undefined && (!Number.isSafeInteger(amountMin) || amountMin < 0)
      || amountMax !== undefined && (!Number.isSafeInteger(amountMax) || amountMax < 0)
      || amountMin !== undefined && amountMax !== undefined && amountMin > amountMax
      || !Number.isInteger(page) || page < 1 || page > 100_000
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw httpError(400, 'Bộ lọc hoặc phân trang giao dịch không hợp lệ.')
    }
    const filter = {}
    if (direction === 'credit') filter.amount = { $gt: 0 }
    if (direction === 'debit') filter.amount = { $lt: 0 }
    if (type !== 'all') filter.transactionType = type === 'other'
      ? { $nin: ['deposit', 'withdrawal', 'withdrawal_release', 'refund', 'adjustment'] }
      : type === 'withdrawal' ? { $in: ['withdrawal', 'withdrawal_release'] } : type
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`)
      if (to) filter.createdAt.$lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000)
    }
    if (amountMin !== undefined || amountMax !== undefined) {
      filter.$expr = { $and: [
        ...(amountMin === undefined ? [] : [{ $gte: [{ $abs: '$amount' }, amountMin] }]),
        ...(amountMax === undefined ? [] : [{ $lte: [{ $abs: '$amount' }, amountMax] }]),
      ] }
    }
    if (search) {
      const matchingUsers = await users.find({
        $or: [
          { publicId: { $regex: escapeRegExp(search), $options: 'i' } },
          { displayName: { $regex: escapeRegExp(search), $options: 'i' } },
          { email: { $regex: escapeRegExp(search), $options: 'i' } },
        ],
      }, { projection: { _id: 1 } }).limit(500).toArray()
      const matchingDeposits = await depositRequests.find({
        code: { $regex: escapeRegExp(search), $options: 'i' },
      }, { projection: { _id: 1 } }).limit(500).toArray()
      const matchingWithdrawals = await withdrawalRequests.find({
        code: { $regex: escapeRegExp(search), $options: 'i' },
      }, { projection: { _id: 1 } }).limit(500).toArray()
      const otherFilters = Object.entries(filter).map(([key, value]) => ({ [key]: value }))
      for (const key of Object.keys(filter)) delete filter[key]
      filter.$and = [...otherFilters, { $or: [
        { _id: { $regex: escapeRegExp(search), $options: 'i' } },
        { transactionCode: { $regex: escapeRegExp(search), $options: 'i' } },
        { transferId: { $regex: escapeRegExp(search), $options: 'i' } },
        { reference: { $regex: escapeRegExp(search), $options: 'i' } },
        { depositRequestId: { $regex: escapeRegExp(search), $options: 'i' } },
        { depositRequestId: { $in: matchingDeposits.map((deposit) => deposit._id) } },
        { withdrawalRequestId: { $in: matchingWithdrawals.map((withdrawal) => withdrawal._id) } },
        { userId: { $in: matchingUsers.map((user) => user._id) } },
      ] }]
    }
    const [transactions, total, summaryRows] = await Promise.all([
      walletTransactions.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      walletTransactions.countDocuments(filter),
      walletTransactions.aggregate([{ $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalCoinCredits: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
        totalCoinDebits: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] } },
        ledgerCoinBalance: { $sum: '$amount' },
      } }]).toArray(),
    ])
    const userIds = [...new Set(transactions.map((transaction) => transaction.userId))]
    const depositIds = [...new Set(transactions.map((transaction) => transaction.depositRequestId).filter(Boolean))]
    const withdrawalIds = [...new Set(transactions.map((transaction) => transaction.withdrawalRequestId).filter(Boolean))]
    const [accountRows, depositRows, withdrawalRows] = await Promise.all([
      users.find({ _id: { $in: userIds } }, { projection: { _id: 1, publicId: 1, displayName: 1, email: 1 } }).toArray(),
      depositRequests.find({ _id: { $in: depositIds } }, { projection: { _id: 1, code: 1 } }).toArray(),
      withdrawalRequests.find({ _id: { $in: withdrawalIds } }, { projection: { _id: 1, status: 1 } }).toArray(),
    ])
    const usersById = new Map(accountRows.map((user) => [user._id, user]))
    const depositsById = new Map(depositRows.map((deposit) => [deposit._id, deposit]))
    const withdrawalsById = new Map(withdrawalRows.map((withdrawal) => [withdrawal._id, withdrawal]))
    const normalized = transactions.map((transaction) => {
      const user = usersById.get(transaction.userId)
      return {
        id: transaction._id,
        userId: transaction.userId,
        publicId: user?.publicId ?? '',
        displayName: user?.displayName ?? 'Người dùng',
        email: user?.email ?? '',
        amount: Math.abs(Number(transaction.amount) || 0),
        direction: transaction.amount >= 0 ? 'credit' : 'debit',
        type: transaction.transactionType === 'withdrawal' ? 'Rút tiền'
          : transaction.transactionType === 'withdrawal_release' ? 'Giải phóng xu rút'
            : transaction.transactionType === 'refund' ? 'Hoàn xu'
              : transaction.transactionType === 'adjustment' ? 'Điều chỉnh số dư'
                : transaction.depositRequestId ? 'Nạp xu đã đối chiếu'
                  : transaction.transferId ? 'Chuyển xu' : 'Biến động xu',
        reference: transaction.transactionCode ?? depositsById.get(transaction.depositRequestId)?.code ?? transaction.reference ?? transaction.transferId ?? String(transaction._id).slice(0, 12),
        transactionCode: transaction.transactionCode ?? depositsById.get(transaction.depositRequestId)?.code ?? '',
        status: withdrawalsById.get(transaction.withdrawalRequestId)?.status ?? 'Đã ghi sổ',
        createdAt: transaction.createdAt instanceof Date ? transaction.createdAt.toISOString() : new Date(transaction.createdAt).toISOString(),
        description: String(transaction.description ?? 'Biến động xu'),
      }
    })
    const summary = summaryRows[0] ?? { totalTransactions: 0, totalCoinCredits: 0, totalCoinDebits: 0, ledgerCoinBalance: 0 }
    return {
      summary: {
        totalTransactions: summary.totalTransactions,
        totalCoinCredits: summary.totalCoinCredits,
        totalCoinDebits: summary.totalCoinDebits,
        ledgerCoinBalance: summary.ledgerCoinBalance,
      },
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      transactions: normalized,
    }
  })

  app.post('/api/admin/wallet/refunds', { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['originalTransactionId', 'reason'].includes(key))
      || typeof body.originalTransactionId !== 'string') {
      throw httpError(400, 'Thông tin hoàn xu không hợp lệ.')
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 3 || reason.length > 500) throw httpError(400, 'Lý do hoàn xu cần có từ 3 đến 500 ký tự.')
    const original = await walletTransactions.findOne({ _id: body.originalTransactionId, amount: { $lt: 0 } })
    if (!original) throw httpError(404, 'Chỉ có thể hoàn xu cho bút toán ghi nợ đã tồn tại.')
    const existingRefund = await refundRequests.findOne({ originalTransactionId: original._id })
    if (existingRefund) throw httpError(409, `Bút toán này đã được hoàn theo mã ${existingRefund.code}.`)
    const now = new Date()
    const id = randomUUID()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createTransactionCode('LFC')
      try {
        const result = await connection.withTransaction(async (session) => {
          const current = await walletTransactions.findOne({ _id: original._id, amount: { $lt: 0 } }, { session })
          if (!current) return { error: 'Bút toán gốc không còn hợp lệ.', statusCode: 409 }
          const alreadyRefunded = await refundRequests.findOne({ originalTransactionId: current._id }, { session })
          if (alreadyRefunded) return { error: `Bút toán này đã được hoàn theo mã ${alreadyRefunded.code}.`, statusCode: 409 }
          await reserveTransactionCode(code, 'refund', id, now, session)
          const coins = Math.abs(current.amount)
          const account = await getOrCreateWalletAccount(current.userId, session, now)
          await walletAccounts.updateOne({ _id: account._id }, { $inc: { balance: coins }, $set: { updatedAt: now } }, { session })
          const refund = {
            _id: id,
            code,
            userId: current.userId,
            originalTransactionId: current._id,
            originalTransactionCode: current.transactionCode ?? '',
            coins,
            reason,
            status: 'completed',
            createdAt: now,
            createdBy: request.user.id,
          }
          await refundRequests.insertOne(refund, { session })
          await walletTransactions.insertOne({
            _id: `refund:${id}`,
            transactionCode: code,
            transactionType: 'refund',
            refundRequestId: id,
            userId: current.userId,
            description: `Hoàn ${coins} xu · ${reason}`,
            amount: coins,
            reference: current.transactionCode ?? current._id,
            createdAt: now,
          }, { session })
          await notifications.insertOne({
            _id: randomUUID(),
            userId: current.userId,
            actorUserId: request.user.id,
            type: 'wallet_refund',
            title: 'Đã hoàn xu vào Ví',
            message: `Hoàn ${coins} xu · mã ${code}.`,
            createdAt: now,
            readAt: '',
          }, { session })
          await adminAuditLogs.insertOne({
            _id: randomUUID(),
            actorUserId: request.user.id,
            actorPublicId: request.user.publicId,
            action: 'wallet.refund',
            targetId: id,
            reason,
            transactionCode: code,
            createdAt: now,
          }, { session })
          return { refund }
        })
        if (result.error) throw httpError(result.statusCode, result.error)
        return reply.code(201).send({ refund: result.refund })
      } catch (error) {
        if (error?.code !== 11000) throw error
        if (await transactionCodes.findOne({ code })) continue
        const priorRefund = await refundRequests.findOne({ originalTransactionId: original._id })
        if (priorRefund) throw httpError(409, `Bút toán này đã được hoàn theo mã ${priorRefund.code}.`)
        throw error
      }
    }
    throw httpError(503, 'Không thể tạo mã hoàn xu duy nhất. Vui lòng thử lại.')
  })

  app.post('/api/admin/wallet/adjustments', { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['userId', 'amount', 'reason'].includes(key))
      || typeof body.userId !== 'string'
      || !Number.isSafeInteger(body.amount) || body.amount === 0 || Math.abs(body.amount) > 1_000_000_000) {
      throw httpError(400, 'Thông tin điều chỉnh số dư không hợp lệ.')
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 3 || reason.length > 500) throw httpError(400, 'Lý do điều chỉnh cần có từ 3 đến 500 ký tự.')
    const target = await users.findOne({ _id: body.userId, role: { $ne: 'admin' }, accountStatus: { $ne: 'locked' } }, {
      projection: { _id: 1 },
    })
    if (!target) throw httpError(404, 'Không tìm thấy người dùng đang hoạt động.')
    const now = new Date()
    const id = randomUUID()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createTransactionCode('LFA')
      try {
        const result = await connection.withTransaction(async (session) => {
          await reserveTransactionCode(code, 'adjustment', id, now, session)
          const account = await getOrCreateWalletAccount(target._id, session, now)
          const updated = await walletAccounts.updateOne(
            { _id: account._id, ...(body.amount < 0 ? { balance: { $gte: Math.abs(body.amount) } } : {}) },
            { $inc: { balance: body.amount }, $set: { updatedAt: now } },
            { session },
          )
          if (!updated.matchedCount) return { error: 'Điều chỉnh này làm số dư khả dụng âm.', statusCode: 409 }
          const adjustment = {
            _id: id,
            code,
            userId: target._id,
            amount: body.amount,
            reason,
            createdAt: now,
            createdBy: request.user.id,
          }
          await balanceAdjustments.insertOne(adjustment, { session })
          await walletTransactions.insertOne({
            _id: `adjustment:${id}`,
            transactionCode: code,
            transactionType: 'adjustment',
            adjustmentId: id,
            userId: target._id,
            description: `Điều chỉnh số dư · ${reason}`,
            amount: body.amount,
            createdAt: now,
          }, { session })
          await notifications.insertOne({
            _id: randomUUID(),
            userId: target._id,
            actorUserId: request.user.id,
            type: 'wallet_adjustment',
            title: 'Số dư Ví đã được điều chỉnh',
            message: `${body.amount > 0 ? '+' : ''}${body.amount} xu · mã ${code}.`,
            createdAt: now,
            readAt: '',
          }, { session })
          await adminAuditLogs.insertOne({
            _id: randomUUID(),
            actorUserId: request.user.id,
            actorPublicId: request.user.publicId,
            action: 'wallet.adjusted',
            targetId: id,
            reason,
            transactionCode: code,
            createdAt: now,
          }, { session })
          return { adjustment, balance: account.balance + body.amount }
        })
        if (result.error) throw httpError(result.statusCode, result.error)
        return reply.code(201).send({ adjustment: result.adjustment, balance: result.balance })
      } catch (error) {
        if (error?.code !== 11000) throw error
        if (await transactionCodes.findOne({ code })) continue
        throw error
      }
    }
    throw httpError(503, 'Không thể tạo mã điều chỉnh duy nhất. Vui lòng thử lại.')
  })

  app.get('/api/wallet', { preHandler: app.requireAuth }, async (request) => {
    const [summaryRows, transactions, walletAccount, relationship] = await Promise.all([
      walletTransactions.aggregate([
        { $match: { userId: request.user.id } },
        {
          $group: {
            _id: null,
            balance: { $sum: '$amount' },
            totalEarned: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
            totalSpent: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] } },
          },
        },
      ]).toArray(),
      walletTransactions.find({ userId: request.user.id }).sort({ createdAt: -1 }).limit(5).toArray(),
      walletAccounts.findOne({ userId: request.user.id }),
      relationships.findOne({ members: request.user.id }),
    ])
    const summary = summaryRows[0] ?? { balance: 0, totalEarned: 0, totalSpent: 0 }
    const partnerId = relationship?.members.find((memberId) => memberId !== request.user.id)
    const partner = partnerId ? await users.findOne({ _id: partnerId }, { projection: { displayName: 1 } }) : null
    return {
      balance: walletAccount?.balance ?? summary.balance,
      coinPriceVnd: COIN_PRICE_VND,
      totalEarned: summary.totalEarned,
      totalSpent: summary.totalSpent,
      canSendCoins: Boolean(relationship),
      partnerName: partner?.displayName ?? null,
      transactions: transactions.map((transaction) => ({
        id: transaction._id,
        code: transaction.transactionCode ?? '',
        item: transaction.description,
        amount: transaction.amount,
        createdAt: transaction.createdAt.toISOString(),
      })),
    }
  })

  app.get('/api/wallet/transactions', { preHandler: app.requireAuth }, async (request) => {
    const transactions = await walletTransactions.find({ userId: request.user.id }).sort({ createdAt: -1 }).toArray()
    return {
      transactions: transactions.map((transaction) => ({
        id: transaction._id,
        code: transaction.transactionCode ?? '',
        item: transaction.description,
        amount: transaction.amount,
        createdAt: transaction.createdAt.toISOString(),
      })),
    }
  })

  app.post('/api/wallet/send', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'amount')) {
      throw httpError(400, 'Dữ liệu chuyển xu không hợp lệ.')
    }
    const amount = body.amount
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000) {
      throw httpError(400, 'Số xu cần gửi phải là số nguyên dương hợp lệ.')
    }

    const transferId = randomUUID()
    const result = await connection.withTransaction(async (session) => {
      const relationship = await relationships.findOne({ members: request.user.id }, { session })
      if (!relationship) return { error: 'Bạn chỉ có thể gửi xu khi đã kết nối tài khoản.', status: 403 }

      const recipientId = relationship.members.find((memberId) => memberId !== request.user.id)
      if (!recipientId) return { error: 'Không tìm thấy tài khoản đã kết nối.', status: 403 }

      const accountIds = [request.user.id, recipientId]
      const accounts = new Map((await walletAccounts.find({ userId: { $in: accountIds } }, { session }).toArray()).map((account) => [account.userId, account]))
      for (const userId of accountIds) {
        if (accounts.has(userId)) continue
        const [rows] = await walletTransactions.aggregate([
          { $match: { userId } },
          { $group: { _id: null, balance: { $sum: '$amount' } } },
        ], { session }).toArray()
        const account = { _id: randomUUID(), userId, balance: rows?.balance ?? 0, updatedAt: new Date() }
        await walletAccounts.insertOne(account, { session })
        accounts.set(userId, account)
      }

      const senderAccount = accounts.get(request.user.id)
      if (senderAccount.balance < amount) return { error: 'Số dư không đủ để gửi xu.', status: 409 }

      const now = new Date()
      const debit = await walletAccounts.updateOne(
        { _id: senderAccount._id, balance: { $gte: amount } },
        { $inc: { balance: -amount }, $set: { updatedAt: now } },
        { session },
      )
      if (!debit.matchedCount) return { error: 'Số dư đã thay đổi. Vui lòng thử lại.', status: 409 }
      await walletAccounts.updateOne(
        { _id: accounts.get(recipientId)._id },
        { $inc: { balance: amount }, $set: { updatedAt: now } },
        { session },
      )
      await walletTransactions.insertMany([
        { _id: randomUUID(), transferId, userId: request.user.id, description: 'Gửi xu cho người đã kết nối', amount: -amount, createdAt: now },
        { _id: randomUUID(), transferId, userId: recipientId, description: 'Nhận xu từ người đã kết nối', amount, createdAt: now },
      ], { session })
      return { transferId }
    })
    if (result.error) throw httpError(result.status, result.error)
    return reply.code(201).send(result)
  })

  app.post('/api/gifts/send', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['giftId', 'message'].includes(key))) {
      throw httpError(400, 'Dữ liệu gửi quà không hợp lệ.')
    }
    const gift = typeof body.giftId === 'string' ? GIFT_CATALOG.get(body.giftId) : null
    const message = body.message === undefined ? '' : typeof body.message === 'string' ? body.message.trim() : null
    if (!gift) throw httpError(400, 'Món quà không hợp lệ.')
    if (message === null || message.length > 100) throw httpError(400, 'Lời nhắn tối đa 100 ký tự.')

    const result = await connection.withTransaction(async (session) => {
      const relationship = await relationships.findOne({ members: request.user.id }, { session })
      if (!relationship || relationship.members.length !== 2) return { error: 'Hãy kết nối với người thương trước khi gửi quà.', status: 403 }

      const recipientId = relationship.members.find((memberId) => memberId !== request.user.id)
      let account = await walletAccounts.findOne({ userId: request.user.id }, { session })
      if (!account) {
        const [ledger] = await walletTransactions.aggregate([
          { $match: { userId: request.user.id } },
          { $group: { _id: null, balance: { $sum: '$amount' } } },
        ], { session }).toArray()
        account = { _id: randomUUID(), userId: request.user.id, balance: ledger?.balance ?? 0, updatedAt: new Date() }
        await walletAccounts.insertOne(account, { session })
      }
      if (account.balance < gift.price) return { error: 'Số dư không đủ để gửi món quà này.', status: 409 }

      const now = new Date()
      const debit = await walletAccounts.updateOne(
        { _id: account._id, balance: { $gte: gift.price } },
        { $inc: { balance: -gift.price }, $set: { updatedAt: now } },
        { session },
      )
      if (!debit.matchedCount) return { error: 'Số dư đã thay đổi. Vui lòng thử lại.', status: 409 }
      const transactionId = randomUUID()
      await walletTransactions.insertOne({
        _id: transactionId,
        userId: request.user.id,
        description: `Gửi quà: ${gift.name}`,
        amount: -gift.price,
        createdAt: now,
      }, { session })
      await notifications.insertOne({
        _id: randomUUID(),
        userId: recipientId,
        actorUserId: request.user.id,
        type: 'gift_received',
        giftId: body.giftId,
        title: 'Bạn nhận được một món quà',
        message,
        createdAt: now,
        readAt: '',
      }, { session })
      return { transactionId, balance: account.balance - gift.price }
    })
    if (result.error) throw httpError(result.status, result.error)
    return reply.code(201).send(result)
  })

  app.get('/api/gifts/received', { preHandler: app.requireAuth }, async (request) => {
    const gifts = await notifications.find({ userId: request.user.id, type: 'gift_received' }).sort({ createdAt: -1 }).toArray()
    const senders = await Promise.all(gifts.map((gift) => users.findOne({ _id: gift.actorUserId }, { projection: { displayName: 1 } })))
    return {
      gifts: gifts.map((gift, index) => ({
        id: gift._id,
        giftId: gift.giftId,
        giftName: GIFT_CATALOG.get(gift.giftId)?.name ?? 'Món quà',
        message: gift.message ?? '',
        senderName: senders[index]?.displayName ?? 'Người thương',
        createdAt: gift.createdAt.toISOString(),
        openedAt: gift.openedAt?.toISOString?.() ?? '',
        redeemedAt: gift.redeemedAt?.toISOString?.() ?? '',
        redeemedCoins: gift.redeemedCoins ?? 0,
        coinValue: GIFT_CATALOG.get(gift.giftId)?.price ?? 0,
      })),
    }
  })

  app.post('/api/gifts/received/:id/open', { preHandler: app.requireAuth }, async (request) => {
    const now = new Date()
    const gift = await notifications.findOneAndUpdate(
      { _id: request.params.id, userId: request.user.id, type: 'gift_received', openedAt: { $exists: false } },
      { $set: { openedAt: now, readAt: now.toISOString() } },
      { returnDocument: 'after' },
    )
    if (gift) {
      const sender = await users.findOne({ _id: gift.actorUserId }, { projection: { displayName: 1 } })
      return {
        gift: {
          id: gift._id,
          giftId: gift.giftId,
          giftName: GIFT_CATALOG.get(gift.giftId)?.name ?? 'Món quà',
          message: gift.message ?? '',
          senderName: sender?.displayName ?? 'Người thương',
          createdAt: gift.createdAt.toISOString(),
          openedAt: gift.openedAt.toISOString(),
          redeemedAt: gift.redeemedAt?.toISOString?.() ?? '',
          redeemedCoins: gift.redeemedCoins ?? 0,
          coinValue: GIFT_CATALOG.get(gift.giftId)?.price ?? 0,
        },
      }
    }

    const existing = await notifications.findOne({ _id: request.params.id, userId: request.user.id, type: 'gift_received' })
    if (!existing) throw httpError(404, 'Không tìm thấy món quà này.')
    const sender = await users.findOne({ _id: existing.actorUserId }, { projection: { displayName: 1 } })
    return {
      gift: {
        id: existing._id,
        giftId: existing.giftId,
        giftName: GIFT_CATALOG.get(existing.giftId)?.name ?? 'Món quà',
        message: existing.message ?? '',
        senderName: sender?.displayName ?? 'Người thương',
        createdAt: existing.createdAt.toISOString(),
        openedAt: existing.openedAt?.toISOString?.() ?? '',
        redeemedAt: existing.redeemedAt?.toISOString?.() ?? '',
        redeemedCoins: existing.redeemedCoins ?? 0,
        coinValue: GIFT_CATALOG.get(existing.giftId)?.price ?? 0,
      },
    }
  })

  app.post('/api/gifts/received/:id/redeem', { preHandler: app.requireAuth }, async (request) => {
    const result = await connection.withTransaction(async (session) => {
      const gift = await notifications.findOne({
        _id: request.params.id,
        userId: request.user.id,
        type: 'gift_received',
      }, { session })
      if (!gift) return { error: 'Không tìm thấy món quà này.', status: 404 }
      if (!gift.openedAt) return { error: 'Hãy mở quà trước khi đổi thành xu.', status: 409 }
      if (gift.redeemedAt) return { error: 'Món quà này đã được đổi thành xu.', status: 409 }

      const coinValue = GIFT_CATALOG.get(gift.giftId)?.price
      if (!coinValue) return { error: 'Không xác định được giá trị món quà.', status: 400 }
      let account = await walletAccounts.findOne({ userId: request.user.id }, { session })
      if (!account) {
        const [ledger] = await walletTransactions.aggregate([
          { $match: { userId: request.user.id } },
          { $group: { _id: null, balance: { $sum: '$amount' } } },
        ], { session }).toArray()
        account = { _id: randomUUID(), userId: request.user.id, balance: ledger?.balance ?? 0, updatedAt: new Date() }
        await walletAccounts.insertOne(account, { session })
      }

      const now = new Date()
      const redeemed = await notifications.updateOne(
        { _id: gift._id, userId: request.user.id, openedAt: { $exists: true }, redeemedAt: { $exists: false } },
        { $set: { redeemedAt: now, redeemedCoins: coinValue } },
        { session },
      )
      if (!redeemed.modifiedCount) return { error: 'Món quà này đã được đổi thành xu.', status: 409 }
      await walletAccounts.updateOne(
        { _id: account._id },
        { $inc: { balance: coinValue }, $set: { updatedAt: now } },
        { session },
      )
      await walletTransactions.insertOne({
        _id: randomUUID(),
        userId: request.user.id,
        description: `Đổi quà: ${GIFT_CATALOG.get(gift.giftId).name}`,
        amount: coinValue,
        createdAt: now,
      }, { session })
      return { balance: account.balance + coinValue, redeemedCoins: coinValue, redeemedAt: now.toISOString() }
    })
    if (result.error) throw httpError(result.status, result.error)
    return result
  })

  app.get('/api/profile', { preHandler: app.requireAuth }, async (request) => {
    const [user, relationship] = await Promise.all([
      users.findOne({ _id: request.user.id }),
      relationships.findOne({ members: request.user.id }),
    ])
    return {
      ...request.user,
      joinedAt: user.createdAt?.toISOString?.() ?? '',
      bio: user.bio ?? '',
      relationshipStart: relationship?.relationshipStart ?? user.relationshipStart ?? '',
      pinnedQuickActions: normalizePinnedQuickActions(user.pinnedQuickActions),
      dateOfBirth: user.dateOfBirth ?? '',
      gender: user.gender ?? '',
    }
  })

  app.patch('/api/profile', { preHandler: app.requireAuth }, async (request) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['displayName', 'bio', 'relationshipStart', 'pinnedQuickActions'].includes(key))) {
      throw httpError(400, 'Dữ liệu hồ sơ không hợp lệ.')
    }
    const displayName = body.displayName === undefined ? request.user.displayName : typeof body.displayName === 'string' ? body.displayName.trim() : ''
    const bio = body.bio === undefined ? undefined : typeof body.bio === 'string' ? body.bio.trim() : null
    const relationshipStart = body.relationshipStart === undefined ? undefined : body.relationshipStart
    const pinnedQuickActions = body.pinnedQuickActions
    if (pinnedQuickActions !== undefined && (!Array.isArray(pinnedQuickActions)
      || pinnedQuickActions.length < 1
      || pinnedQuickActions.length > 4
      || new Set(pinnedQuickActions).size !== pinnedQuickActions.length
      || pinnedQuickActions.some((id) => typeof id !== 'string' || !QUICK_ACTION_IDS.has(id)))) {
      throw httpError(400, 'Hãy chọn từ một đến bốn lối tắt hợp lệ.')
    }
    if (displayName.length < 1 || displayName.length > 48) throw httpError(400, 'Tên hiển thị cần có từ 1 đến 48 ký tự.')
    if (bio === null || bio !== undefined && bio.length > 160) throw httpError(400, 'Bio tối đa 160 ký tự.')
    if (relationshipStart !== undefined && relationshipStart !== '' && (!isDate(relationshipStart) || relationshipStart > new Date().toISOString().slice(0, 10))) {
      throw httpError(400, 'Ngày bắt đầu không hợp lệ.')
    }
    const update = { displayName }
    if (bio !== undefined) update.bio = bio
    if (relationshipStart !== undefined) update.relationshipStart = relationshipStart || ''
    if (pinnedQuickActions !== undefined) update.pinnedQuickActions = pinnedQuickActions
    const relationship = relationshipStart === undefined ? null : await relationships.findOne({ members: request.user.id })
    if (relationship) {
      await connection.withTransaction(async (session) => {
        await relationships.updateOne({ _id: relationship._id }, { $set: { relationshipStart } }, { session })
        await users.updateOne({ _id: request.user.id }, { $set: update }, { session })
        await users.updateOne({ _id: { $in: relationship.members.filter((memberId) => memberId !== request.user.id) } }, { $set: { relationshipStart } }, { session })
      })
    } else {
      await users.updateOne({ _id: request.user.id }, { $set: update })
    }
    return {
      ...request.user,
      joinedAt: (await users.findOne({ _id: request.user.id }, { projection: { createdAt: 1 } })).createdAt?.toISOString?.() ?? '',
      displayName,
      bio: bio ?? (await users.findOne({ _id: request.user.id }, { projection: { bio: 1 } })).bio ?? '',
      relationshipStart: relationshipStart === undefined
        ? (await users.findOne({ _id: request.user.id }, { projection: { relationshipStart: 1 } })).relationshipStart ?? ''
        : relationshipStart,
      pinnedQuickActions: normalizePinnedQuickActions(pinnedQuickActions ?? (await users.findOne({ _id: request.user.id }, { projection: { pinnedQuickActions: 1 } })).pinnedQuickActions),
    }
  })

  app.get('/api/connections', { preHandler: app.requireAuth }, async (request) => {
    const now = new Date()
    const [relationship, receivedItems, sentItems] = await Promise.all([
      relationships.findOne({ members: request.user.id }),
      invitations.find({ recipientUserId: request.user.id, status: 'pending', expiresAt: { $gt: now } }).sort({ createdAt: -1 }).toArray(),
      invitations.find({ senderUserId: request.user.id, status: 'pending', expiresAt: { $gt: now } }).sort({ createdAt: -1 }).toArray(),
    ])
    const peerId = relationship?.members.find((memberId) => memberId !== request.user.id)
    const [peer, currentUser, receivedSenders, sentRecipients] = await Promise.all([
      peerId ? users.findOne({ _id: peerId }) : null,
      users.findOne({ _id: request.user.id }, { projection: { relationshipStart: 1 } }),
      Promise.all(receivedItems.map((item) => users.findOne({ _id: item.senderUserId }))),
      Promise.all(sentItems.map((item) => users.findOne({ _id: item.recipientUserId }))),
    ])
    const peerOnline = peer && peer.lastSeenAt ? Date.now() - new Date(peer.lastSeenAt).getTime() < 60_000 : false
    return {
      relationship: relationship && peer ? {
        id: relationship._id,
        connectedAt: relationship.createdAt.toISOString(),
        publicId: peer.publicId,
        displayName: peer.displayName,
        dateOfBirth: peer.dateOfBirth ?? '',
        relationshipStart: relationship.relationshipStart ?? currentUser?.relationshipStart ?? peer.relationshipStart ?? '',
        online: peerOnline,
      } : null,
      received: receivedItems.map((item, index) => publicInvitation(item, receivedSenders[index])),
      sent: sentItems.map((item, index) => publicInvitation(item, sentRecipients[index])),
    }
  })

  app.get('/api/love-level', { preHandler: app.requireAuth }, async (request) => {
    const relationship = await relationships.findOne({ members: request.user.id })
    if (!relationship) throw httpError(404, 'Hãy kết nối với người thương để xem Love Level.')
    if (!relationship.members.includes(request.user.id) || relationship.members.length !== 2) {
      throw httpError(403, 'Bạn không có quyền xem Love Level này.')
    }
    return getLoveLevelForRelationship(relationship, request.user.id)
  })

  app.get('/api/connections/search', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig() },
  }, async (request) => {
    const publicId = request.query?.id
    if (typeof publicId !== 'string' || !/^\d{6}$/.test(publicId)) throw httpError(400, 'Nhập ID gồm đúng sáu chữ số.')
    if (publicId === request.user.publicId) throw httpError(400, 'Đây là ID LoveForYou của bạn.')
    const account = await users.findOne({ publicId }, { projection: { _id: 1, publicId: 1, displayName: 1 } })
    if (!account) throw httpError(404, 'Không tìm thấy tài khoản phù hợp.')
    const blocked = await blocks.findOne({
      $or: [
        { blockerUserId: request.user.id, blockedUserId: account._id },
        { blockerUserId: account._id, blockedUserId: request.user.id },
      ],
    })
    if (blocked) throw httpError(404, 'Không tìm thấy tài khoản phù hợp.')
    return { account: { publicId: account.publicId, displayName: account.displayName } }
  })

  app.post('/api/connections/invitations', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig() },
  }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['recipientId', 'message', 'relationshipStart'].includes(key))) {
      throw httpError(400, 'Thông tin lời mời không hợp lệ.')
    }
    if (typeof body.recipientId !== 'string' || !/^\d{6}$/.test(body.recipientId)) throw httpError(400, 'ID người nhận cần có đúng sáu chữ số.')
    if (typeof body.relationshipStart !== 'string' || !isDate(body.relationshipStart) || body.relationshipStart > new Date().toISOString().slice(0, 10)) {
      throw httpError(400, 'Ngày bắt đầu bên nhau là bắt buộc và không được ở tương lai.')
    }
    const message = body.message === undefined ? '' : typeof body.message === 'string' ? body.message.trim() : null
    if (message === null || message.length > 240) throw httpError(400, 'Lời nhắn tối đa 240 ký tự.')
    const recipient = await users.findOne({ publicId: body.recipientId }, { projection: { _id: 1, publicId: 1, displayName: 1 } })
    if (!recipient) throw httpError(404, 'Không tìm thấy tài khoản phù hợp.')
    if (recipient._id === request.user.id) throw httpError(400, 'Bạn không thể gửi lời mời cho chính mình.')

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 86_400_000)
    const invitationId = randomUUID()
    const pairKey = [request.user.id, recipient._id].sort().join(':')
    await connection.withTransaction(async (session) => {
      const blocked = await blocks.findOne({
        $or: [
          { blockerUserId: request.user.id, blockedUserId: recipient._id },
          { blockerUserId: recipient._id, blockedUserId: request.user.id },
        ],
      }, { session })
      if (blocked) throw httpError(404, 'Không tìm thấy tài khoản phù hợp.')
      if (await relationships.findOne({ members: { $in: [request.user.id, recipient._id] } }, { session })) {
        throw httpError(409, 'Một trong hai tài khoản đã có kết nối đang hoạt động.')
      }
      await invitations.updateMany({ status: 'pending', expiresAt: { $lte: now } }, { $set: { status: 'expired', actedAt: now } }, { session })
      await invitations.insertOne({
        _id: invitationId,
        pairKey,
        senderUserId: request.user.id,
        recipientUserId: recipient._id,
        message,
        relationshipStart: body.relationshipStart,
        status: 'pending',
        createdAt: now,
        expiresAt,
        actedAt: null,
      }, { session })
      await notifications.insertOne({
        _id: randomUUID(),
        userId: recipient._id,
        type: 'couple_invitation',
        actorUserId: request.user.id,
        invitationId,
        createdAt: now,
        readAt: '',
      }, { session })
    })
    return reply.code(201).send({
      invitation: {
        id: invitationId,
        status: 'pending',
        recipient: { publicId: recipient.publicId, displayName: recipient.displayName },
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    })
  })

  app.post('/api/connections/invitations/:id/accept', { preHandler: app.requireAuth }, async (request, reply) => {
    const now = new Date()
    const result = await connection.withTransaction(async (session) => {
      const invitation = await invitations.findOne({ _id: request.params.id, recipientUserId: request.user.id }, { session })
      if (!invitation) return { error: 'Không tìm thấy lời mời này.', status: 404 }
      if (invitation.status !== 'pending') return { error: 'Lời mời này đã được xử lý.', status: 409 }
      if (!isDate(invitation.relationshipStart) || invitation.relationshipStart > now.toISOString().slice(0, 10)) {
        return { error: 'Lời mời này chưa có ngày bắt đầu bên nhau. Hãy gửi lại lời mời mới.', status: 409 }
      }
      if (invitation.expiresAt <= now) {
        await invitations.updateOne({ _id: invitation._id, status: 'pending' }, { $set: { status: 'expired', actedAt: now } }, { session })
        return { error: 'Lời mời này đã hết hạn.', status: 410 }
      }
      if (await relationships.findOne({ members: { $in: [invitation.senderUserId, invitation.recipientUserId] } }, { session })) {
        return { error: 'Một trong hai tài khoản đã có kết nối đang hoạt động.', status: 409 }
      }
      const transition = await invitations.updateOne(
        { _id: invitation._id, status: 'pending', expiresAt: { $gt: now } },
        { $set: { status: 'accepted', actedAt: now } },
        { session },
      )
      if (!transition.modifiedCount) return { error: 'Lời mời này đã được xử lý.', status: 409 }
      const members = [invitation.senderUserId, invitation.recipientUserId].sort()
      const relationshipId = randomUUID()
      await relationships.insertOne({
        _id: relationshipId,
        pairKey: members.join(':'),
        members,
        relationshipStart: invitation.relationshipStart,
        createdAt: now,
      }, { session })
      await users.updateMany(
        { _id: { $in: members } },
        { $set: { relationshipStart: invitation.relationshipStart } },
        { session },
      )
      await notifications.insertMany([
        { _id: randomUUID(), userId: invitation.senderUserId, type: 'couple_invitation_accepted', actorUserId: request.user.id, invitationId: invitation._id, createdAt: now, readAt: '' },
        { _id: randomUUID(), userId: invitation.recipientUserId, type: 'couple_connected', actorUserId: invitation.senderUserId, invitationId: invitation._id, createdAt: now, readAt: '' },
      ], { session })
      return { relationshipId }
    })
    if (result.error) throw httpError(result.status, result.error)
    return reply.code(200).send({ id: result.relationshipId })
  })

  for (const action of ['reject', 'cancel']) {
    app.post(`/api/connections/invitations/:id/${action}`, { preHandler: app.requireAuth }, async (request, reply) => {
      const actorField = action === 'reject' ? 'recipientUserId' : 'senderUserId'
      const now = new Date()
      const result = await connection.withTransaction(async (session) => {
        const invitation = await invitations.findOne({ _id: request.params.id, [actorField]: request.user.id }, { session })
        if (!invitation) return { error: 'Không tìm thấy lời mời này.', statusCode: 404 }
        if (invitation.status !== 'pending') return { error: 'Lời mời này đã được xử lý.', statusCode: 409 }
        if (invitation.expiresAt <= now) {
          await invitations.updateOne({ _id: invitation._id, status: 'pending' }, { $set: { status: 'expired', actedAt: now } }, { session })
          return { error: 'Lời mời này đã hết hạn.', statusCode: 410 }
        }
        const nextStatus = action === 'reject' ? 'rejected' : 'cancelled'
        const update = await invitations.updateOne(
          { _id: invitation._id, status: 'pending', expiresAt: { $gt: now } },
          { $set: { status: nextStatus, actedAt: now } },
          { session },
        )
        if (!update.modifiedCount) return { error: 'Lời mời này đã được xử lý.', statusCode: 409 }
        return { id: invitation._id, status: nextStatus }
      })
      if (result.error) throw httpError(result.statusCode, result.error)
      return reply.code(200).send({ id: result.id, status: result.status })
    })
  }

  app.post('/api/chat/read', { preHandler: app.requireAuth }, async (request) => {
    const relationship = await relationships.findOne({ members: request.user.id })
    if (!relationship || relationship.members.length !== 2) throw httpError(403, 'Hãy kết nối với người thương để bắt đầu trò chuyện.')
    const partnerId = relationship.members.find((memberId) => memberId !== request.user.id)
    const unreadMessages = await chatMessages.find(
      { relationshipId: relationship._id, senderUserId: partnerId, readAt: null },
      { projection: { _id: 1 } },
    ).toArray()
    if (!unreadMessages.length) return { readAt: '' }

    const now = new Date()
    const messageIds = unreadMessages.map((message) => message._id)
    const readCount = await connection.withTransaction(async (session) => {
      const readResult = await chatMessages.updateMany(
        { _id: { $in: messageIds }, relationshipId: relationship._id, senderUserId: partnerId, readAt: null },
        { $set: { readAt: now } },
        { session },
      )
      await notifications.updateMany(
        { userId: request.user.id, type: 'chat_message', messageId: { $in: messageIds.map(String) }, readAt: '' },
        { $set: { readAt: now.toISOString() } },
        { session },
      )
      return readResult.modifiedCount
    })
    if (readCount) {
      broadcastChat(relationship._id.toString(), { type: 'read', readAt: now.toISOString() }, request.user.id)
    }
    return { readAt: readCount ? now.toISOString() : '' }
  })

  app.get('/api/chat/messages', { preHandler: app.requireAuth }, async (request) => {
    const relationship = await relationships.findOne({ members: request.user.id })
    if (!relationship || relationship.members.length !== 2) throw httpError(403, 'Hãy kết nối với người thương để bắt đầu trò chuyện.')
    const partnerId = relationship.members.find((memberId) => memberId !== request.user.id)
    const now = new Date()
    const partnerPresence = await chatPresence.findOne({
      relationshipId: relationship._id,
      userId: partnerId,
      typingUntil: { $gt: now },
    })
    const rows = await chatMessages.find({ relationshipId: relationship._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .toArray()
    return {
      messages: rows.reverse().map((message) => ({
        id: message._id.toString(),
        sender: message.senderUserId === request.user.id ? 'me' : 'partner',
        text: message.text,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString?.() ?? '',
      })),
      partnerTyping: Boolean(partnerPresence),
    }
  })

  app.post('/api/chat/messages', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'text')) {
      throw httpError(400, 'Tin nhắn không hợp lệ.')
    }
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text || text.length > 2000) throw httpError(400, 'Tin nhắn cần có từ 1 đến 2000 ký tự.')
    const relationship = await relationships.findOne({ members: request.user.id })
    if (!relationship || relationship.members.length !== 2) throw httpError(403, 'Hãy kết nối với người thương để bắt đầu trò chuyện.')
    const recipientId = relationship.members.find((memberId) => memberId !== request.user.id)
    const message = { _id: randomUUID(), relationshipId: relationship._id, senderUserId: request.user.id, text, createdAt: new Date(), readAt: null }
    await connection.withTransaction(async (session) => {
      await chatMessages.insertOne(message, { session })
      await notifications.insertOne({
        _id: randomUUID(),
        userId: recipientId,
        actorUserId: request.user.id,
        type: 'chat_message',
        relationshipId: relationship._id,
        messageId: message._id,
        title: 'Tin nhắn mới',
        message: text,
        createdAt: message.createdAt,
        readAt: '',
      }, { session })
    })
    const relationshipId = relationship._id.toString()
    const publicMessage = {
      id: message._id,
      text,
      createdAt: message.createdAt.toISOString(),
      readAt: '',
    }
    const sockets = chatSockets.get(relationshipId)
    if (sockets) {
      for (const socket of sockets) {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'message', message: { ...publicMessage, sender: socket.userId === request.user.id ? 'me' : 'partner' } }))
        }
      }
    }
    return reply.code(201).send({
      message: { ...publicMessage, sender: 'me' },
    })
  })

  app.get('/api/chat/socket', {
    websocket: true,
    preHandler: async (request, reply) => {
      if (!isAllowedOrigin(request.headers.origin, clientOrigin)) throw httpError(403, 'Nguồn yêu cầu không được phép.')
      await app.requireAuth(request, reply)
    },
  }, async (socket, request) => {
    const relationship = await relationships.findOne({ members: request.user.id })
    if (!relationship || relationship.members.length !== 2) {
      socket.close(1008, 'Hãy kết nối với người thương để bắt đầu trò chuyện.')
      return
    }
    const relationshipId = relationship._id.toString()
    const sockets = chatSockets.get(relationshipId) ?? new Set()
    socket.userId = request.user.id
    sockets.add(socket)
    chatSockets.set(relationshipId, sockets)
    const removeSocket = () => {
      sockets.delete(socket)
      if (!sockets.size) chatSockets.delete(relationshipId)
    }
    socket.on('close', removeSocket)
    socket.on('error', removeSocket)
  })

  app.post('/api/chat/typing', { preHandler: app.requireAuth }, async (request) => {
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'typing') || typeof body.typing !== 'boolean') {
      throw httpError(400, 'Trạng thái nhập tin nhắn không hợp lệ.')
    }
    const relationship = await relationships.findOne({ members: request.user.id })
    if (!relationship || relationship.members.length !== 2) throw httpError(403, 'Hãy kết nối với người thương để bắt đầu trò chuyện.')
    if (body.typing) {
      const now = new Date()
      await chatPresence.updateOne(
        { relationshipId: relationship._id, userId: request.user.id },
        { $set: { typingUntil: new Date(now.getTime() + 6_000) }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      )
    } else {
      await chatPresence.deleteOne({ relationshipId: relationship._id, userId: request.user.id })
    }
    broadcastChat(relationship._id.toString(), { type: 'typing', typing: body.typing }, request.user.id)
    return { typing: body.typing }
  })

  app.get('/api/notifications', { preHandler: app.requireAuth }, async (request) => {
    const items = await notifications.find({ userId: request.user.id }).sort({ createdAt: -1 }).limit(100).toArray()
    const actors = await Promise.all(items.map((item) => users.findOne({ _id: item.actorUserId }, { projection: { publicId: 1, displayName: 1 } })))
    return {
      notifications: items.map((item, index) => ({
        id: item._id,
        type: item.type,
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt,
        invitationId: item.invitationId,
        messageId: item.messageId ?? '',
        giftId: item.giftId ?? '',
        giftName: GIFT_CATALOG.get(item.giftId)?.name ?? '',
        actorName: actors[index]?.displayName ?? '',
        actorPublicId: actors[index]?.publicId ?? '',
        title: item.title ?? '',
        message: item.message ?? '',
      })),
    }
  })

  app.post('/api/notifications/read-all', { preHandler: app.requireAuth }, async (request) => {
    const now = new Date().toISOString()
    const result = await notifications.updateMany(
      { userId: request.user.id, readAt: '' },
      { $set: { readAt: now } },
    )
    return { updated: result.modifiedCount }
  })

  app.post('/api/notifications/:id/read', { preHandler: app.requireAuth }, async (request) => {
    const now = new Date().toISOString()
    const result = await notifications.updateOne(
      { _id: request.params.id, userId: request.user.id, readAt: '' },
      { $set: { readAt: now } },
    )
    if (!result.matchedCount) throw httpError(404, 'Không tìm thấy thông báo này.')
    if (!result.modifiedCount) {
      const existing = await notifications.findOne({ _id: request.params.id, userId: request.user.id })
      return { id: request.params.id, readAt: existing.readAt }
    }
    return { id: request.params.id, readAt: now }
  })

  async function attachEntryImage(ownerId, type, body, previousMediaId = null) {
    if (body.imageMediaId !== undefined) {
      if (body.imageMediaId === null || body.imageMediaId === '') return { imageMediaId: null, clearLegacyImage: true }
      const mediaDoc = await mediaService.getAccessibleMedia(body.imageMediaId, { id: ownerId, role: 'member' })
      if (mediaDoc.ownerId !== ownerId) throw httpError(403, 'Bạn không có quyền dùng ảnh này.')
      if (mediaDoc.category !== entryImageCategory(type)) throw httpError(400, 'Loại ảnh không khớp với nội dung.')
      return { imageMediaId: mediaDoc._id, clearLegacyImage: true }
    }
    if (body.image === null || body.image === '') return { imageMediaId: null, clearLegacyImage: true }
    if (typeof body.image === 'string' && body.image.startsWith('data:image/')) {
      const uploaded = await mediaService.uploadFromDataUrl(ownerId, body.image, {
        category: entryImageCategory(type),
        replaceMediaId: previousMediaId,
        maxBytes: MAX_IMAGE_BYTES,
      })
      return { imageMediaId: uploaded._id, clearLegacyImage: true }
    }
    if (isMediaId(body.image)) {
      const mediaDoc = await mediaService.getAccessibleMedia(body.image, { id: ownerId, role: 'member' })
      if (mediaDoc.ownerId !== ownerId) throw httpError(403, 'Bạn không có quyền dùng ảnh này.')
      return { imageMediaId: mediaDoc._id, clearLegacyImage: true }
    }
    return null
  }

  app.get('/api/entries', { preHandler: app.requireAuth }, async (request) => {
    const type = request.query?.type
    if (type !== undefined && !ENTRY_TYPES.has(type)) throw httpError(400, 'Loại nội dung không hợp lệ.')
    const filter = { ownerUserId: request.user.id, ...(type ? { type } : {}) }
    const rows = await entries.find(filter).sort({ date: -1, createdAt: -1 }).toArray()
    return { entries: rows.map(publicEntry) }
  })

  app.post('/api/entries', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig(60) },
  }, async (request, reply) => {
    validateEntry(request.body)
    const idempotencyKey = request.headers['idempotency-key']
    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey)) throw httpError(400, 'Thiếu mã thao tác để tránh lưu trùng.')
    const filter = { ownerUserId: request.user.id, idempotencyKey }
    const existing = await entries.findOne(filter)
    if (existing) return { entry: publicEntry(existing) }
    const { type, title, date, text } = request.body
    const imageAttach = (request.body.image !== undefined || request.body.imageMediaId !== undefined)
      ? await attachEntryImage(request.user.id, type, request.body)
      : null
    const now = new Date()
    const entry = {
      _id: randomUUID(),
      ...filter,
      type,
      title: title.trim(),
      date,
      text: text.trim(),
      ...(imageAttach?.imageMediaId ? { imageMediaId: imageAttach.imageMediaId } : {}),
      createdAt: now,
      updatedAt: now,
    }
    try {
      await entries.insertOne(entry)
    } catch (error) {
      if (error.code !== 11000) throw error
      const repeated = await entries.findOne(filter)
      if (!repeated) throw error
      return { entry: publicEntry(repeated) }
    }
    return reply.code(201).send({ entry: publicEntry(entry) })
  })

  app.patch('/api/entries/:id', { preHandler: app.requireAuth }, async (request) => {
    validateEntry(request.body, { partial: true })
    const current = await entries.findOne({ _id: request.params.id, ownerUserId: request.user.id })
    if (!current) throw httpError(404, 'Không tìm thấy nội dung này.')
    const body = request.body
    const update = { updatedAt: new Date() }
    const unset = {}
    if (body.title !== undefined) update.title = body.title.trim()
    if (body.date !== undefined) update.date = body.date
    if (body.text !== undefined) update.text = body.text.trim()
    if (body.image !== undefined || body.imageMediaId !== undefined) {
      const imageAttach = await attachEntryImage(request.user.id, current.type, body, current.imageMediaId ?? null)
      if (imageAttach) {
        if (imageAttach.imageMediaId) update.imageMediaId = imageAttach.imageMediaId
        else unset.imageMediaId = ''
        if (imageAttach.clearLegacyImage) unset.image = ''
        if (current.imageMediaId && current.imageMediaId !== imageAttach.imageMediaId) {
          await mediaService.deleteOwnedMedia(current.imageMediaId, request.user).catch(() => undefined)
        }
      }
    }
    const updateDoc = { $set: update }
    if (Object.keys(unset).length) updateDoc.$unset = unset
    await entries.updateOne({ _id: current._id, ownerUserId: request.user.id }, updateDoc)
    const updated = await entries.findOne({ _id: current._id, ownerUserId: request.user.id })
    return { entry: publicEntry(updated) }
  })

  app.delete('/api/entries/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const current = await entries.findOne({ _id: request.params.id, ownerUserId: request.user.id })
    if (!current) throw httpError(404, 'Không tìm thấy nội dung này.')
    const result = await entries.deleteOne({ _id: current._id, ownerUserId: request.user.id })
    if (!result.deletedCount) throw httpError(404, 'Không tìm thấy nội dung này.')
    if (current.imageMediaId) {
      await mediaService.deleteOwnedMedia(current.imageMediaId, request.user).catch(() => undefined)
    }
    return reply.code(204).send()
  })

  app.post('/api/media/upload', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig(30) },
  }, async (request, reply) => {
    const contentType = request.headers['content-type'] ?? ''
    let category = 'other'
    let relationshipId = null
    let replaceMediaId = null
    let buffer = null

    if (contentType.includes('multipart/form-data')) {
      const parts = request.parts()
      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') continue
          buffer = await part.toBuffer()
        } else if (part.fieldname === 'category') category = String(part.value ?? '')
        else if (part.fieldname === 'relationshipId') relationshipId = String(part.value ?? '') || null
        else if (part.fieldname === 'replaceMediaId') replaceMediaId = String(part.value ?? '') || null
      }
    } else {
      const body = request.body
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Dữ liệu tải ảnh không hợp lệ.')
      category = body.category
      relationshipId = body.relationshipId ?? null
      replaceMediaId = body.replaceMediaId ?? null
      if (typeof body.dataUrl === 'string') {
        const uploaded = await mediaService.uploadFromDataUrl(request.user.id, body.dataUrl, {
          category,
          relationshipId,
          replaceMediaId,
        })
        return reply.code(201).send({
          media: mediaService.publicMedia(uploaded, { url: mediaContentPath(uploaded._id) }),
        })
      }
      throw httpError(400, 'Thiếu tệp ảnh hoặc dataUrl.')
    }

    if (!buffer) throw httpError(400, 'Thiếu tệp ảnh.')
    if (!MEDIA_CATEGORIES[category]) throw httpError(400, 'Loại ảnh không được hỗ trợ.')
    const uploaded = await mediaService.uploadImageBuffer({
      ownerId: request.user.id,
      buffer,
      category,
      relationshipId,
      replaceMediaId,
      maxBytes: category === 'deposit_proof' || category === 'payment_qr' ? MAX_PAYMENT_IMAGE_BYTES : MAX_IMAGE_BYTES,
    })
    return reply.code(201).send({
      media: mediaService.publicMedia(uploaded, { url: mediaContentPath(uploaded._id) }),
    })
  })

  app.get('/api/media/:id', { preHandler: app.requireAuth }, async (request) => {
    const mediaDoc = await mediaService.getAccessibleMedia(request.params.id, request.user, {
      forAdmin: request.user.role === 'admin',
    })
    return {
      media: mediaService.publicMedia(mediaDoc, {
        url: mediaContentPath(mediaDoc._id),
      }),
    }
  })

  app.get('/api/media/:id/content', { preHandler: app.requireAuth }, async (request, reply) => {
    const variant = typeof request.query?.variant === 'string' ? request.query.variant : 'display'
    if (!['thumb', 'display', 'original'].includes(variant)) throw httpError(400, 'Kiểu hiển thị ảnh không hợp lệ.')
    const mediaDoc = await mediaService.getAccessibleMedia(request.params.id, request.user, {
      forAdmin: request.user.role === 'admin',
    })
    const url = mediaService.deliveryFor(mediaDoc, variant)
    if (!url) throw httpError(404, 'Không tìm thấy ảnh.')
    if (url.startsWith('memory://')) {
      const buffer = await mediaStorage.readBuffer(mediaDoc.cloudinaryPublicId)
      if (!buffer) throw httpError(404, 'Không tìm thấy ảnh.')
      const mime = mediaDoc.format === 'png' ? 'image/png' : mediaDoc.format === 'webp' ? 'image/webp' : 'image/jpeg'
      return reply.type(mime).header('cache-control', 'private, max-age=60').send(buffer)
    }
    return reply.redirect(url)
  })

  app.delete('/api/media/:id', { preHandler: app.requireAuth }, async (request) => {
    return mediaService.deleteOwnedMedia(request.params.id, request.user)
  })

  app.post('/api/media/:id/replace', {
    preHandler: app.requireAuth,
    config: { rateLimit: rateLimitConfig(20) },
  }, async (request, reply) => {
    const existing = await mediaService.getAccessibleMedia(request.params.id, request.user)
    await mediaService.assertCanManage(existing, request.user)
    const body = request.body
    if (!body || typeof body !== 'object' || typeof body.dataUrl !== 'string') {
      throw httpError(400, 'Thiếu dữ liệu ảnh thay thế.')
    }
    const uploaded = await mediaService.uploadFromDataUrl(request.user.id, body.dataUrl, {
      category: existing.category,
      relationshipId: existing.relationshipId,
      replaceMediaId: existing._id,
    })
    return reply.send({
      media: mediaService.publicMedia(uploaded, { url: mediaContentPath(uploaded._id) }),
    })
  })

  let loveLevelSweepRunning = false
  const sweepLoveLevels = async () => {
    if (loveLevelSweepRunning) return
    loveLevelSweepRunning = true
    try {
      const cursor = relationships.find({ members: { $size: 2 }, relationshipStart: { $type: 'string' } })
      for await (const relationship of cursor) {
        try {
          await getLoveLevelForRelationship(relationship, relationship.members[0])
        } catch (error) {
          app.log.error({ err: error, relationshipId: relationship._id }, 'Could not sync Love Level milestones')
        }
      }
    } finally {
      loveLevelSweepRunning = false
    }
  }
  loveLevelSweep = setInterval(() => {
    void sweepLoveLevels().catch((error) => app.log.error({ err: error }, 'Love Level milestone sweep failed'))
  }, 60_000)
  loveLevelSweep.unref()
  void sweepLoveLevels().catch((error) => app.log.error({ err: error }, 'Initial Love Level milestone sweep failed'))
  let depositExpirySweepRunning = false
  const sweepExpiredDeposits = async () => {
    if (depositExpirySweepRunning) return
    depositExpirySweepRunning = true
    try {
      await expireUnpaidDeposits()
    } finally {
      depositExpirySweepRunning = false
    }
  }
  depositExpirySweep = setInterval(() => {
    void sweepExpiredDeposits().catch((error) => app.log.error({ err: error }, 'Unpaid deposit expiry sweep failed'))
  }, 5_000)
  depositExpirySweep.unref()
  void sweepExpiredDeposits().catch((error) => app.log.error({ err: error }, 'Initial unpaid deposit expiry sweep failed'))

  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN) {
    throw new Error('CLIENT_ORIGIN must be configured in production.')
  }
  if (process.env.NODE_ENV === 'production' && new URL(process.env.CLIENT_ORIGIN).protocol !== 'https:') {
    throw new Error('CLIENT_ORIGIN must use HTTPS in production.')
  }
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be configured in production.')
  }
  const app = await createApp()
  const port = Number.parseInt(process.env.PORT ?? '3000', 10)
  await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' })
}
