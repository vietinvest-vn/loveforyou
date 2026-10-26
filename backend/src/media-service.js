import { randomUUID } from 'node:crypto'
import {
  MAX_IMAGE_BYTES,
  MAX_PAYMENT_IMAGE_BYTES,
  SIGNED_URL_TTL_SECONDS,
  categoryConfig,
  detectImageType,
  parseImageDataUrlToBuffer,
} from './cloudinary-storage.js'

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode, expose: statusCode < 500 || statusCode === 503 })
}

const UPLOAD_WINDOW_MS = 15 * 60 * 1000
const UPLOAD_LIMIT_PER_WINDOW = 30
const uploadBuckets = new Map()

function consumeUploadQuota(userId) {
  const now = Date.now()
  const bucket = uploadBuckets.get(userId) ?? { count: 0, resetAt: now + UPLOAD_WINDOW_MS }
  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + UPLOAD_WINDOW_MS
  }
  if (bucket.count >= UPLOAD_LIMIT_PER_WINDOW) {
    throw httpError(429, 'Bạn đã tải ảnh quá nhiều lần. Hãy thử lại sau ít phút.')
  }
  bucket.count += 1
  uploadBuckets.set(userId, bucket)
}

export function publicMedia(media, { url } = {}) {
  if (!media) return null
  return {
    id: media._id,
    category: media.category,
    visibility: media.visibility,
    format: media.format,
    width: media.width,
    height: media.height,
    bytes: media.bytes,
    relationshipId: media.relationshipId ?? null,
    createdAt: media.createdAt?.toISOString?.() ?? media.createdAt,
    updatedAt: media.updatedAt?.toISOString?.() ?? media.updatedAt,
    ...(url ? { url } : {}),
  }
}

export function mediaContentPath(mediaId, variant = 'display') {
  const query = variant && variant !== 'display' ? `?variant=${encodeURIComponent(variant)}` : ''
  return `/api/media/${encodeURIComponent(mediaId)}/content${query}`
}

export function variantTransformation(variant) {
  if (variant === 'thumb') {
    return [{ width: 480, height: 480, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
  }
  if (variant === 'original') return []
  return [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
}

export function createMediaService({ database, storage, relationships }) {
  const media = database.collection('media')

  async function userRelationshipId(userId) {
    const relationship = await relationships.findOne({ members: userId })
    return relationship?._id ?? null
  }

  async function assertCanAccess(mediaDoc, user, { forAdmin = false } = {}) {
    if (!mediaDoc || mediaDoc.deletedAt) throw httpError(404, 'Không tìm thấy ảnh.')
    if (mediaDoc.visibility === 'public') return true
    if (forAdmin && user.role === 'admin') return true
    if (mediaDoc.ownerId === user.id) return true
    if (mediaDoc.category === 'deposit_proof' && user.role === 'admin') return true
    if (mediaDoc.visibility === 'couple' && mediaDoc.relationshipId) {
      const relationship = await relationships.findOne({ _id: mediaDoc.relationshipId, members: user.id })
      if (relationship) return true
    }
    throw httpError(403, 'Bạn không có quyền xem ảnh này.')
  }

  async function assertCanManage(mediaDoc, user) {
    if (!mediaDoc || mediaDoc.deletedAt) throw httpError(404, 'Không tìm thấy ảnh.')
    if (mediaDoc.ownerId === user.id) return true
    if (user.role === 'admin' && (mediaDoc.category === 'payment_qr' || mediaDoc.category === 'ui_asset' || mediaDoc.category === 'gift')) {
      return true
    }
    throw httpError(403, 'Bạn không có quyền xóa hoặc thay thế ảnh này.')
  }

  function deliveryFor(mediaDoc, variant = 'display') {
    const transformation = variantTransformation(variant)
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000)
    const needsSignature = mediaDoc.cloudinaryType !== 'upload'
    return storage.deliveryUrl({
      publicId: mediaDoc.cloudinaryPublicId,
      type: mediaDoc.cloudinaryType,
      transformation: transformation.length ? transformation : undefined,
      signUrl: needsSignature,
      expiresAt: needsSignature ? expiresAt : undefined,
    })
  }

  async function uploadImageBuffer({
    ownerId,
    buffer,
    category,
    relationshipId = null,
    tags = [],
    maxBytes = MAX_IMAGE_BYTES,
    replaceMediaId = null,
  }) {
    if (!storage?.configured) throw httpError(503, 'Dịch vụ lưu trữ ảnh chưa được cấu hình.')
    const config = categoryConfig(category)
    if (!config) throw httpError(400, 'Loại ảnh không được hỗ trợ.')
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw httpError(400, 'Tệp ảnh không hợp lệ.')
    if (buffer.length > maxBytes) throw httpError(400, `Ảnh vượt quá giới hạn ${Math.floor(maxBytes / 1024)} KB.`)

    const detected = detectImageType(buffer)
    if (!detected) throw httpError(400, 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP hợp lệ.')

    consumeUploadQuota(ownerId)

    let previous = null
    if (replaceMediaId) {
      previous = await media.findOne({ _id: replaceMediaId, ownerId, deletedAt: { $exists: false } })
      if (!previous) throw httpError(404, 'Không tìm thấy ảnh cần thay thế.')
      if (previous.category !== category) throw httpError(400, 'Không thể thay thế bằng loại ảnh khác.')
    }

    if (config.visibility === 'couple') {
      if (!relationshipId) throw httpError(400, 'Ảnh dùng chung cần gắn với mối quan hệ.')
      const relationship = await relationships.findOne({ _id: relationshipId, members: ownerId })
      if (!relationship) throw httpError(403, 'Bạn không thuộc mối quan hệ này.')
    }

    const uploaded = await storage.upload({
      buffer,
      folder: config.folder,
      type: config.cloudType,
      format: detected.format,
      tags: [...tags, category, `owner:${ownerId}`],
    })

    const now = new Date()
    const doc = {
      _id: randomUUID(),
      ownerId,
      cloudinaryPublicId: uploaded.public_id,
      cloudinaryType: uploaded.type || config.cloudType,
      resourceType: uploaded.resource_type || 'image',
      format: uploaded.format || detected.format,
      width: uploaded.width ?? 0,
      height: uploaded.height ?? 0,
      bytes: uploaded.bytes ?? buffer.length,
      category,
      visibility: config.visibility,
      relationshipId: config.visibility === 'couple' ? relationshipId : null,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await media.insertOne(doc)
    } catch (error) {
      try {
        await storage.destroy({ publicId: doc.cloudinaryPublicId, type: doc.cloudinaryType, resourceType: doc.resourceType })
      } catch {
        // Keep original insert error; orphan cleanup can retry later.
      }
      throw error
    }

    if (previous) {
      await softDeleteAndDestroy(previous).catch(() => undefined)
    }

    return doc
  }

  async function uploadFromDataUrl(ownerId, dataUrl, options = {}) {
    const maxBytes = options.maxBytes
      ?? (options.category === 'deposit_proof' || options.category === 'payment_qr' ? MAX_PAYMENT_IMAGE_BYTES : MAX_IMAGE_BYTES)
    const parsed = parseImageDataUrlToBuffer(dataUrl, maxBytes)
    if (!parsed) throw httpError(400, 'Ảnh cần ở định dạng JPEG, PNG hoặc WebP hợp lệ và trong giới hạn dung lượng.')
    return uploadImageBuffer({
      ownerId,
      buffer: parsed.buffer,
      category: options.category,
      relationshipId: options.relationshipId ?? null,
      replaceMediaId: options.replaceMediaId ?? null,
      maxBytes,
      tags: options.tags,
    })
  }

  async function softDeleteAndDestroy(mediaDoc) {
    const now = new Date()
    await media.updateOne({ _id: mediaDoc._id }, { $set: { deletedAt: now, updatedAt: now } })
    try {
      await storage.destroy({
        publicId: mediaDoc.cloudinaryPublicId,
        type: mediaDoc.cloudinaryType,
        resourceType: mediaDoc.resourceType,
      })
      await media.updateOne({ _id: mediaDoc._id }, { $set: { destroyedAt: new Date(), updatedAt: new Date() } })
    } catch (error) {
      await media.updateOne({
        _id: mediaDoc._id,
      }, {
        $set: {
          destroyError: String(error?.message ?? error).slice(0, 300),
          destroyRetryAt: new Date(Date.now() + 60_000),
          updatedAt: new Date(),
        },
      })
      throw error
    }
  }

  async function getAccessibleMedia(mediaId, user, { forAdmin = false } = {}) {
    const mediaDoc = await media.findOne({ _id: mediaId, deletedAt: { $exists: false } })
    await assertCanAccess(mediaDoc, user, { forAdmin })
    return mediaDoc
  }

  async function deleteOwnedMedia(mediaId, user) {
    const mediaDoc = await media.findOne({ _id: mediaId, deletedAt: { $exists: false } })
    await assertCanManage(mediaDoc, user)
    await softDeleteAndDestroy(mediaDoc)
    return { deleted: true, id: mediaId }
  }

  async function resolveImageField(value, user, { forAdmin = false } = {}) {
    if (!value) return undefined
    if (typeof value === 'string' && value.startsWith('data:image/')) return value
    if (typeof value === 'string' && value.startsWith('/api/media/')) return value
    if (typeof value === 'string' && /^https?:\/\//.test(value)) return value
    const mediaId = typeof value === 'string' ? value : value?.id
    if (!mediaId) return undefined
    try {
      const mediaDoc = await getAccessibleMedia(mediaId, user, { forAdmin })
      return mediaContentPath(mediaDoc._id)
    } catch {
      return undefined
    }
  }

  return {
    media,
    uploadImageBuffer,
    uploadFromDataUrl,
    getAccessibleMedia,
    deleteOwnedMedia,
    softDeleteAndDestroy,
    assertCanAccess,
    assertCanManage,
    deliveryFor,
    resolveImageField,
    userRelationshipId,
    publicMedia,
    mediaContentPath,
  }
}

export { MAX_IMAGE_BYTES, MAX_PAYMENT_IMAGE_BYTES, httpError as mediaHttpError }
