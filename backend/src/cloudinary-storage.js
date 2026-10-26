import { createHash, randomUUID } from 'node:crypto'
import { v2 as cloudinary } from 'cloudinary'

export const MEDIA_CATEGORIES = Object.freeze({
  avatar: { visibility: 'public', cloudType: 'upload', folder: 'loveforyou/avatars' },
  cover: { visibility: 'public', cloudType: 'upload', folder: 'loveforyou/covers' },
  entry_journal: { visibility: 'private', cloudType: 'authenticated', folder: 'loveforyou/entries/journal' },
  entry_memory: { visibility: 'private', cloudType: 'authenticated', folder: 'loveforyou/entries/memory' },
  entry_letter: { visibility: 'private', cloudType: 'authenticated', folder: 'loveforyou/entries/letter' },
  deposit_proof: { visibility: 'private', cloudType: 'authenticated', folder: 'loveforyou/wallet/proofs' },
  payment_qr: { visibility: 'public', cloudType: 'upload', folder: 'loveforyou/wallet/qr' },
  gift: { visibility: 'public', cloudType: 'upload', folder: 'loveforyou/gifts' },
  ui_asset: { visibility: 'public', cloudType: 'upload', folder: 'loveforyou/ui' },
  other: { visibility: 'private', cloudType: 'authenticated', folder: 'loveforyou/other' },
})

export const ALLOWED_IMAGE_MIME = Object.freeze({
  'image/jpeg': { format: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': { format: 'png', signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  'image/webp': { format: 'webp', signatures: [[0x52, 0x49, 0x46, 0x46]] },
})

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_PAYMENT_IMAGE_BYTES = 600_000
export const SIGNED_URL_TTL_SECONDS = 60 * 60

function matchesSignature(buffer, signature) {
  if (buffer.length < signature.length) return false
  return signature.every((byte, index) => buffer[index] === byte)
}

export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null
  for (const [mime, meta] of Object.entries(ALLOWED_IMAGE_MIME)) {
    if (meta.signatures.some((signature) => matchesSignature(buffer, signature))) {
      if (mime === 'image/webp') {
        const riff = buffer.subarray(8, 12).toString('ascii')
        if (riff !== 'WEBP') continue
      }
      return { mime, format: meta.format }
    }
  }
  return null
}

export function parseImageDataUrlToBuffer(value, maxBytes = MAX_IMAGE_BYTES) {
  if (typeof value !== 'string') return null
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) return null
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > maxBytes || buffer.toString('base64') !== match[2]) return null
  const detected = detectImageType(buffer)
  if (!detected || detected.mime !== match[1]) return null
  return { buffer, mime: detected.mime, format: detected.format }
}

function createMemoryStorage() {
  const assets = new Map()
  return {
    mode: 'memory',
    configured: true,
    async upload({ buffer, publicId, folder, type, format }) {
      const id = publicId || `${folder}/${randomUUID()}`
      const stored = {
        public_id: id,
        resource_type: 'image',
        type: type || 'upload',
        format: format || 'jpg',
        bytes: buffer.length,
        width: 0,
        height: 0,
        secure_url: `memory://asset/${encodeURIComponent(id)}`,
        version: Date.now(),
        etag: createHash('sha256').update(buffer).digest('hex').slice(0, 16),
        buffer,
      }
      assets.set(id, stored)
      return stored
    },
    async destroy({ publicId, type }) {
      const existing = assets.get(publicId)
      if (!existing) return { result: 'not found' }
      if (type && existing.type !== type) return { result: 'not found' }
      assets.delete(publicId)
      return { result: 'ok' }
    },
    deliveryUrl({ publicId, type = 'upload', transformation, signUrl = false, expiresAt }) {
      const asset = assets.get(publicId)
      if (!asset) return null
      const query = new URLSearchParams()
      if (transformation) query.set('t', JSON.stringify(transformation))
      if (signUrl) {
        query.set('signed', '1')
        if (expiresAt) query.set('expires', String(Math.floor(expiresAt.getTime() / 1000)))
      }
      query.set('type', type)
      return `memory://asset/${encodeURIComponent(publicId)}?${query}`
    },
    async readBuffer(publicId) {
      return assets.get(publicId)?.buffer ?? null
    },
  }
}

function createCloudinaryClient({ cloudName, apiKey, apiSecret }) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })

  return {
    mode: 'cloudinary',
    configured: true,
    async upload({ buffer, publicId, folder, type, format, tags = [] }) {
      const dataUri = `data:image/${format === 'jpg' ? 'jpeg' : format};base64,${buffer.toString('base64')}`
      return cloudinary.uploader.upload(dataUri, {
        folder,
        public_id: publicId ? publicId.split('/').pop() : undefined,
        resource_type: 'image',
        type: type || 'upload',
        overwrite: false,
        unique_filename: true,
        tags,
        format,
      })
    },
    async destroy({ publicId, type, resourceType = 'image' }) {
      return cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        type: type || 'upload',
        invalidate: true,
      })
    },
    deliveryUrl({ publicId, type = 'upload', transformation, signUrl = false, expiresAt }) {
      const options = {
        resource_type: 'image',
        type,
        secure: true,
        sign_url: Boolean(signUrl),
        ...(transformation ? { transformation } : {}),
      }
      if (signUrl && expiresAt instanceof Date) {
        options.expires_at = Math.floor(expiresAt.getTime() / 1000)
      }
      return cloudinary.url(publicId, options)
    },
    async readBuffer() {
      return null
    },
  }
}

export function createMediaStorage({
  cloudName = process.env.CLOUDINARY_CLOUD_NAME,
  apiKey = process.env.CLOUDINARY_API_KEY,
  apiSecret = process.env.CLOUDINARY_API_SECRET,
  forceMemory = process.env.CLOUDINARY_FORCE_MEMORY === '1',
} = {}) {
  const hasCredentials = Boolean(cloudName && apiKey && apiSecret)
  if (forceMemory || !hasCredentials) return createMemoryStorage()
  return createCloudinaryClient({ cloudName, apiKey, apiSecret })
}

export function isMediaStorageConfigured(storage) {
  return Boolean(storage?.configured)
}

export function categoryConfig(category) {
  return MEDIA_CATEGORIES[category] ?? null
}
