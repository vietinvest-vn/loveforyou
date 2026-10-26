import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { MongoClient, ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { createApp, isStrongPassword } from '../src/server.js'

const origin = 'http://localhost:5173'
let mongo
let rankingClient
let rankingRelationships
let app
let alice
let bob

function cookieFrom(response) {
  return response.headers['set-cookie'].split(';', 1)[0]
}

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type) => parts.find((item) => item.type === type)?.value ?? ''
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`)
}

async function register(email, displayName, optionalDetails = {}) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { origin },
    payload: { email, displayName, password: 'Correct-Horse-42!', termsAccepted: true, ...optionalDetails },
  })
  assert.equal(response.statusCode, 201, response.body)
  return { cookie: cookieFrom(response), user: response.json().user }
}

before(async () => {
  let nextId = 1
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  rankingClient = new MongoClient(mongo.getUri())
  await rankingClient.connect()
  rankingRelationships = rankingClient.db('loveforyou-tests').collection('relationships')
  app = await createApp({
    mongoUri: mongo.getUri(),
    databaseName: 'loveforyou-tests',
    clientOrigin: origin,
    secureCookies: false,
    logger: { level: 'error' },
    generatePublicId: () => String(nextId++).padStart(6, '0'),
  })
  alice = await register('alice@example.test', 'Alice')
  bob = await register('bob@example.test', 'Bob', { dateOfBirth: '2000-02-03' })
})

after(async () => {
  await app.close()
  await rankingClient.close()
  await mongo.stop()
})

test('health check confirms MongoDB is reachable', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/health' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { status: 'ok' })
})

test('cross-origin API requests allow credentials and preflight only for the configured client origin', async () => {
  const preflight = await app.inject({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,idempotency-key',
    },
  })
  assert.equal(preflight.statusCode, 204)
  assert.equal(preflight.headers['access-control-allow-origin'], origin)
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true')
  assert.match(preflight.headers['access-control-allow-methods'], /POST/)
  assert.match(preflight.headers['access-control-allow-headers'], /Content-Type/)
  assert.match(preflight.headers['access-control-allow-headers'], /Idempotency-Key/)

  const currentSession = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { origin },
  })
  assert.equal(currentSession.statusCode, 401)
  assert.equal(currentSession.headers['access-control-allow-origin'], origin)
  assert.equal(currentSession.headers['access-control-allow-credentials'], 'true')

  const deniedPreflight = await app.inject({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: { origin: 'https://untrusted.example', 'access-control-request-method': 'POST' },
  })
  assert.equal(deniedPreflight.statusCode, 204)
  assert.equal(deniedPreflight.headers['access-control-allow-origin'], undefined)
})

test('wallet returns account-scoped balance and transaction totals', async () => {
  const anonymous = await app.inject({ method: 'GET', url: '/api/wallet' })
  assert.equal(anonymous.statusCode, 401)

  const users = rankingClient.db('loveforyou-tests').collection('users')
  const aliceRecord = await users.findOne({ email: 'alice@example.test' })
  const bobRecord = await users.findOne({ email: 'bob@example.test' })
  const walletTransactions = rankingClient.db('loveforyou-tests').collection('walletTransactions')
  const now = new Date()
  await walletTransactions.insertMany([
    { _id: 'wallet-test-credit', userId: aliceRecord._id, description: 'Xu nhiệm vụ', amount: 2300, createdAt: now },
    { _id: 'wallet-test-spend', userId: aliceRecord._id, description: 'Tặng quà', amount: -400, createdAt: new Date(now.getTime() - 1000) },
    { _id: 'wallet-test-bob-credit', userId: bobRecord._id, description: 'Giao dịch riêng', amount: 800, createdAt: now },
  ])

  const aliceWallet = await app.inject({ method: 'GET', url: '/api/wallet', headers: { cookie: alice.cookie } })
  assert.equal(aliceWallet.statusCode, 200, aliceWallet.body)
  assert.deepEqual(aliceWallet.json(), {
    balance: 1900,
    coinPriceVnd: 304,
    totalEarned: 2300,
    totalSpent: 400,
    canSendCoins: false,
    partnerName: null,
    transactions: [
      { id: 'wallet-test-credit', code: '', item: 'Xu nhiệm vụ', amount: 2300, createdAt: now.toISOString() },
      { id: 'wallet-test-spend', code: '', item: 'Tặng quà', amount: -400, createdAt: new Date(now.getTime() - 1000).toISOString() },
    ],
  })

  const [aliceHistory, bobHistory] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/wallet/transactions', headers: { cookie: alice.cookie } }),
    app.inject({ method: 'GET', url: '/api/wallet/transactions', headers: { cookie: bob.cookie } }),
  ])
  assert.equal(aliceHistory.json().transactions.length, 2)
  assert.deepEqual(aliceHistory.json().transactions.map((transaction) => transaction.item), ['Xu nhiệm vụ', 'Tặng quà'])
  assert.deepEqual(bobHistory.json().transactions.map((transaction) => transaction.item), ['Giao dịch riêng'])

  const bobWallet = await app.inject({ method: 'GET', url: '/api/wallet', headers: { cookie: bob.cookie } })
  assert.equal(bobWallet.json().balance, 800)
  assert.deepEqual(bobWallet.json().transactions.map((transaction) => transaction.item), ['Giao dịch riêng'])
})

test('coin transfers require a connection and atomically update both wallets', async () => {
  const blocked = await app.inject({
    method: 'POST',
    url: '/api/wallet/send',
    headers: { cookie: alice.cookie, origin },
    payload: { amount: 1 },
  })
  assert.equal(blocked.statusCode, 403)

  const users = rankingClient.db('loveforyou-tests').collection('users')
  const senderRecord = await users.findOne({ email: 'alice@example.test' })
  const recipientRecord = await users.findOne({ email: 'bob@example.test' })
  const members = [senderRecord._id, recipientRecord._id].sort()
  const relationships = rankingClient.db('loveforyou-tests').collection('relationships')
  await relationships.insertOne({
    _id: 'wallet-transfer-relationship',
    pairKey: members.join(':'),
    members,
    relationshipStart: '2025-01-01',
    createdAt: new Date(),
  })
  await rankingClient.db('loveforyou-tests').collection('walletAccounts').insertOne({
    _id: 'wallet-transfer-sender-account',
    userId: senderRecord._id,
    balance: 1900,
    updatedAt: new Date(),
  })

  const invalidAmount = await app.inject({
    method: 'POST',
    url: '/api/wallet/send',
    headers: { cookie: alice.cookie, origin },
    payload: { amount: 0 },
  })
  assert.equal(invalidAmount.statusCode, 400)

  const transferred = await app.inject({
    method: 'POST',
    url: '/api/wallet/send',
    headers: { cookie: alice.cookie, origin },
    payload: { amount: 175 },
  })
  assert.equal(transferred.statusCode, 201, transferred.body)

  const [senderWallet, recipientWallet] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/wallet', headers: { cookie: alice.cookie } }),
    app.inject({ method: 'GET', url: '/api/wallet', headers: { cookie: bob.cookie } }),
  ])
  assert.equal(senderWallet.json().balance, 1725)
  assert.equal(senderWallet.json().totalSpent, 575)
  assert.equal(senderWallet.json().partnerName, 'Bob')
  assert.equal(recipientWallet.json().balance, 975)
  assert.equal(recipientWallet.json().totalEarned, 975)
  assert.ok(recipientWallet.json().transactions.some((transaction) => transaction.item === 'Nhận xu từ người đã kết nối'))

  await relationships.deleteOne({ _id: 'wallet-transfer-relationship' })
  await rankingClient.db('loveforyou-tests').collection('walletAccounts').deleteMany({ userId: { $in: [senderRecord._id, recipientRecord._id] } })
  await rankingClient.db('loveforyou-tests').collection('walletTransactions').deleteMany({ transferId: transferred.json().transferId })
})

test('registration preserves leading zeros and rejects duplicate email', async () => {
  assert.equal(alice.user.publicId, '000001')
  assert.match(alice.user.publicId, /^\d{6}$/)
  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { origin },
    payload: { email: 'ALICE@example.test', displayName: 'Another', password: 'Correct-Horse-42!', termsAccepted: true },
  })
  assert.equal(duplicate.statusCode, 409)

  const previousAdminEmail = process.env.ADMIN_EMAIL
  process.env.ADMIN_EMAIL = 'requested-admin@example.test'
  try {
    const attemptedAdminRegistration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { origin },
      payload: {
        email: 'requested-admin@example.test',
        displayName: 'Attempted Admin',
        password: 'Correct-Horse-42!',
        termsAccepted: true,
        role: 'admin',
      },
    })
    assert.equal(attemptedAdminRegistration.statusCode, 201, attemptedAdminRegistration.body)
    assert.equal(attemptedAdminRegistration.json().user.role, 'member')
    const adminEndpoint = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie: cookieFrom(attemptedAdminRegistration) } })
    assert.equal(adminEndpoint.statusCode, 403)
  } finally {
    if (previousAdminEmail === undefined) delete process.env.ADMIN_EMAIL
    else process.env.ADMIN_EMAIL = previousAdminEmail
  }
})

test('password strength requires six characters, mixed case, a digit, and a symbol', () => {
  assert.equal(isStrongPassword('Aa1!xy'), true)
  assert.equal(isStrongPassword('Aa1!x'), false)
  assert.equal(isStrongPassword('abcdef1!'), false)
  assert.equal(isStrongPassword('ABCDEF1!'), false)
  assert.equal(isStrongPassword('Abcdef!'), false)
  assert.equal(isStrongPassword(`Aa1!${'x'.repeat(125)}`), false)
})

test('authenticated requests refresh lastSeenAt so online state is based on real activity', async () => {
  const beforeMe = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: alice.cookie, origin } })
  assert.equal(beforeMe.statusCode, 200)
  const refreshedUser = await rankingClient.db('loveforyou-tests').collection('users').findOne({ email: 'alice@example.test' })
  assert.ok(refreshedUser?.lastSeenAt)
  assert.ok(new Date(refreshedUser.lastSeenAt).getTime() > 0)
})

test('login uses a generic error and authenticated profile belongs to the session', async () => {
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin },
    payload: { email: 'alice@example.test', password: 'wrong-password' },
  })
  assert.equal(invalid.statusCode, 401)
  assert.match(invalid.json().error, /Email hoặc mật khẩu/)

  const rememberedLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin },
    payload: { email: 'alice@example.test', password: 'Correct-Horse-42!', rememberMe: true },
  })
  assert.equal(rememberedLogin.statusCode, 200)
  assert.match(rememberedLogin.headers['set-cookie'], /Max-Age=/)

  const sessionLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin },
    payload: { email: 'alice@example.test', password: 'Correct-Horse-42!', rememberMe: false },
  })
  assert.equal(sessionLogin.statusCode, 200)
  assert.doesNotMatch(sessionLogin.headers['set-cookie'], /Max-Age=/)

  const invalidRememberOption = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin },
    payload: { email: 'alice@example.test', password: 'Correct-Horse-42!', rememberMe: 'yes' },
  })
  assert.equal(invalidRememberOption.statusCode, 400)

  const profile = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie: bob.cookie } })
  assert.equal(profile.statusCode, 200)
  assert.equal(profile.json().email, 'bob@example.test')
  assert.ok(profile.json().joinedAt)
  assert.equal(profile.json().bio, '')
  assert.deepEqual(profile.json().pinnedQuickActions, ['love-letter', 'memory', 'gift', 'countdown'])
  const savedBio = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: bob.cookie, origin },
    payload: { bio: 'Thích những ngày bình yên bên nhau.' },
  })
  assert.equal(savedBio.statusCode, 200, savedBio.body)
  assert.equal(savedBio.json().bio, 'Thích những ngày bình yên bên nhau.')
  const longBio = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: bob.cookie, origin },
    payload: { bio: 'a'.repeat(161) },
  })
  assert.equal(longBio.statusCode, 400)
  const attemptedLoveLevelEdit = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: bob.cookie, origin },
    payload: { loveLevel: { number: 999 } },
  })
  assert.equal(attemptedLoveLevelEdit.statusCode, 400)

  const savedPins = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: bob.cookie, origin },
    payload: { pinnedQuickActions: ['gift', 'memory', 'daily-question'] },
  })
  assert.equal(savedPins.statusCode, 200)
  assert.deepEqual(savedPins.json().pinnedQuickActions, ['gift', 'memory', 'daily-question', 'love-letter'])
  const savedFourPins = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: bob.cookie, origin },
    payload: { pinnedQuickActions: ['love-letter', 'memory', 'gift', 'private-room'] },
  })
  assert.equal(savedFourPins.statusCode, 200)
  assert.equal(savedFourPins.json().pinnedQuickActions.length, 4)
  const invalidPins = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: bob.cookie, origin },
    payload: { pinnedQuickActions: ['gift', 'gift', 'unknown'] },
  })
  assert.equal(invalidPins.statusCode, 400)
  const fivePins = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: bob.cookie, origin },
    payload: { pinnedQuickActions: ['love-letter', 'memory', 'gift', 'countdown', 'private-room'] },
  })
  assert.equal(fivePins.statusCode, 400)
  const profileAfterInvalidUpdate = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie: bob.cookie } })
  assert.equal(profileAfterInvalidUpdate.json().pinnedQuickActions.length, 4)
})

test('entry writes are idempotent and every read or mutation is owner-scoped', async () => {
  const payload = { type: 'journal', title: 'Ngày đầu tiên', date: '2026-10-19', text: 'Một dòng riêng tư.' }
  const headers = { cookie: alice.cookie, origin, 'idempotency-key': 'journal-create-0001' }
  const created = await app.inject({ method: 'POST', url: '/api/entries', headers, payload })
  assert.equal(created.statusCode, 201, created.body)
  const repeated = await app.inject({ method: 'POST', url: '/api/entries', headers, payload })
  assert.equal(repeated.statusCode, 200)
  assert.equal(repeated.json().entry.id, created.json().entry.id)

  const aliceList = await app.inject({ method: 'GET', url: '/api/entries?type=journal', headers: { cookie: alice.cookie } })
  const bobList = await app.inject({ method: 'GET', url: '/api/entries?type=journal', headers: { cookie: bob.cookie } })
  assert.equal(aliceList.json().entries.length, 1)
  assert.equal(bobList.json().entries.length, 0)

  const anonymousList = await app.inject({ method: 'GET', url: '/api/entries?type=journal' })
  assert.equal(anonymousList.statusCode, 401)

  const forgedOwner = await app.inject({
    method: 'POST',
    url: '/api/entries',
    headers: { cookie: bob.cookie, origin, 'idempotency-key': 'forged-owner-0001' },
    payload: { ...payload, ownerUserId: alice.user.publicId },
  })
  assert.equal(forgedOwner.statusCode, 400)

  const id = created.json().entry.id
  const crossRead = await app.inject({ method: 'PATCH', url: `/api/entries/${id}`, headers: { cookie: bob.cookie, origin }, payload: { title: 'Chiếm quyền' } })
  const crossDelete = await app.inject({ method: 'DELETE', url: `/api/entries/${id}`, headers: { cookie: bob.cookie, origin } })
  assert.equal(crossRead.statusCode, 404)
  assert.equal(crossDelete.statusCode, 404)

  const updated = await app.inject({ method: 'PATCH', url: `/api/entries/${id}`, headers: { cookie: alice.cookie, origin }, payload: { title: 'Ngày đầu tiên đã sửa' } })
  assert.equal(updated.statusCode, 200)
  assert.equal(updated.json().entry.title, 'Ngày đầu tiên đã sửa')
  const deleted = await app.inject({ method: 'DELETE', url: `/api/entries/${id}`, headers: { cookie: alice.cookie, origin } })
  assert.equal(deleted.statusCode, 204)
})

test('couple invitations require recipient consent and create one relationship atomically', async () => {
  const carol = await register('connection-target@example.test', 'Carol', { dateOfBirth: '2000-04-12', gender: 'female' })
  const carolProfile = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie: carol.cookie } })
  assert.equal(carolProfile.json().dateOfBirth, '2000-04-12')
  assert.equal(carolProfile.json().gender, 'female')
  const privateEntry = await app.inject({
    method: 'POST',
    url: '/api/entries',
    headers: { cookie: alice.cookie, origin, 'idempotency-key': 'private-before-connect' },
    payload: { type: 'journal', title: 'Riêng tư', date: '2026-10-19', text: 'Chỉ Alice được xem.' },
  })
  assert.equal(privateEntry.statusCode, 201)
  const search = await app.inject({ method: 'GET', url: `/api/connections/search?id=${bob.user.publicId}`, headers: { cookie: alice.cookie } })
  assert.equal(search.statusCode, 200)
  assert.deepEqual(search.json().account, { publicId: bob.user.publicId, displayName: 'Bob' })

  const invalidSearch = await app.inject({ method: 'GET', url: '/api/connections/search?id=123', headers: { cookie: alice.cookie } })
  const selfSearch = await app.inject({ method: 'GET', url: `/api/connections/search?id=${alice.user.publicId}`, headers: { cookie: alice.cookie } })
  assert.equal(invalidSearch.statusCode, 400)
  assert.equal(selfSearch.statusCode, 400)

  const sent = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: alice.cookie, origin },
    payload: { recipientId: bob.user.publicId, message: 'Xin chào bạn.', relationshipStart: '2025-08-12' },
  })
  assert.equal(sent.statusCode, 201, sent.body)
  const invitationId = sent.json().invitation.id
  assert.equal(sent.json().invitation.status, 'pending')

  const missingRelationshipStart = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: alice.cookie, origin },
    payload: { recipientId: carol.user.publicId },
  })
  assert.equal(missingRelationshipStart.statusCode, 400)
  const invalidRelationshipStart = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: alice.cookie, origin },
    payload: { recipientId: carol.user.publicId, relationshipStart: '2025-02-30' },
  })
  const futureRelationshipStart = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: alice.cookie, origin },
    payload: { recipientId: carol.user.publicId, relationshipStart: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) },
  })
  assert.equal(invalidRelationshipStart.statusCode, 400)
  assert.equal(futureRelationshipStart.statusCode, 400)

  const bobNotifications = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie: bob.cookie } })
  const aliceNotifications = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie: alice.cookie } })
  const notificationId = bobNotifications.json().notifications[0].id
  assert.equal(bobNotifications.json().notifications.length, 1)
  assert.equal(bobNotifications.json().notifications[0].actorName, 'Alice')
  assert.equal('email' in bobNotifications.json().notifications[0], false)
  assert.equal(aliceNotifications.json().notifications.length, 0)
  const crossRead = await app.inject({
    method: 'POST',
    url: `/api/notifications/${notificationId}/read`,
    headers: { cookie: alice.cookie, origin },
    payload: {},
  })
  const markedRead = await app.inject({
    method: 'POST',
    url: `/api/notifications/${notificationId}/read`,
    headers: { cookie: bob.cookie, origin },
    payload: {},
  })
  assert.equal(crossRead.statusCode, 404)
  assert.equal(markedRead.statusCode, 200)

  const duplicateReverse = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: bob.cookie, origin },
    payload: { recipientId: alice.user.publicId, relationshipStart: '2025-08-12' },
  })
  const senderCannotAccept = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${invitationId}/accept`,
    headers: { cookie: alice.cookie, origin },
    payload: {},
  })
  const received = await app.inject({ method: 'GET', url: '/api/connections', headers: { cookie: bob.cookie } })
  assert.equal(duplicateReverse.statusCode, 409)
  assert.equal(senderCannotAccept.statusCode, 404)
  assert.equal(received.json().received.length, 1)
  assert.equal(received.json().received[0].id, invitationId)

  const accepted = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${invitationId}/accept`,
    headers: { cookie: bob.cookie, origin },
    payload: {},
  })
  const acceptedAgain = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${invitationId}/accept`,
    headers: { cookie: bob.cookie, origin },
    payload: {},
  })
  assert.equal(accepted.statusCode, 200, accepted.body)
  assert.equal(acceptedAgain.statusCode, 409)

  const emptyChat = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: { cookie: alice.cookie } })
  assert.equal(emptyChat.statusCode, 200, emptyChat.body)
  assert.deepEqual(emptyChat.json().messages, [])
  const users = rankingClient.db('loveforyou-tests').collection('users')
  const aliceRecord = await users.findOne({ email: 'alice@example.test' })
  const bobRecord = await users.findOne({ email: 'bob@example.test' })
  const unrelatedActivityId = 'unrelated-unread-activity'
  await rankingClient.db('loveforyou-tests').collection('notifications').insertOne({
    _id: unrelatedActivityId,
    userId: bobRecord._id,
    actorUserId: aliceRecord._id,
    type: 'love_milestone',
    createdAt: new Date(),
    readAt: '',
  })
  const sentChatMessage = await app.inject({
    method: 'POST',
    url: '/api/chat/messages',
    headers: { cookie: alice.cookie, origin },
    payload: { text: 'private-chat-admin-regression-7f2a' },
  })
  assert.equal(sentChatMessage.statusCode, 201, sentChatMessage.body)
  assert.equal(sentChatMessage.json().message.sender, 'me')
  const bobMessageNotifications = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie: bob.cookie } })
  const messageNotification = bobMessageNotifications.json().notifications.find((item) => item.type === 'chat_message')
  assert.ok(messageNotification)
  assert.equal(messageNotification.actorName, 'Alice')
  assert.equal(messageNotification.message, 'private-chat-admin-regression-7f2a')
  assert.equal(messageNotification.messageId, sentChatMessage.json().message.id)
  assert.equal(messageNotification.readAt, '')
  const bobChat = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: { cookie: bob.cookie } })
  assert.equal(bobChat.json().messages[0].sender, 'partner')
  assert.equal(bobChat.json().messages[0].text, 'private-chat-admin-regression-7f2a')
  await users.updateOne({ _id: aliceRecord._id }, { $set: { role: 'admin' } })
  const adminOverview = await app.inject({ method: 'GET', url: '/api/admin/overview', headers: { cookie: alice.cookie } })
  await users.updateOne({ _id: aliceRecord._id }, { $set: { role: 'member' } })
  assert.equal(adminOverview.statusCode, 200, adminOverview.body)
  assert.doesNotMatch(JSON.stringify(adminOverview.json()), /private-chat-admin-regression-7f2a/)
  assert.ok(adminOverview.json().activities.some((item) => item.title === 'Có tin nhắn mới'))
  assert.equal(bobChat.json().messages[0].readAt, '')
  const aliceReadReceipt = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: { cookie: alice.cookie } })
  assert.equal(aliceReadReceipt.json().messages[0].readAt, '')
  const markedChatRead = await app.inject({ method: 'POST', url: '/api/chat/read', headers: { cookie: bob.cookie, origin } })
  assert.equal(markedChatRead.statusCode, 200, markedChatRead.body)
  assert.ok(markedChatRead.json().readAt)
  const bobNotificationsAfterChatRead = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie: bob.cookie } })
  const readMessageNotification = bobNotificationsAfterChatRead.json().notifications.find((item) => item.id === messageNotification.id)
  const unrelatedNotification = bobNotificationsAfterChatRead.json().notifications.find((item) => item.id === unrelatedActivityId)
  assert.ok(readMessageNotification.readAt)
  assert.equal(unrelatedNotification.readAt, '')
  await rankingClient.db('loveforyou-tests').collection('notifications').deleteOne({ _id: unrelatedActivityId })
  const aliceReadReceiptAfterMark = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: { cookie: alice.cookie } })
  assert.ok(aliceReadReceiptAfterMark.json().messages[0].readAt)
  const sentGift = await app.inject({
    method: 'POST',
    url: '/api/gifts/send',
    headers: { cookie: alice.cookie, origin },
    payload: { giftId: 'rose-bouquet', message: 'Tặng bạn nè!' },
  })
  assert.equal(sentGift.statusCode, 201, sentGift.body)
  assert.equal(sentGift.json().balance, 1850)
  const invalidGift = await app.inject({
    method: 'POST',
    url: '/api/gifts/send',
    headers: { cookie: alice.cookie, origin },
    payload: { giftId: 'not-a-gift' },
  })
  assert.equal(invalidGift.statusCode, 400)
  const insufficientGift = await app.inject({
    method: 'POST',
    url: '/api/gifts/send',
    headers: { cookie: alice.cookie, origin },
    payload: { giftId: 'love-flight' },
  })
  assert.equal(insufficientGift.statusCode, 409)
  const bobGiftNotifications = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie: bob.cookie } })
  const giftNotification = bobGiftNotifications.json().notifications.find((item) => item.type === 'gift_received')
  assert.ok(giftNotification)
  assert.equal(giftNotification.actorName, 'Alice')
  assert.equal(giftNotification.giftId, 'rose-bouquet')
  assert.equal(giftNotification.message, 'Tặng bạn nè!')
  const bobReceivedGifts = await app.inject({ method: 'GET', url: '/api/gifts/received', headers: { cookie: bob.cookie } })
  const aliceReceivedGifts = await app.inject({ method: 'GET', url: '/api/gifts/received', headers: { cookie: alice.cookie } })
  assert.equal(bobReceivedGifts.json().gifts.length, 1)
  assert.equal(bobReceivedGifts.json().gifts[0].openedAt, '')
  assert.equal(aliceReceivedGifts.json().gifts.length, 0)
  const crossOpenGift = await app.inject({
    method: 'POST',
    url: `/api/gifts/received/${giftNotification.id}/open`,
    headers: { cookie: alice.cookie, origin },
    payload: {},
  })
  assert.equal(crossOpenGift.statusCode, 404)
  const unopenedGiftRedemption = await app.inject({
    method: 'POST',
    url: `/api/gifts/received/${giftNotification.id}/redeem`,
    headers: { cookie: bob.cookie, origin },
    payload: {},
  })
  assert.equal(unopenedGiftRedemption.statusCode, 409)
  const openedGift = await app.inject({
    method: 'POST',
    url: `/api/gifts/received/${giftNotification.id}/open`,
    headers: { cookie: bob.cookie, origin },
    payload: {},
  })
  assert.equal(openedGift.statusCode, 200, openedGift.body)
  assert.ok(openedGift.json().gift.openedAt)
  const openedAgain = await app.inject({
    method: 'POST',
    url: `/api/gifts/received/${giftNotification.id}/open`,
    headers: { cookie: bob.cookie, origin },
    payload: {},
  })
  assert.equal(openedAgain.json().gift.openedAt, openedGift.json().gift.openedAt)
  const crossRedeemGift = await app.inject({
    method: 'POST',
    url: `/api/gifts/received/${giftNotification.id}/redeem`,
    headers: { cookie: alice.cookie, origin },
    payload: {},
  })
  assert.equal(crossRedeemGift.statusCode, 404)
  const redeemedGift = await app.inject({
    method: 'POST',
    url: `/api/gifts/received/${giftNotification.id}/redeem`,
    headers: { cookie: bob.cookie, origin },
    payload: {},
  })
  assert.equal(redeemedGift.statusCode, 200, redeemedGift.body)
  assert.equal(redeemedGift.json().redeemedCoins, 50)
  assert.equal(redeemedGift.json().balance, 850)
  const redeemAgain = await app.inject({
    method: 'POST',
    url: `/api/gifts/received/${giftNotification.id}/redeem`,
    headers: { cookie: bob.cookie, origin },
    payload: {},
  })
  assert.equal(redeemAgain.statusCode, 409)
  const bobReceivedGiftsAfterOpen = await app.inject({ method: 'GET', url: '/api/gifts/received', headers: { cookie: bob.cookie } })
  assert.equal(bobReceivedGiftsAfterOpen.json().gifts[0].openedAt, openedGift.json().gift.openedAt)
  assert.equal(bobReceivedGiftsAfterOpen.json().gifts[0].redeemedCoins, 50)
  const typingStarted = await app.inject({ method: 'POST', url: '/api/chat/typing', headers: { cookie: bob.cookie, origin }, payload: { typing: true } })
  assert.equal(typingStarted.statusCode, 200)
  const aliceSeesTyping = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: { cookie: alice.cookie } })
  assert.equal(aliceSeesTyping.json().partnerTyping, true)
  const typingStopped = await app.inject({ method: 'POST', url: '/api/chat/typing', headers: { cookie: bob.cookie, origin }, payload: { typing: false } })
  assert.equal(typingStopped.statusCode, 200)
  const aliceSeesTypingStopped = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: { cookie: alice.cookie } })
  assert.equal(aliceSeesTypingStopped.json().partnerTyping, false)
  const unconnectedChat = await app.inject({ method: 'POST', url: '/api/chat/messages', headers: { cookie: carol.cookie, origin }, payload: { text: 'Xin chào' } })
  assert.equal(unconnectedChat.statusCode, 403)
  const unconnectedGift = await app.inject({ method: 'POST', url: '/api/gifts/send', headers: { cookie: carol.cookie, origin }, payload: { giftId: 'rose-bouquet' } })
  assert.equal(unconnectedGift.statusCode, 403)
  const unconnectedRead = await app.inject({ method: 'POST', url: '/api/chat/read', headers: { cookie: carol.cookie, origin } })
  assert.equal(unconnectedRead.statusCode, 403)
  const unconnectedTyping = await app.inject({ method: 'POST', url: '/api/chat/typing', headers: { cookie: carol.cookie, origin }, payload: { typing: true } })
  assert.equal(unconnectedTyping.statusCode, 403)

  const aliceState = await app.inject({ method: 'GET', url: '/api/connections', headers: { cookie: alice.cookie } })
  const bobState = await app.inject({ method: 'GET', url: '/api/connections', headers: { cookie: bob.cookie } })
  assert.equal(aliceState.json().relationship.publicId, bob.user.publicId)
  assert.equal(aliceState.json().relationship.dateOfBirth, '2000-02-03')
  assert.equal(aliceState.json().relationship.relationshipStart, '2025-08-12')
  assert.equal(bobState.json().relationship.publicId, alice.user.publicId)
  assert.equal(bobState.json().relationship.relationshipStart, '2025-08-12')
  const [aliceProfile, bobProfile] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/profile', headers: { cookie: alice.cookie } }),
    app.inject({ method: 'GET', url: '/api/profile', headers: { cookie: bob.cookie } }),
  ])
  assert.equal(aliceProfile.json().relationshipStart, '2025-08-12')
  assert.equal(bobProfile.json().relationshipStart, '2025-08-12')
  const [aliceLoveLevel, bobLoveLevel, unconnectedLoveLevel] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: alice.cookie } }),
    app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: bob.cookie } }),
    app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: carol.cookie } }),
  ])
  assert.equal(aliceLoveLevel.statusCode, 200, aliceLoveLevel.body)
  assert.equal(bobLoveLevel.statusCode, 200, bobLoveLevel.body)
  assert.equal(unconnectedLoveLevel.statusCode, 404)
  assert.equal(aliceLoveLevel.json().coupleRank, 1)
  assert.equal(bobLoveLevel.json().coupleRank, 1)
  assert.equal(aliceLoveLevel.json().currentLevel.number, bobLoveLevel.json().currentLevel.number)
  assert.ok(aliceLoveLevel.json().milestones.some((item) => item.id === 'days-100'))
  assert.ok(aliceLoveLevel.json().duration.years >= 1)
  assert.ok(aliceLoveLevel.json().levels.some((item) => item.number === 1 && item.title && item.icon && item.description && item.date))
  assert.ok(aliceLoveLevel.json().levels.some((item) => item.number === aliceLoveLevel.json().nextLevel.number && !item.achieved))
  const repeatedLoveLevel = await app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: alice.cookie } })
  assert.deepEqual(
    repeatedLoveLevel.json().milestones.map((item) => item.id),
    aliceLoveLevel.json().milestones.map((item) => item.id),
  )
  const updateRelationshipStart = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: alice.cookie, origin },
    payload: { displayName: 'Alice mới', relationshipStart: '2025-09-01' },
  })
  const syncedBobProfile = await app.inject({ method: 'GET', url: '/api/profile', headers: { cookie: bob.cookie } })
  assert.equal(updateRelationshipStart.statusCode, 200)
  assert.equal(syncedBobProfile.json().displayName, 'Bob')
  assert.equal(syncedBobProfile.json().relationshipStart, '2025-09-01')
  const recentRelationshipStart = new Date(todayInVietnam().getTime() - 6 * 86_400_000).toISOString().slice(0, 10)
  const setRecentRelationshipStart = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: alice.cookie, origin },
    payload: { relationshipStart: recentRelationshipStart },
  })
  assert.equal(setRecentRelationshipStart.statusCode, 200)
  const [levelWithMilestone, partnerLevelWithMilestone] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: alice.cookie } }),
    app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: bob.cookie } }),
  ])
  const aheadRelationshipStart = new Date(todayInVietnam().getTime() - 7 * 86_400_000).toISOString().slice(0, 10)
  await rankingRelationships.insertMany(Array.from({ length: 99 }, (_, index) => ({
    pairKey: `ranking-test-${index}`,
    members: [new ObjectId(), new ObjectId()],
    relationshipStart: aheadRelationshipStart,
    createdAt: new Date(),
  })))
  const topHundred = await app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: alice.cookie } })
  assert.equal(topHundred.json().coupleRank, 100)
  await rankingRelationships.insertOne({
    pairKey: 'ranking-test-100',
    members: [new ObjectId(), new ObjectId()],
    relationshipStart: aheadRelationshipStart,
    createdAt: new Date(),
  })
  const outsideTopHundred = await app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: alice.cookie } })
  assert.equal(outsideTopHundred.json().coupleRank, 101)
  const daySeven = levelWithMilestone.json().milestones.find((item) => item.id === 'days-7')
  const partnerDaySeven = partnerLevelWithMilestone.json().milestones.find((item) => item.id === 'days-7')
  assert.ok(daySeven.notificationId)
  assert.ok(partnerDaySeven.notificationId)
  assert.equal(daySeven.message, 'Chúc mừng hai bạn đã bên nhau trọn vẹn 7 ngày đầu tiên!')
  const markedMilestoneRead = await app.inject({
    method: 'POST',
    url: `/api/notifications/${daySeven.notificationId}/read`,
    headers: { cookie: alice.cookie, origin },
    payload: {},
  })
  assert.equal(markedMilestoneRead.statusCode, 200)
  const repeatedLevelWithMilestone = await app.inject({ method: 'GET', url: '/api/love-level', headers: { cookie: alice.cookie } })
  assert.equal(repeatedLevelWithMilestone.json().milestones.find((item) => item.id === 'days-7').notificationId, daySeven.notificationId)
  assert.ok(repeatedLevelWithMilestone.json().milestones.find((item) => item.id === 'days-7').readAt)
  const levelNotification = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie: alice.cookie } })
  assert.equal(levelNotification.json().notifications.filter((item) => item.title === 'Đạt Love Level LV.2').length, 1)
  const bobJournal = await app.inject({ method: 'GET', url: '/api/entries?type=journal', headers: { cookie: bob.cookie } })
  assert.equal(bobJournal.json().entries.length, 0)

  const secondRelationship = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: alice.cookie, origin },
    payload: { recipientId: carol.user.publicId, relationshipStart: '2025-08-12' },
  })
  assert.equal(secondRelationship.statusCode, 409)
})

test('a pending invitation can be rejected or cancelled only by the correct participant', async () => {
  const eve = await register('eve@example.test', 'Eve')
  const dave = await register('dave@example.test', 'Dave')
  const invitation = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: eve.cookie, origin },
    payload: { recipientId: dave.user.publicId, relationshipStart: '2025-08-12' },
  })
  assert.equal(invitation.statusCode, 201)
  const invitationId = invitation.json().invitation.id

  const senderRejects = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${invitationId}/reject`,
    headers: { cookie: eve.cookie, origin },
    payload: {},
  })
  const recipientCancels = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${invitationId}/cancel`,
    headers: { cookie: dave.cookie, origin },
    payload: {},
  })
  assert.equal(senderRejects.statusCode, 404)
  assert.equal(recipientCancels.statusCode, 404)

  const rejected = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${invitationId}/reject`,
    headers: { cookie: dave.cookie, origin },
    payload: {},
  })
  const cannotAcceptRejected = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${invitationId}/accept`,
    headers: { cookie: dave.cookie, origin },
    payload: {},
  })
  assert.equal(rejected.statusCode, 200)
  assert.equal(rejected.json().status, 'rejected')
  assert.equal(cannotAcceptRejected.statusCode, 409)

  const secondInvitation = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: eve.cookie, origin },
    payload: { recipientId: dave.user.publicId, relationshipStart: '2025-08-12' },
  })
  const recipientCannotCancel = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${secondInvitation.json().invitation.id}/cancel`,
    headers: { cookie: dave.cookie, origin },
    payload: {},
  })
  const cancelled = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${secondInvitation.json().invitation.id}/cancel`,
    headers: { cookie: eve.cookie, origin },
    payload: {},
  })
  const cannotAcceptCancelled = await app.inject({
    method: 'POST',
    url: `/api/connections/invitations/${secondInvitation.json().invitation.id}/accept`,
    headers: { cookie: dave.cookie, origin },
    payload: {},
  })
  assert.equal(secondInvitation.statusCode, 201)
  assert.equal(recipientCannotCancel.statusCode, 404)
  assert.equal(cancelled.statusCode, 200)
  assert.equal(cancelled.json().status, 'cancelled')
  assert.equal(cannotAcceptCancelled.statusCode, 409)
})

test('simultaneous accept and reject produce one winning invitation transition', async () => {
  const sender = await register('race-sender@example.test', 'Sender')
  const recipient = await register('race-recipient@example.test', 'Recipient')
  const sent = await app.inject({
    method: 'POST',
    url: '/api/connections/invitations',
    headers: { cookie: sender.cookie, origin },
    payload: { recipientId: recipient.user.publicId, relationshipStart: '2025-08-12' },
  })
  const invitationId = sent.json().invitation.id
  const [accepted, rejected] = await Promise.all([
    app.inject({ method: 'POST', url: `/api/connections/invitations/${invitationId}/accept`, headers: { cookie: recipient.cookie, origin }, payload: {} }),
    app.inject({ method: 'POST', url: `/api/connections/invitations/${invitationId}/reject`, headers: { cookie: recipient.cookie, origin }, payload: {} }),
  ])
  assert.equal(sent.statusCode, 201)
  assert.deepEqual([accepted.statusCode, rejected.statusCode].sort(), [200, 409])
  const senderState = await app.inject({ method: 'GET', url: '/api/connections', headers: { cookie: sender.cookie } })
  const recipientState = await app.inject({ method: 'GET', url: '/api/connections', headers: { cookie: recipient.cookie } })
  assert.equal(Boolean(senderState.json().relationship), Boolean(recipientState.json().relationship))
})

test('admin user status actions are permission-checked, audited, and revoke sessions; couple records omit private messages', async () => {
  const users = rankingClient.db('loveforyou-tests').collection('users')
  const aliceRecord = await users.findOne({ email: 'alice@example.test' })
  const previousRole = aliceRecord.role
  await users.updateOne({ _id: aliceRecord._id }, { $set: { role: 'admin' } })
  const member = await register('admin-target@example.test', 'Admin Target')
  const partner = await register('admin-partner@example.test', 'Admin Partner')
  const memberRecord = await users.findOne({ email: 'admin-target@example.test' })
  const partnerRecord = await users.findOne({ email: 'admin-partner@example.test' })
  const adminHeaders = { cookie: alice.cookie, origin }

  try {
    const forbidden = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${memberRecord._id}/status`,
      headers: { cookie: bob.cookie, origin },
      payload: { status: 'locked', reason: 'Policy violation' },
    })
    assert.equal(forbidden.statusCode, 403)

    const activeUsers = await app.inject({
      method: 'GET',
      url: '/api/admin/users?search=Admin%20Target&status=active',
      headers: adminHeaders,
    })
    assert.equal(activeUsers.statusCode, 200, activeUsers.body)
    assert.equal(activeUsers.json().users.length, 1)
    assert.equal(activeUsers.json().users[0].status, 'Đang hoạt động')
    assert.equal(activeUsers.json().users[0].online, true)

    const locked = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${memberRecord._id}/status`,
      headers: adminHeaders,
      payload: { status: 'locked', reason: 'Yêu cầu hỗ trợ đã xác minh' },
    })
    assert.equal(locked.statusCode, 200, locked.body)
    assert.equal(locked.json().status, 'locked')
    const oldSession = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: member.cookie } })
    assert.equal(oldSession.statusCode, 401)
    const lockedUsers = await app.inject({
      method: 'GET',
      url: '/api/admin/users?search=Admin%20Target&status=locked',
      headers: adminHeaders,
    })
    assert.equal(lockedUsers.json().users.length, 1)
    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/users/${memberRecord._id}`,
      headers: adminHeaders,
    })
    assert.equal(detail.statusCode, 200, detail.body)
    assert.equal(detail.json().user.lockReason, 'Yêu cầu hỗ trợ đã xác minh')
    assert.ok(detail.json().user.lockedAt)
    assert.equal(JSON.stringify(detail.json()).includes('passwordHash'), false)
    const invalidPage = await app.inject({
      method: 'GET',
      url: '/api/admin/users?page=0&pageSize=25',
      headers: adminHeaders,
    })
    assert.equal(invalidPage.statusCode, 400)
    const exportResponse = await app.inject({
      method: 'GET',
      url: '/api/admin/users/export?search=Admin%20Target&status=locked',
      headers: adminHeaders,
    })
    assert.equal(exportResponse.statusCode, 200, exportResponse.body)
    assert.match(exportResponse.headers['content-type'], /text\/csv/)
    assert.match(exportResponse.body, /Yêu cầu hỗ trợ đã xác minh/)

    const unlocked = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${memberRecord._id}/status`,
      headers: adminHeaders,
      payload: { status: 'active' },
    })
    assert.equal(unlocked.statusCode, 200, unlocked.body)
    const auditLogs = await rankingClient.db('loveforyou-tests').collection('adminAuditLogs')
      .find({ targetUserId: memberRecord._id }).sort({ createdAt: 1 }).toArray()
    assert.deepEqual(auditLogs.map((entry) => entry.action), ['user.locked', 'user.unlocked'])

    const createdAt = new Date()
    const relationshipId = 'admin-couples-relationship-test'
    const invitationId = 'admin-couples-invitation-test'
    await rankingRelationships.insertOne({
      _id: relationshipId,
      pairKey: [memberRecord._id, partnerRecord._id].sort().join(':'),
      members: [memberRecord._id, partnerRecord._id].sort(),
      relationshipStart: '2025-01-02',
      createdAt,
    })
    await rankingClient.db('loveforyou-tests').collection('invitations').insertOne({
      _id: invitationId,
      senderUserId: memberRecord._id,
      recipientUserId: partnerRecord._id,
      message: 'Private invitation message must not appear',
      relationshipStart: '2025-01-02',
      status: 'rejected',
      createdAt,
      actedAt: createdAt,
      expiresAt: createdAt,
    })
    const couples = await app.inject({
      method: 'GET',
      url: '/api/admin/couples?search=Admin%20Target&status=connected',
      headers: adminHeaders,
    })
    assert.equal(couples.statusCode, 200, couples.body)
    assert.deepEqual(couples.json().couples.map((couple) => couple.status), ['connected'])
    assert.equal(JSON.stringify(couples.json()).includes('Private invitation message'), false)
    const invitationHistory = await app.inject({
      method: 'GET',
      url: '/api/admin/couples?search=Admin%20Target&status=rejected',
      headers: adminHeaders,
    })
    assert.equal(invitationHistory.statusCode, 200, invitationHistory.body)
    assert.deepEqual(invitationHistory.json().couples.map((couple) => couple.status), ['rejected'])
    await rankingRelationships.deleteOne({ _id: relationshipId })
    await rankingClient.db('loveforyou-tests').collection('invitations').deleteOne({ _id: invitationId })
  } finally {
    await users.updateOne({ _id: aliceRecord._id }, { $set: { role: previousRole ?? 'member' } })
  }
})

test('state-changing requests reject an untrusted Origin and logout revokes the session', async () => {
  const csrf = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: alice.cookie, origin: 'https://untrusted.example' },
    payload: { displayName: 'Changed' },
  })
  assert.equal(csrf.statusCode, 403)

  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: bob.cookie, origin } })
  assert.equal(logout.statusCode, 204)
  const revoked = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: bob.cookie } })
  assert.equal(revoked.statusCode, 401)
})

test('development allows private-LAN Vite origins but rejects public origins', async () => {
  const lanRequest = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: alice.cookie, origin: 'http://10.1.2.3:5173' },
    payload: { displayName: 'Alice LAN' },
  })
  const publicRequest = await app.inject({
    method: 'PATCH',
    url: '/api/profile',
    headers: { cookie: alice.cookie, origin: 'https://untrusted.example' },
    payload: { displayName: 'Not Alice' },
  })
  assert.equal(lanRequest.statusCode, 200)
  assert.equal(publicRequest.statusCode, 403)
})

test('an ID collision never replaces the account that already owns the ID', async () => {
  const collisionApp = await createApp({
    mongoUri: mongo.getUri(),
    databaseName: 'loveforyou-collision-tests',
    clientOrigin: origin,
    secureCookies: false,
    logger: false,
    generatePublicId: () => '001234',
  })
  try {
    const first = await collisionApp.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { origin },
      payload: { email: 'first@example.test', displayName: 'First', password: 'Correct-Horse-42!', termsAccepted: true },
    })
    const firstCookie = cookieFrom(first)
    const second = await collisionApp.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { origin },
      payload: { email: 'second@example.test', displayName: 'Second', password: 'Correct-Horse-42!', termsAccepted: true },
    })
    const stillOwned = await collisionApp.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: firstCookie } })
    assert.equal(first.statusCode, 201)
    assert.equal(second.statusCode, 503, second.body)
    assert.equal(stillOwned.statusCode, 200)
    assert.equal(stillOwned.json().user.publicId, '001234')
  } finally {
    await collisionApp.close()
  }
})

test('top-up deposits require admin configuration, preserve snapshots, and credit coins exactly once', async () => {
  const administrator = await register('topup-admin@example.test', 'Top-up Admin')
  const customer = await register('topup-customer@example.test', 'Top-up Customer')
  const otherCustomer = await register('topup-other@example.test', 'Other Customer')
  const users = rankingClient.db('loveforyou-tests').collection('users')
  const adminRecord = await users.findOne({ email: 'topup-admin@example.test' })
  const customerRecord = await users.findOne({ email: 'topup-customer@example.test' })
  await users.updateOne({ _id: adminRecord._id }, { $set: { role: 'admin' } })
  const adminHeaders = { cookie: administrator.cookie, origin }
  const customerHeaders = { cookie: customer.cookie, origin }
  const qrImage = ''
  const receipt = 'data:image/png;base64,iVBORw0KGgo='
  const paymentMethod = {
    name: 'Chuyển khoản LoveForYou',
    bankName: 'Ngân hàng thử nghiệm',
    bankCode: 'TEST',
    bankBin: '970415',
    accountHolder: 'LOVEFORYOU',
    accountNumber: '0012345678',
    paymentQrImage: qrImage,
    transferTemplate: 'NAP {code}',
    instructions: 'Chuyển khoản đúng nội dung.',
    enabled: true,
    isDefault: true,
  }
  try {
    const memberConfigAttempt = await app.inject({
      method: 'POST', url: '/api/admin/payment-methods', headers: customerHeaders, payload: paymentMethod,
    })
    assert.equal(memberConfigAttempt.statusCode, 403)
    const memberPackageAttempt = await app.inject({ method: 'GET', url: '/api/admin/topup-packages', headers: customerHeaders })
    assert.equal(memberPackageAttempt.statusCode, 403)
    const invalidImage = await app.inject({
      method: 'POST', url: '/api/admin/payment-methods', headers: adminHeaders,
      payload: { ...paymentMethod, paymentQrImage: 'data:image/png;base64,/9j/AA==' },
    })
    assert.equal(invalidImage.statusCode, 400)
    const invalidTransferTemplate = await app.inject({
      method: 'POST', url: '/api/admin/payment-methods', headers: adminHeaders,
      payload: { ...paymentMethod, transferTemplate: 'Chuyển khoản LoveForYou' },
    })
    assert.equal(invalidTransferTemplate.statusCode, 400)

    const methodResponse = await app.inject({
      method: 'POST', url: '/api/admin/payment-methods', headers: adminHeaders, payload: paymentMethod,
    })
    assert.equal(methodResponse.statusCode, 201, methodResponse.body)
    assert.equal(methodResponse.json().method.bankBin, '970415')
    assert.equal(methodResponse.json().method.name, paymentMethod.name)
    const persistedMethods = await app.inject({ method: 'GET', url: '/api/admin/payment-methods', headers: adminHeaders })
    assert.equal(persistedMethods.statusCode, 200, persistedMethods.body)
    assert.equal(persistedMethods.json().methods.length, 1)
    assert.equal(persistedMethods.json().methods[0].accountNumber, '0012345678')
    assert.equal(persistedMethods.json().methods[0].paymentQrImage, qrImage)
    const storedPaymentMethod = await rankingClient.db('loveforyou-tests').collection('paymentMethods')
      .findOne({ _id: methodResponse.json().method.id })
    assert.equal(storedPaymentMethod.paymentQrImage, qrImage)
    assert.equal(storedPaymentMethod.qrImage, undefined)
    const packageResponse = await app.inject({
      method: 'POST', url: '/api/admin/topup-packages', headers: adminHeaders,
      payload: { name: 'Gói thử nghiệm', priceVnd: 20000, bonusCoins: 10, enabled: true, displayOrder: 1 },
    })
    assert.equal(packageResponse.statusCode, 201, packageResponse.body)
    const packageId = packageResponse.json().package.id
    assert.equal(packageResponse.json().package.coins, 65)
    const unpaidDeposit = await app.inject({
      method: 'POST', url: '/api/wallet/deposits', headers: { cookie: otherCustomer.cookie, origin }, payload: { packageId },
    })
    assert.equal(unpaidDeposit.statusCode, 201, unpaidDeposit.body)
    const unpaidDetails = unpaidDeposit.json().deposit
    assert.equal(Date.parse(unpaidDetails.expiresAt) - Date.parse(unpaidDetails.createdAt), 15 * 60 * 1000)
    await rankingClient.db('loveforyou-tests').collection('depositRequests').updateOne(
      { _id: unpaidDetails.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } },
    )
    const expiredHistory = await app.inject({
      method: 'GET', url: '/api/wallet/deposits', headers: { cookie: otherCustomer.cookie },
    })
    const autoCancelled = expiredHistory.json().deposits.find((item) => item.id === unpaidDetails.id)
    assert.equal(autoCancelled.status, 'cancelled')
    assert.equal(autoCancelled.cancellationReason, 'Hết hạn thanh toán sau 15 phút.')
    assert.equal(autoCancelled.history.at(-1).status, 'cancelled')
    const expiredReceipt = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${unpaidDetails.id}/receipt`,
      headers: { cookie: otherCustomer.cookie, origin }, payload: { paymentProofImage: receipt },
    })
    assert.equal(expiredReceipt.statusCode, 409)
    const recreatedDeposit = await app.inject({
      method: 'POST', url: '/api/wallet/deposits', headers: { cookie: otherCustomer.cookie, origin }, payload: { packageId },
    })
    assert.equal(recreatedDeposit.statusCode, 201, recreatedDeposit.body)
    assert.notEqual(recreatedDeposit.json().deposit.id, unpaidDetails.id)
    const rejectedUnpaidDeposit = await app.inject({
      method: 'PATCH', url: `/api/admin/deposits/${recreatedDeposit.json().deposit.id}`, headers: adminHeaders,
      payload: { action: 'reject', reason: 'Yêu cầu tạo nhầm, vui lòng liên hệ Admin.' },
    })
    assert.equal(rejectedUnpaidDeposit.statusCode, 200, rejectedUnpaidDeposit.body)
    assert.equal(rejectedUnpaidDeposit.json().status, 'rejected')
    const rejectedUnpaidRecord = await rankingClient.db('loveforyou-tests').collection('depositRequests')
      .findOne({ _id: recreatedDeposit.json().deposit.id })
    assert.equal(rejectedUnpaidRecord.rejectionReason, 'Yêu cầu tạo nhầm, vui lòng liên hệ Admin.')
    const forgedPackageCoins = await app.inject({
      method: 'POST', url: '/api/admin/topup-packages', headers: adminHeaders,
      payload: { name: 'Gói giả mạo', priceVnd: 20000, coins: 1000000, bonusCoins: 0, enabled: true, displayOrder: 2 },
    })
    assert.equal(forgedPackageCoins.statusCode, 400)
    const invalidPackage = await app.inject({
      method: 'POST', url: '/api/admin/topup-packages', headers: adminHeaders,
      payload: { name: 'Sai giá', priceVnd: 0, bonusCoins: 0, enabled: true, displayOrder: 1 },
    })
    assert.equal(invalidPackage.statusCode, 400)
    const packageWithClientRewards = await app.inject({
      method: 'POST', url: '/api/wallet/deposits', headers: customerHeaders,
      payload: { packageId, priceVnd: 1, coins: 1000000, bonusCoins: 1000000 },
    })
    assert.equal(packageWithClientRewards.statusCode, 400)
    await app.inject({
      method: 'PATCH', url: `/api/admin/topup-packages/${packageId}`, headers: adminHeaders,
      payload: { name: 'Gói thử nghiệm', priceVnd: 20000, bonusCoins: 10, enabled: false, displayOrder: 1 },
    })
    const disabledPackage = await app.inject({
      method: 'POST', url: '/api/wallet/deposits', headers: customerHeaders, payload: { packageId },
    })
    assert.equal(disabledPackage.statusCode, 404)
    await app.inject({
      method: 'PATCH', url: `/api/admin/topup-packages/${packageId}`, headers: adminHeaders,
      payload: { name: 'Gói thử nghiệm', priceVnd: 20000, bonusCoins: 10, enabled: true, displayOrder: 1 },
    })

    const unauthorizedOptions = await app.inject({ method: 'GET', url: '/api/wallet/topup-options' })
    assert.equal(unauthorizedOptions.statusCode, 401)
    const options = await app.inject({ method: 'GET', url: '/api/wallet/topup-options', headers: customerHeaders })
    assert.equal(options.statusCode, 200, options.body)
    assert.equal(options.json().coinPriceVnd, 304)
    assert.equal(options.json().packages[0].coins, 65)
    const parallelCreates = await Promise.all([
      app.inject({ method: 'POST', url: '/api/wallet/deposits', headers: customerHeaders, payload: { packageId } }),
      app.inject({ method: 'POST', url: '/api/wallet/deposits', headers: customerHeaders, payload: { packageId } }),
    ])
    assert.deepEqual(parallelCreates.map((response) => response.statusCode).sort(), [200, 201])
    const created = parallelCreates.find((response) => response.statusCode === 201)
    assert.ok(created)
    const depositId = created.json().deposit.id
    const originalCode = created.json().deposit.code
    assert.match(originalCode, /^LFN[0-9A-HJ-NP-Z]{9}$/)
    assert.match(created.json().deposit.paymentMethod.transferContent, new RegExp(originalCode))
    const duplicateCreate = parallelCreates.find((response) => response.statusCode === 200)
    assert.ok(duplicateCreate)
    assert.equal(duplicateCreate.statusCode, 200, duplicateCreate.body)
    assert.equal(duplicateCreate.json().deposit.id, depositId)
    const preApprovalWallet = await app.inject({ method: 'GET', url: '/api/wallet', headers: customerHeaders })
    assert.equal(preApprovalWallet.json().balance, 0)
    const otherOwnerDetail = await app.inject({
      method: 'GET', url: `/api/wallet/deposits/${depositId}`, headers: { cookie: otherCustomer.cookie },
    })
    assert.equal(otherOwnerDetail.statusCode, 404)

    const updatedPaymentMethod = await app.inject({
      method: 'PATCH', url: `/api/admin/payment-methods/${methodResponse.json().method.id}`, headers: adminHeaders,
      payload: { ...paymentMethod, name: 'Chuyển khoản chính', accountNumber: '0098765432' },
    })
    assert.equal(updatedPaymentMethod.statusCode, 200, updatedPaymentMethod.body)
    assert.equal(updatedPaymentMethod.json().method.name, 'Chuyển khoản chính')
    await app.inject({
      method: 'PATCH', url: `/api/admin/topup-packages/${packageId}`, headers: adminHeaders,
      payload: { name: 'Gói đã đổi', priceVnd: 30000, bonusCoins: 20, enabled: true, displayOrder: 2 },
    })
    const snapshot = await app.inject({
      method: 'GET', url: `/api/wallet/deposits/${depositId}`, headers: customerHeaders,
    })
    assert.equal(snapshot.json().deposit.paymentMethod.accountNumber, '0012345678')
    assert.equal(snapshot.json().deposit.paymentMethod.bankBin, '970415')
    assert.equal(snapshot.json().deposit.paymentMethod.name, paymentMethod.name)
    assert.equal(snapshot.json().deposit.paymentMethod.paymentQrImage, qrImage)
    assert.equal(snapshot.json().deposit.package.priceVnd, 20000)
    assert.equal(snapshot.json().deposit.package.coins, 65)

    const confirmWithoutReceipt = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/confirm`, headers: customerHeaders, payload: {},
    })
    assert.equal(confirmWithoutReceipt.statusCode, 409)
    await rankingClient.db('loveforyou-tests').collection('depositRequests').updateOne(
      { _id: depositId }, { $set: { paymentProofImage: receipt } },
    )
    const forgedStoredProof = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/confirm`, headers: customerHeaders, payload: {},
    })
    assert.equal(forgedStoredProof.statusCode, 409)
    await rankingClient.db('loveforyou-tests').collection('depositRequests').updateOne(
      { _id: depositId }, { $unset: { paymentProofImage: '' } },
    )
    const wrongOwnerReceipt = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/receipt`,
      headers: { cookie: otherCustomer.cookie, origin }, payload: { paymentProofImage: receipt },
    })
    assert.equal(wrongOwnerReceipt.statusCode, 409)
    const invalidReceipt = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/receipt`,
      headers: customerHeaders, payload: { paymentProofImage: 'data:image/png;base64,/9j/AA==' },
    })
    assert.equal(invalidReceipt.statusCode, 400)
    const uploaded = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/receipt`, headers: customerHeaders, payload: { paymentProofImage: receipt },
    })
    assert.equal(uploaded.statusCode, 200, uploaded.body)
    assert.ok(uploaded.json().paymentProofUploadedAt)
    assert.match(uploaded.json().paymentProofImage, /^\/api\/media\/.+\/content$/)
    assert.ok(uploaded.json().mediaId)
    const ownerDetails = await app.inject({
      method: 'GET', url: `/api/wallet/deposits/${depositId}`, headers: customerHeaders,
    })
    assert.match(ownerDetails.json().deposit.paymentProofImage, /^\/api\/media\/.+\/content$/)
    assert.equal(ownerDetails.json().deposit.paymentMethod.paymentQrImage, qrImage)
    const privateDetails = await app.inject({
      method: 'GET', url: `/api/wallet/deposits/${depositId}`, headers: { cookie: otherCustomer.cookie, origin },
    })
    assert.equal(privateDetails.statusCode, 404)
    const userDepositList = await app.inject({
      method: 'GET', url: '/api/wallet/deposits', headers: customerHeaders,
    })
    assert.equal(userDepositList.json().deposits[0].paymentProofImage, undefined)
    const storedDeposit = await rankingClient.db('loveforyou-tests').collection('depositRequests')
      .findOne({ _id: depositId })
    assert.equal(storedDeposit.paymentProofImage, undefined)
    assert.equal(storedDeposit.paymentProofMediaId, uploaded.json().mediaId)
    assert.equal(storedDeposit.receipt, undefined)
    const mediaDoc = await rankingClient.db('loveforyou-tests').collection('media')
      .findOne({ _id: uploaded.json().mediaId })
    assert.equal(mediaDoc.ownerId, customerRecord._id)
    assert.equal(mediaDoc.category, 'deposit_proof')
    assert.ok(!mediaDoc.apiSecret && !JSON.stringify(mediaDoc).includes('CLOUDINARY_API_SECRET'))
    const changedQr = await app.inject({
      method: 'PATCH',
      url: `/api/admin/payment-methods/${methodResponse.json().method.id}`,
      headers: adminHeaders,
      payload: { paymentQrImage: 'data:image/png;base64,iVBORw0KGgo=' },
    })
    assert.equal(changedQr.statusCode, 200, changedQr.body)
    assert.match(changedQr.json().method.paymentQrImage, /^\/api\/media\/.+\/content$/)
    const afterQrChange = await app.inject({
      method: 'GET', url: `/api/wallet/deposits/${depositId}`, headers: customerHeaders,
    })
    assert.equal(afterQrChange.json().deposit.paymentMethod.paymentQrImage, qrImage)
    assert.match(afterQrChange.json().deposit.paymentProofImage, /^\/api\/media\/.+\/content$/)
    const removedReceipt = await app.inject({
      method: 'DELETE', url: `/api/wallet/deposits/${depositId}/receipt`, headers: customerHeaders, payload: {},
    })
    assert.equal(removedReceipt.statusCode, 200, removedReceipt.body)
    const confirmAfterReceiptRemoval = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/confirm`, headers: customerHeaders, payload: {},
    })
    assert.equal(confirmAfterReceiptRemoval.statusCode, 409)
    await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/receipt`, headers: customerHeaders, payload: { paymentProofImage: receipt },
    })
    const confirmed = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/confirm`, headers: customerHeaders, payload: {},
    })
    assert.equal(confirmed.statusCode, 200, confirmed.body)
    assert.equal(confirmed.json().deposit.status, 'awaiting_review')
    const repeatConfirm = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${depositId}/confirm`, headers: customerHeaders, payload: {},
    })
    assert.equal(repeatConfirm.statusCode, 200, repeatConfirm.body)
    const repeatedRequest = await rankingClient.db('loveforyou-tests').collection('depositRequests')
      .findOne({ _id: depositId })
    assert.equal(repeatedRequest.history.filter((entry) => entry.status === 'awaiting_review').length, 1)
    const memberApproval = await app.inject({
      method: 'PATCH', url: `/api/admin/deposits/${depositId}`, headers: customerHeaders,
      payload: { action: 'approve', verifiedReceived: true, receivedAmountVnd: 20000, bankReference: 'BANK-1' },
    })
    assert.equal(memberApproval.statusCode, 403)

    const invalidApproval = await app.inject({
      method: 'PATCH', url: `/api/admin/deposits/${depositId}`, headers: adminHeaders,
      payload: { action: 'approve', verifiedReceived: true, receivedAmountVnd: 19000, bankReference: 'BANK-1' },
    })
    assert.equal(invalidApproval.statusCode, 409)
    const approvalPayload = { action: 'approve', verifiedReceived: true, receivedAmountVnd: 20000, bankReference: 'BANK-1' }
    const parallelApprovals = await Promise.all([
      app.inject({ method: 'PATCH', url: `/api/admin/deposits/${depositId}`, headers: adminHeaders, payload: approvalPayload }),
      app.inject({ method: 'PATCH', url: `/api/admin/deposits/${depositId}`, headers: adminHeaders, payload: approvalPayload }),
    ])
    assert.deepEqual(parallelApprovals.map((response) => response.statusCode).sort(), [200, 409])
    const duplicateApproval = await app.inject({
      method: 'PATCH', url: `/api/admin/deposits/${depositId}`, headers: adminHeaders, payload: approvalPayload,
    })
    assert.equal(duplicateApproval.statusCode, 409)
    const customerWallet = await app.inject({ method: 'GET', url: '/api/wallet', headers: customerHeaders })
    assert.equal(customerWallet.json().balance, 75)
    assert.equal(customerWallet.json().transactions.filter((transaction) => transaction.id === `deposit:${depositId}`).length, 1)
    const afterRepeatConfirm = await app.inject({ method: 'GET', url: '/api/wallet', headers: customerHeaders })
    assert.equal(afterRepeatConfirm.json().balance, 75)
    const adminList = await app.inject({
      method: 'GET', url: '/api/admin/deposits?status=approved&search=topup-customer&amountMin=20000&amountMax=20000', headers: adminHeaders,
    })
    assert.equal(adminList.statusCode, 200, adminList.body)
    assert.equal(adminList.json().deposits.length, 1)
    assert.match(adminList.json().deposits[0].paymentProofImage, /^\/api\/media\/.+\/content$/)
    const memberProofAccess = await app.inject({
      method: 'GET', url: '/api/admin/deposits', headers: customerHeaders,
    })
    assert.equal(memberProofAccess.statusCode, 403)
    assert.equal(adminList.json().deposits[0].reviewedBy.publicId, administrator.user.publicId)
    const ledgerQuery = await app.inject({
      method: 'GET',
      url: `/api/admin/transactions?search=${originalCode}&direction=credit&type=deposit&from=2000-01-01&to=2099-12-31&amountMin=75&amountMax=75`,
      headers: adminHeaders,
    })
    assert.equal(ledgerQuery.statusCode, 200, ledgerQuery.body)
    assert.equal(ledgerQuery.json().transactions.length, 1)
    assert.equal(ledgerQuery.json().transactions[0].type, 'Nạp xu đã đối chiếu')
    assert.equal(ledgerQuery.json().transactions[0].reference, originalCode)
    const forbiddenWalletList = await app.inject({ method: 'GET', url: '/api/admin/wallets', headers: customerHeaders })
    assert.equal(forbiddenWalletList.statusCode, 403)
    const customerAccount = await rankingClient.db('loveforyou-tests').collection('walletAccounts')
      .findOne({ userId: customerRecord._id })
    await rankingClient.db('loveforyou-tests').collection('walletAccounts')
      .updateOne({ _id: customerAccount._id }, { $set: { balance: 90 } })
    const mismatchWallet = await app.inject({
      method: 'GET', url: '/api/admin/wallets?search=topup-customer&status=mismatch', headers: adminHeaders,
    })
    assert.equal(mismatchWallet.statusCode, 200, mismatchWallet.body)
    assert.equal(mismatchWallet.json().summary.mismatchCount, 1)
    assert.equal(mismatchWallet.json().wallets[0].ledgerBalance, 75)
    assert.equal(mismatchWallet.json().wallets[0].availableBalance, 90)
    await rankingClient.db('loveforyou-tests').collection('walletAccounts')
      .updateOne({ _id: customerAccount._id }, { $set: { balance: 75 } })
    const invalidAmountRange = await app.inject({
      method: 'GET', url: '/api/admin/deposits?amountMin=30000&amountMax=20000', headers: adminHeaders,
    })
    assert.equal(invalidAmountRange.statusCode, 400)
    const stats = await app.inject({ method: 'GET', url: '/api/admin/topup-packages', headers: adminHeaders })
    assert.equal(stats.json().packages.find((item) => item.id === packageId).purchases, 1)
    const audit = await rankingClient.db('loveforyou-tests').collection('adminAuditLogs')
      .find({ targetId: depositId, action: 'deposit.approved' }).toArray()
    assert.equal(audit.length, 1)

    const followUp = await app.inject({
      method: 'POST', url: '/api/wallet/deposits', headers: customerHeaders, payload: { packageId },
    })
    const followUpId = followUp.json().deposit.id
    const followUpReceipt = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${followUpId}/receipt`, headers: customerHeaders, payload: { paymentProofImage: receipt },
    })
    assert.equal(followUpReceipt.statusCode, 200)
    await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${followUpId}/confirm`, headers: customerHeaders, payload: {},
    })
    const needsInfo = await app.inject({
      method: 'PATCH', url: `/api/admin/deposits/${followUpId}`, headers: adminHeaders,
      payload: { action: 'needs_info', reason: 'Vui lòng gửi chứng từ rõ hơn.' },
    })
    assert.equal(needsInfo.statusCode, 200, needsInfo.body)
    const confirmWithoutReplacement = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${followUpId}/confirm`, headers: customerHeaders, payload: {},
    })
    assert.equal(confirmWithoutReplacement.statusCode, 409)
    const reupload = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${followUpId}/receipt`, headers: customerHeaders, payload: { paymentProofImage: receipt },
    })
    assert.equal(reupload.statusCode, 200)
    const reconfirm = await app.inject({
      method: 'POST', url: `/api/wallet/deposits/${followUpId}/confirm`, headers: customerHeaders, payload: {},
    })
    assert.equal(reconfirm.statusCode, 200, reconfirm.body)
    const missingRejectReason = await app.inject({
      method: 'PATCH', url: `/api/admin/deposits/${followUpId}`, headers: adminHeaders,
      payload: { action: 'reject' },
    })
    assert.equal(missingRejectReason.statusCode, 400)
    const rejected = await app.inject({
      method: 'PATCH', url: `/api/admin/deposits/${followUpId}`, headers: adminHeaders,
      payload: { action: 'reject', reason: 'Không tìm thấy giao dịch thực nhận.' },
    })
    assert.equal(rejected.statusCode, 200, rejected.body)
    const rejectedRequest = await app.inject({
      method: 'GET', url: `/api/wallet/deposits/${followUpId}`, headers: customerHeaders,
    })
    assert.equal(rejectedRequest.json().deposit.rejectionReason, 'Không tìm thấy giao dịch thực nhận.')
    const afterReject = await app.inject({ method: 'GET', url: '/api/wallet', headers: customerHeaders })
    assert.equal(afterReject.json().balance, 75)
    assert.equal(afterReject.json().transactions.filter((transaction) => transaction.id === `deposit:${followUpId}`).length, 0)
    const depositNotifications = await rankingClient.db('loveforyou-tests').collection('notifications')
      .find({ userId: customerRecord._id, type: { $in: ['deposit_approved', 'deposit_info_requested', 'deposit_rejected'] } }).toArray()
    assert.deepEqual(depositNotifications.map((item) => item.type).sort(), ['deposit_approved', 'deposit_info_requested', 'deposit_rejected'])

    const secondMethod = await app.inject({
      method: 'POST', url: '/api/admin/payment-methods', headers: adminHeaders,
      payload: { ...paymentMethod, name: 'Phương thức phụ', bankCode: 'TEST2', isDefault: false },
    })
    assert.equal(secondMethod.statusCode, 201, secondMethod.body)
    const setSecondDefault = await app.inject({
      method: 'PATCH', url: `/api/admin/payment-methods/${secondMethod.json().method.id}`, headers: adminHeaders,
      payload: { isDefault: true },
    })
    assert.equal(setSecondDefault.statusCode, 200, setSecondDefault.body)
    const afterSetDefault = await app.inject({ method: 'GET', url: '/api/admin/payment-methods', headers: adminHeaders })
    assert.equal(afterSetDefault.json().methods.filter((item) => item.isDefault).length, 1)
    assert.equal(afterSetDefault.json().methods.find((item) => item.id === secondMethod.json().method.id).isDefault, true)
    const disableDefault = await app.inject({
      method: 'PATCH', url: `/api/admin/payment-methods/${secondMethod.json().method.id}`, headers: adminHeaders,
      payload: { enabled: false },
    })
    assert.equal(disableDefault.statusCode, 200, disableDefault.body)
    assert.equal(disableDefault.json().method.enabled, false)
    assert.equal(disableDefault.json().method.isDefault, false)
    const afterDisable = await app.inject({ method: 'GET', url: '/api/admin/payment-methods', headers: adminHeaders })
    assert.equal(afterDisable.json().methods.find((item) => item.id === secondMethod.json().method.id).enabled, false)
    const afterReloadSnapshot = await app.inject({
      method: 'GET', url: `/api/wallet/deposits/${depositId}`, headers: customerHeaders,
    })
    assert.equal(afterReloadSnapshot.json().deposit.paymentMethod.name, paymentMethod.name)
    assert.equal(afterReloadSnapshot.json().deposit.paymentMethod.accountNumber, '0012345678')
    const paymentAudits = await rankingClient.db('loveforyou-tests').collection('adminAuditLogs')
      .find({ action: { $in: ['payment_method.created', 'payment_method.updated'] }, actorUserId: adminRecord._id }).toArray()
    assert.equal(paymentAudits.length, 6)
  } finally {
    await users.updateOne({ _id: adminRecord._id }, { $set: { role: 'member' } })
  }
})

test('bank catalog lookup and account verification are secure, owner-scoped, and fail closed', async (t) => {
  const otherBankUser = await register('bank-other@example.test', 'Bank Other')
  const lookupBank = {
    id: 17, name: 'Ngân hàng kiểm thử', code: 'TST', bin: '970415', shortName: 'TESTBANK',
    logo: 'https://cdn.vietqr.io/img/TST.png', lookupSupported: 1, transferSupported: 1,
  }
  const unsupportedBank = {
    id: 18, name: 'Ngân hàng chưa hỗ trợ', code: 'NOS', bin: '970416', shortName: 'NOSUPPORT',
    logo: 'https://api.vietqr.io/img/NOS.png', lookupSupported: 0, transferSupported: 1,
  }
  let lookupMode = 'success'
  let lookupRequest
  let listUnavailable = false
  const fetchMock = async (url, options = {}) => {
    if (url.endsWith('/banks')) {
      if (listUnavailable) throw new Error('network unavailable')
      return { ok: true, status: 200, json: async () => ({ code: '00', data: [lookupBank, unsupportedBank] }) }
    }
    lookupRequest = { url, options }
    if (lookupMode === 'timeout') {
      const timeout = new Error('timed out')
      timeout.name = 'TimeoutError'
      throw timeout
    }
    if (lookupMode === 'invalid_key') return { ok: false, status: 401, json: async () => ({}) }
    if (lookupMode === 'missing_name') return { ok: true, status: 200, json: async () => ({ code: '00', data: {} }) }
    if (lookupMode === 'not_found') return { ok: true, status: 200, json: async () => ({ code: '42', desc: 'not found' }) }
    if (lookupMode === 'unsupported') return { ok: true, status: 200, json: async () => ({ code: '41', desc: 'unsupported' }) }
    return { ok: true, status: 200, json: async () => ({ code: '00', desc: 'Success', data: { accountName: 'NGUYEN VAN A' } }) }
  }
  const bankApp = await createApp({
    mongoUri: mongo.getUri(),
    databaseName: 'loveforyou-tests',
    clientOrigin: origin,
    secureCookies: false,
    logger: { level: 'silent' },
    fetchImpl: fetchMock,
    vietqrClientId: 'test-client-id',
    vietqrApiKey: 'test-api-key',
    bankAccountEncryptionKey: 'a'.repeat(64),
  })
  const testApps = [bankApp]
  t.after(async () => { await Promise.all(testApps.map((testApp) => testApp.close())) })
  const headers = { cookie: alice.cookie, origin }
  const banksResponse = await bankApp.inject({ method: 'GET', url: '/api/banks' })
  assert.equal(banksResponse.statusCode, 200, banksResponse.body)
  assert.deepEqual(banksResponse.json().banks.map((bank) => bank.bin), ['970415', '970416'])
  assert.equal((await bankApp.inject({ method: 'POST', url: '/api/bank-accounts/verify', headers: { origin }, payload: { bankBin: '970415', accountNumber: '113366668888' } })).statusCode, 401)
  assert.equal((await bankApp.inject({ method: 'POST', url: '/api/bank-accounts/verify', headers, payload: { bankBin: '970415', accountNumber: '12' } })).statusCode, 400)
  assert.equal((await bankApp.inject({ method: 'POST', url: '/api/bank-accounts/verify', headers, payload: { bankBin: '111111', accountNumber: '113366668888' } })).statusCode, 400)

  const unsupported = await bankApp.inject({
    method: 'POST', url: '/api/bank-accounts/verify', headers, payload: { bankBin: '970416', accountNumber: '12345678' },
  })
  assert.equal(unsupported.json().status, 'unsupported')
  assert.equal(lookupRequest, undefined)

  lookupMode = 'not_found'
  const notFound = await bankApp.inject({
    method: 'POST', url: '/api/bank-accounts/verify', headers, payload: { bankBin: '970415', accountNumber: '12345678' },
  })
  assert.equal(notFound.json().status, 'not_found')

  for (const mode of ['timeout', 'invalid_key', 'missing_name']) {
    lookupMode = mode
    const unavailable = await bankApp.inject({
      method: 'POST', url: '/api/bank-accounts/verify', headers, payload: { bankBin: '970415', accountNumber: '113366668888' },
    })
    assert.equal(unavailable.statusCode, 503, mode)
    assert.equal(unavailable.json().status, 'temporarily_unavailable', mode)
  }

  lookupMode = 'success'
  const verified = await bankApp.inject({
    method: 'POST', url: '/api/bank-accounts/verify', headers, payload: { bankBin: '970415', accountNumber: '113366668888' },
  })
  assert.equal(verified.statusCode, 200, verified.body)
  assert.equal(verified.json().status, 'verified')
  assert.equal(verified.json().accountName, 'NGUYEN VAN A')
  assert.equal(lookupRequest.url, 'https://api.vietqr.io/v2/lookup')
  assert.deepEqual(JSON.parse(lookupRequest.options.body), { bin: 970415, accountNumber: '113366668888' })
  assert.equal(lookupRequest.options.headers['x-api-key'], 'test-api-key')
  const verificationId = verified.json().verificationId
  const pendingVerification = await rankingClient.db('loveforyou-tests').collection('bankVerifications')
    .findOne({ verificationId })
  assert.equal(JSON.stringify(pendingVerification).includes('NGUYEN VAN A'), false)

  const forgedOwner = await bankApp.inject({
    method: 'POST', url: '/api/bank-accounts/continue', headers: { cookie: otherBankUser.cookie, origin },
    payload: { verificationId, bankBin: '970415', accountNumber: '113366668888' },
  })
  assert.equal(forgedOwner.statusCode, 409)
  const changedAccount = await bankApp.inject({
    method: 'POST', url: '/api/bank-accounts/continue', headers,
    payload: { verificationId, bankBin: '970415', accountNumber: '113366668889' },
  })
  assert.equal(changedAccount.statusCode, 409)

  const saved = await bankApp.inject({
    method: 'POST', url: '/api/bank-accounts/continue', headers,
    payload: { verificationId, bankBin: '970415', accountNumber: '113366668888' },
  })
  assert.equal(saved.statusCode, 201, saved.body)
  assert.equal(saved.json().account.accountName, 'NGUYEN VAN A')
  assert.equal(saved.json().account.maskedAccountNumber, '••••8888')
  const withdrawalAdmin = await register('withdrawal-admin@example.test', 'Withdrawal Admin')
  const withdrawalAdminRecord = await rankingClient.db('loveforyou-tests').collection('users')
    .findOne({ email: 'withdrawal-admin@example.test' })
  await rankingClient.db('loveforyou-tests').collection('users')
    .updateOne({ _id: withdrawalAdminRecord._id }, { $set: { role: 'admin' } })
  const withdrawalAdminHeaders = { cookie: withdrawalAdmin.cookie, origin }
  const initialWithdrawalWallet = await bankApp.inject({ method: 'GET', url: '/api/wallet', headers })
  const initialWithdrawalBalance = initialWithdrawalWallet.json().balance
  const invalidWithdrawal = await bankApp.inject({
    method: 'POST', url: '/api/wallet/withdrawals', headers,
    payload: { bankAccountId: saved.json().account.id, coins: 99 },
  })
  assert.equal(invalidWithdrawal.statusCode, 400)
  const forgedWithdrawalCode = await bankApp.inject({
    method: 'POST', url: '/api/wallet/withdrawals', headers,
    payload: { bankAccountId: saved.json().account.id, coins: 100, code: 'LFR111111111' },
  })
  assert.equal(forgedWithdrawalCode.statusCode, 400)
  const insufficientWithdrawal = await bankApp.inject({
    method: 'POST', url: '/api/wallet/withdrawals', headers,
    payload: { bankAccountId: saved.json().account.id, coins: 2000 },
  })
  assert.equal(insufficientWithdrawal.statusCode, 409)
  const withdrawal = await bankApp.inject({
    method: 'POST', url: '/api/wallet/withdrawals', headers,
    payload: { bankAccountId: saved.json().account.id, coins: 100 },
  })
  assert.equal(withdrawal.statusCode, 201, withdrawal.body)
  assert.match(withdrawal.json().withdrawal.code, /^LFR[0-9A-HJ-NP-Z]{9}$/)
  assert.equal(withdrawal.json().withdrawal.amountVnd, 30400)
  assert.equal(withdrawal.json().withdrawal.feeVnd, 0)
  assert.equal(withdrawal.json().withdrawal.status, 'pending_review')
  const withdrawalId = withdrawal.json().withdrawal.id
  const withdrawalCode = withdrawal.json().withdrawal.code
  const wrongOwnerWithdrawal = await bankApp.inject({
    method: 'GET', url: `/api/wallet/withdrawals/${withdrawalId}`, headers: { cookie: otherBankUser.cookie, origin },
  })
  assert.equal(wrongOwnerWithdrawal.statusCode, 404)
  assert.equal((await bankApp.inject({ method: 'GET', url: '/api/admin/withdrawals', headers })).statusCode, 403)
  const heldBalance = await bankApp.inject({ method: 'GET', url: '/api/wallet', headers })
  assert.equal(heldBalance.json().balance, initialWithdrawalBalance - 100)
  const adminWithdrawalList = await bankApp.inject({
    method: 'GET', url: `/api/admin/withdrawals?search=${withdrawalCode}&from=2000-01-01&to=2099-12-31`, headers: withdrawalAdminHeaders,
  })
  assert.equal(adminWithdrawalList.statusCode, 200, adminWithdrawalList.body)
  assert.equal(adminWithdrawalList.json().withdrawals[0].bankAccount.accountNumber, '113366668888')
  const approvedWithdrawal = await bankApp.inject({
    method: 'PATCH', url: `/api/admin/withdrawals/${withdrawalId}`, headers: withdrawalAdminHeaders,
    payload: { action: 'approve' },
  })
  assert.equal(approvedWithdrawal.statusCode, 200, approvedWithdrawal.body)
  const processingWithdrawal = await bankApp.inject({
    method: 'PATCH', url: `/api/admin/withdrawals/${withdrawalId}`, headers: withdrawalAdminHeaders,
    payload: { action: 'processing' },
  })
  assert.equal(processingWithdrawal.statusCode, 200, processingWithdrawal.body)
  const invalidPaidWithdrawal = await bankApp.inject({
    method: 'PATCH', url: `/api/admin/withdrawals/${withdrawalId}`, headers: withdrawalAdminHeaders,
    payload: { action: 'paid' },
  })
  assert.equal(invalidPaidWithdrawal.statusCode, 400)
  const paidWithdrawal = await bankApp.inject({
    method: 'PATCH', url: `/api/admin/withdrawals/${withdrawalId}`, headers: withdrawalAdminHeaders,
    payload: { action: 'paid', bankReference: 'BANK-WITHDRAW-1' },
  })
  assert.equal(paidWithdrawal.statusCode, 200, paidWithdrawal.body)
  assert.equal(paidWithdrawal.json().withdrawal.status, 'paid')
  assert.equal(paidWithdrawal.json().withdrawal.bankReference, 'BANK-WITHDRAW-1')
  const withdrawalLedgerFilter = await bankApp.inject({
    method: 'GET',
    url: `/api/admin/transactions?search=${withdrawalCode}&type=withdrawal&from=2000-01-01&to=2099-12-31`,
    headers: withdrawalAdminHeaders,
  })
  assert.equal(withdrawalLedgerFilter.statusCode, 200, withdrawalLedgerFilter.body)
  assert.equal(withdrawalLedgerFilter.json().transactions.length, 1)
  assert.equal(withdrawalLedgerFilter.json().transactions[0].type, 'Rút tiền')
  const memberPaidWithdrawal = await bankApp.inject({
    method: 'PATCH', url: `/api/admin/withdrawals/${withdrawalId}`, headers,
    payload: { action: 'paid', bankReference: 'FORGED' },
  })
  assert.equal(memberPaidWithdrawal.statusCode, 403)
  const parallelWithdrawals = await Promise.all([
    bankApp.inject({
      method: 'POST', url: '/api/wallet/withdrawals', headers,
      payload: { bankAccountId: saved.json().account.id, coins: 1000 },
    }),
    bankApp.inject({
      method: 'POST', url: '/api/wallet/withdrawals', headers,
      payload: { bankAccountId: saved.json().account.id, coins: 1000 },
    }),
  ])
  assert.deepEqual(parallelWithdrawals.map((response) => response.statusCode).sort(), [201, 409])
  const secondWithdrawal = parallelWithdrawals.find((response) => response.statusCode === 201)
  assert.ok(secondWithdrawal)
  const rejectedWithdrawal = await bankApp.inject({
    method: 'PATCH', url: `/api/admin/withdrawals/${secondWithdrawal.json().withdrawal.id}`, headers: withdrawalAdminHeaders,
    payload: { action: 'reject', reason: 'Không thể đối soát yêu cầu.' },
  })
  assert.equal(rejectedWithdrawal.statusCode, 200, rejectedWithdrawal.body)
  assert.equal(rejectedWithdrawal.json().withdrawal.status, 'rejected')
  const repeatedReject = await bankApp.inject({
    method: 'PATCH', url: `/api/admin/withdrawals/${secondWithdrawal.json().withdrawal.id}`, headers: withdrawalAdminHeaders,
    payload: { action: 'reject', reason: 'Gửi lại không được phép.' },
  })
  assert.equal(repeatedReject.statusCode, 409)
  const afterRejectedWithdrawal = await bankApp.inject({ method: 'GET', url: '/api/wallet', headers })
  assert.equal(afterRejectedWithdrawal.json().balance, initialWithdrawalBalance - 100)
  const withdrawalLedger = await rankingClient.db('loveforyou-tests').collection('walletTransactions')
    .find({ transactionCode: secondWithdrawal.json().withdrawal.code }).toArray()
  assert.deepEqual(withdrawalLedger.map((entry) => entry.amount).sort((a, b) => a - b), [-1000, 1000])
  const cancelableWithdrawal = await bankApp.inject({
    method: 'POST', url: '/api/wallet/withdrawals', headers,
    payload: { bankAccountId: saved.json().account.id, coins: 100 },
  })
  const cancelWithdrawal = await bankApp.inject({
    method: 'POST', url: `/api/wallet/withdrawals/${cancelableWithdrawal.json().withdrawal.id}/cancel`, headers,
    payload: {},
  })
  assert.equal(cancelWithdrawal.statusCode, 200, cancelWithdrawal.body)
  assert.equal(cancelWithdrawal.json().withdrawal.status, 'cancelled')
  assert.equal((await bankApp.inject({ method: 'GET', url: '/api/wallet', headers })).json().balance, initialWithdrawalBalance - 100)
  const repeatCancel = await bankApp.inject({
    method: 'POST', url: `/api/wallet/withdrawals/${cancelableWithdrawal.json().withdrawal.id}/cancel`, headers,
    payload: {},
  })
  assert.equal(repeatCancel.statusCode, 409)
  const memberAdjustment = await bankApp.inject({
    method: 'POST', url: '/api/admin/wallet/adjustments', headers,
    payload: { userId: (await rankingClient.db('loveforyou-tests').collection('users').findOne({ email: 'alice@example.test' }))._id, amount: 10, reason: 'Kiểm thử điều chỉnh' },
  })
  assert.equal(memberAdjustment.statusCode, 403)
  const aliceUserId = (await rankingClient.db('loveforyou-tests').collection('users').findOne({ email: 'alice@example.test' }))._id
  const adjustment = await bankApp.inject({
    method: 'POST', url: '/api/admin/wallet/adjustments', headers: withdrawalAdminHeaders,
    payload: { userId: aliceUserId, amount: 50, reason: 'Bù xu theo yêu cầu hỗ trợ.' },
  })
  assert.equal(adjustment.statusCode, 201, adjustment.body)
  assert.match(adjustment.json().adjustment.code, /^LFA[0-9A-HJ-NP-Z]{9}$/)
  const negativeAdjustment = await bankApp.inject({
    method: 'POST', url: '/api/admin/wallet/adjustments', headers: withdrawalAdminHeaders,
    payload: { userId: aliceUserId, amount: -5000, reason: 'Không đủ số dư.' },
  })
  assert.equal(negativeAdjustment.statusCode, 409)
  const refund = await bankApp.inject({
    method: 'POST', url: '/api/admin/wallet/refunds', headers: withdrawalAdminHeaders,
    payload: { originalTransactionId: 'wallet-test-spend', reason: 'Khôi phục xu đã chi.' },
  })
  assert.equal(refund.statusCode, 201, refund.body)
  assert.match(refund.json().refund.code, /^LFC[0-9A-HJ-NP-Z]{9}$/)
  assert.equal(refund.json().refund.coins, 400)
  const duplicateRefund = await bankApp.inject({
    method: 'POST', url: '/api/admin/wallet/refunds', headers: withdrawalAdminHeaders,
    payload: { originalTransactionId: 'wallet-test-spend', reason: 'Không hoàn lần hai.' },
  })
  assert.equal(duplicateRefund.statusCode, 409)
  const adminTransactions = await bankApp.inject({
    method: 'GET', url: `/api/admin/transactions?search=${refund.json().refund.code}`, headers: withdrawalAdminHeaders,
  })
  assert.equal(adminTransactions.statusCode, 200, adminTransactions.body)
  assert.equal(adminTransactions.json().transactions.length, 1)
  assert.equal(adminTransactions.json().transactions[0].transactionCode, refund.json().refund.code)
  const adminFinancialAudits = await rankingClient.db('loveforyou-tests').collection('adminAuditLogs')
    .find({ action: { $in: ['wallet.refund', 'wallet.adjusted', 'withdrawal.paid', 'withdrawal.rejected'] } }).toArray()
  assert.equal(adminFinancialAudits.length, 4)
  await rankingClient.db('loveforyou-tests').collection('users')
    .updateOne({ _id: withdrawalAdminRecord._id }, { $set: { role: 'member' } })

  const persistedAccount = await rankingClient.db('loveforyou-tests').collection('bankAccounts')
    .findOne({ _id: saved.json().account.id })
  assert.equal(JSON.stringify(persistedAccount).includes('113366668888'), false)
  assert.equal(JSON.stringify(persistedAccount).includes('NGUYEN VAN A'), false)
  const accountList = await bankApp.inject({ method: 'GET', url: '/api/bank-accounts', headers })
  assert.equal(accountList.json().accounts.length, 1)
  assert.equal((await bankApp.inject({ method: 'GET', url: '/api/bank-accounts', headers: { cookie: otherBankUser.cookie } })).json().accounts.length, 0)
  assert.equal((await bankApp.inject({
    method: 'DELETE', url: `/api/bank-accounts/${saved.json().account.id}`, headers: { cookie: otherBankUser.cookie, origin },
  })).statusCode, 404)
  assert.equal((await bankApp.inject({
    method: 'DELETE', url: `/api/bank-accounts/${saved.json().account.id}`, headers,
  })).json().deleted, true)

  const expiring = await bankApp.inject({
    method: 'POST', url: '/api/bank-accounts/verify', headers, payload: { bankBin: '970415', accountNumber: '113366668888' },
  })
  const expiredId = expiring.json().verificationId
  await rankingClient.db('loveforyou-tests').collection('bankVerifications')
    .updateOne({ verificationId: expiredId }, { $set: { expiresAt: new Date(Date.now() - 1) } })
  const expiredContinue = await bankApp.inject({
    method: 'POST', url: '/api/bank-accounts/continue', headers,
    payload: { verificationId: expiredId, bankBin: '970415', accountNumber: '113366668888' },
  })
  assert.equal(expiredContinue.statusCode, 409)

  const noCredentialsApp = await createApp({
    mongoUri: mongo.getUri(),
    databaseName: 'loveforyou-tests',
    clientOrigin: origin,
    secureCookies: false,
    logger: { level: 'silent' },
    fetchImpl: fetchMock,
    vietqrClientId: '',
    vietqrApiKey: '',
    bankAccountEncryptionKey: 'b'.repeat(64),
  })
  testApps.push(noCredentialsApp)
  const missingCredentials = await noCredentialsApp.inject({
    method: 'POST', url: '/api/bank-accounts/verify', headers,
    payload: { bankBin: '970415', accountNumber: '113366668888' },
  })
  assert.equal(missingCredentials.statusCode, 503)
  assert.equal(missingCredentials.json().status, 'temporarily_unavailable')

  const noCacheApp = await createApp({
    mongoUri: mongo.getUri(),
    databaseName: 'bank-cache-unavailable-test',
    clientOrigin: origin,
    secureCookies: false,
    logger: { level: 'silent' },
    fetchImpl: async () => { throw new Error('network unavailable') },
  })
  testApps.push(noCacheApp)
  const noCacheBanks = await noCacheApp.inject({ method: 'GET', url: '/api/banks' })
  assert.equal(noCacheBanks.statusCode, 503)

  const cachedAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
  await rankingClient.db('loveforyou-tests').collection('bankCatalogCache')
    .updateOne({ _id: 'vietqr-bank-list' }, { $set: { cachedAt } })
  listUnavailable = true
  const staleCache = await bankApp.inject({ method: 'GET', url: '/api/banks' })
  assert.equal(staleCache.statusCode, 200)
  assert.equal(staleCache.json().banks.length, 2)

  let rateLimitResponse
  for (let attempt = 0; attempt < 15; attempt += 1) {
    rateLimitResponse = await bankApp.inject({
      method: 'POST', url: '/api/bank-accounts/verify', headers, payload: { bankBin: '970415', accountNumber: '113366668888' },
    })
    if (rateLimitResponse.statusCode === 429) break
  }
  assert.equal(rateLimitResponse.statusCode, 429)
})
