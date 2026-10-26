import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { createApp } from '../src/server.js'
import { createMediaStorage } from '../src/cloudinary-storage.js'

const origin = 'http://localhost:5173'
const tinyPng = 'data:image/png;base64,iVBORw0KGgo='
const mismatched = 'data:image/png;base64,/9j/AA=='
let mongo
let app
let alice
let bob

function cookieFrom(response) {
  return response.headers['set-cookie'].split(';', 1)[0]
}

async function register(email, displayName) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { origin },
    payload: { email, displayName, password: 'Correct-Horse-42!', termsAccepted: true },
  })
  assert.equal(response.statusCode, 201, response.body)
  return { cookie: cookieFrom(response), user: response.json().user }
}

before(async () => {
  let nextId = 1
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  app = await createApp({
    mongoUri: mongo.getUri(),
    databaseName: 'loveforyou-media-tests',
    clientOrigin: origin,
    secureCookies: false,
    logger: { level: 'error' },
    generatePublicId: () => String(nextId++).padStart(6, '0'),
    mediaStorage: createMediaStorage({ forceMemory: true }),
  })
  alice = await register('media-alice@example.test', 'Media Alice')
  bob = await register('media-bob@example.test', 'Media Bob')
})

after(async () => {
  await app.close()
  await mongo.stop()
})

test('rejects anonymous media upload', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/media/upload',
    headers: { origin },
    payload: { category: 'entry_memory', dataUrl: tinyPng },
  })
  assert.equal(response.statusCode, 401)
})

test('rejects non-image and oversized payloads', async () => {
  const headers = { cookie: alice.cookie, origin }
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/media/upload',
    headers,
    payload: { category: 'entry_memory', dataUrl: mismatched },
  })
  assert.equal(invalid.statusCode, 400)

  const huge = `data:image/png;base64,${Buffer.alloc(700_000, 1).toString('base64')}`
  const tooLarge = await app.inject({
    method: 'POST',
    url: '/api/media/upload',
    headers,
    payload: { category: 'deposit_proof', dataUrl: huge },
  })
  assert.equal(tooLarge.statusCode, 400)
})

test('authenticated users can upload, view, and delete their own private images', async () => {
  const headers = { cookie: alice.cookie, origin }
  const uploaded = await app.inject({
    method: 'POST',
    url: '/api/media/upload',
    headers,
    payload: { category: 'entry_journal', dataUrl: tinyPng },
  })
  assert.equal(uploaded.statusCode, 201, uploaded.body)
  const media = uploaded.json().media
  assert.equal(media.category, 'entry_journal')
  assert.equal(media.visibility, 'private')
  assert.match(media.url, /^\/api\/media\/.+\/content$/)
  assert.equal(media.apiSecret, undefined)
  assert.ok(!JSON.stringify(uploaded.json()).includes('api_secret'))

  const meta = await app.inject({ method: 'GET', url: `/api/media/${media.id}`, headers })
  assert.equal(meta.statusCode, 200)
  const content = await app.inject({ method: 'GET', url: media.url, headers: { cookie: alice.cookie } })
  assert.equal(content.statusCode, 200)
  assert.match(content.headers['content-type'], /^image\//)

  const bobBlocked = await app.inject({
    method: 'GET',
    url: media.url,
    headers: { cookie: bob.cookie },
  })
  assert.equal(bobBlocked.statusCode, 403)

  const bobDelete = await app.inject({
    method: 'DELETE',
    url: `/api/media/${media.id}`,
    headers: { cookie: bob.cookie, origin },
  })
  assert.equal(bobDelete.statusCode, 403)

  const deleted = await app.inject({
    method: 'DELETE',
    url: `/api/media/${media.id}`,
    headers,
  })
  assert.equal(deleted.statusCode, 200)
  const missing = await app.inject({ method: 'GET', url: media.url, headers: { cookie: alice.cookie } })
  assert.equal(missing.statusCode, 404)
})

test('entries store media ids instead of base64 and keep legacy images readable', async () => {
  const headers = { cookie: alice.cookie, origin }
  const created = await app.inject({
    method: 'POST',
    url: '/api/entries',
    headers: { ...headers, 'idempotency-key': 'media-entry-1' },
    payload: {
      type: 'memory',
      title: 'Kỷ niệm có ảnh',
      date: '2024-01-01',
      text: 'Ảnh lưu trên Cloudinary memory store.',
      image: tinyPng,
    },
  })
  assert.equal(created.statusCode, 201, created.body)
  const entry = created.json().entry
  assert.ok(entry.imageMediaId)
  assert.match(entry.image, /^\/api\/media\/.+\/content$/)
  assert.ok(!entry.image.startsWith('data:image/'))

  const bobCannotDeleteMedia = await app.inject({
    method: 'DELETE',
    url: `/api/media/${entry.imageMediaId}`,
    headers: { cookie: bob.cookie, origin },
  })
  assert.equal(bobCannotDeleteMedia.statusCode, 403)

  const repeated = await app.inject({
    method: 'POST',
    url: '/api/entries',
    headers: { ...headers, 'idempotency-key': 'media-entry-1' },
    payload: {
      type: 'memory',
      title: 'Kỷ niệm có ảnh',
      date: '2024-01-01',
      text: 'Ảnh lưu trên Cloudinary memory store.',
      image: tinyPng,
    },
  })
  assert.equal(repeated.statusCode, 200)
  assert.equal(repeated.json().entry.id, entry.id)
})
