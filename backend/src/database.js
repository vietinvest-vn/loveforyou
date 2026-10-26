import { MongoClient } from 'mongodb'

export async function openDatabase({
  uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
  databaseName = process.env.MONGODB_DB_NAME ?? 'loveforyou',
} = {}) {
  const client = new MongoClient(uri)
  try {
    await client.connect()
  } catch (error) {
    await client.close()
    if (error.codeName === 'AtlasError' && /authentication failed/i.test(error.message)) {
      throw new Error(
        'MongoDB Atlas rejected the database credentials. Check the Database Access username and password in MONGODB_URI; URL-encode any reserved characters in the password.',
        { cause: error },
      )
    }
    throw error
  }
  const database = client.db(databaseName)

  try {
    await Promise.all([
      database.collection('users').createIndex({ email: 1 }, { unique: true }),
      database.collection('users').createIndex({ publicId: 1 }, { unique: true }),
      database.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
      database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database.collection('entries').createIndex({ ownerUserId: 1, idempotencyKey: 1 }, { unique: true }),
      database.collection('entries').createIndex({ ownerUserId: 1, date: -1, createdAt: -1 }),
      database.collection('walletTransactions').createIndex({ userId: 1, createdAt: -1 }),
      database.collection('walletAccounts').createIndex({ userId: 1 }, { unique: true }),
      database.collection('chatMessages').createIndex({ relationshipId: 1, createdAt: 1 }),
      database.collection('chatPresence').createIndex({ relationshipId: 1, userId: 1 }, { unique: true }),
      database.collection('invitations').createIndex({ pairKey: 1, status: 1 }, {
        unique: true,
        partialFilterExpression: { status: 'pending' },
      }),
      database.collection('invitations').createIndex({ recipientUserId: 1, status: 1, createdAt: -1 }),
      database.collection('invitations').createIndex({ senderUserId: 1, status: 1, createdAt: -1 }),
      database.collection('relationships').createIndex({ members: 1 }, { unique: true }),
      database.collection('relationships').createIndex({ pairKey: 1 }, { unique: true }),
      database.collection('relationships').createIndex({ relationshipStart: 1, _id: 1 }),
      database.collection('blocks').createIndex({ blockerUserId: 1, blockedUserId: 1 }, { unique: true }),
      database.collection('notifications').createIndex({ userId: 1, createdAt: -1 }),
      database.collection('notifications').createIndex(
        { userId: 1, dedupeKey: 1 },
        { unique: true, partialFilterExpression: { dedupeKey: { $exists: true } } },
      ),
      database.collection('loveMilestones').createIndex({ relationshipId: 1, milestoneId: 1 }, { unique: true }),
      database.collection('adminAuditLogs').createIndex({ createdAt: -1 }),
      database.collection('adminAuditLogs').createIndex({ actorUserId: 1, createdAt: -1 }),
      database.collection('paymentMethods').createIndex({ enabled: 1, isDefault: 1 }),
      database.collection('paymentMethods').createIndex(
        { isDefault: 1 },
        { unique: true, partialFilterExpression: { isDefault: true } },
      ),
      database.collection('bankVerifications').createIndex({ verificationId: 1 }, { unique: true }),
      database.collection('bankVerifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database.collection('bankVerifications').createIndex({ userId: 1, sessionTokenHash: 1, expiresAt: -1 }),
      database.collection('bankAccounts').createIndex({ userId: 1, createdAt: -1 }),
      database.collection('bankAccounts').createIndex(
        { userId: 1, isDefault: 1 },
        { name: 'bankAccounts_userId_default_unique', unique: true, partialFilterExpression: { isDefault: true } },
      ),
      database.collection('topupPackages').createIndex({ enabled: 1, displayOrder: 1 }),
      database.collection('depositRequests').createIndex({ code: 1 }, { unique: true }),
      database.collection('depositRequests').createIndex({ activeDepositUserId: 1 }, { unique: true, sparse: true }),
      database.collection('depositRequests').createIndex({ userId: 1, createdAt: -1 }),
      database.collection('depositRequests').createIndex({ status: 1, createdAt: -1 }),
      database.collection('transactionCodes').createIndex({ code: 1 }, { unique: true }),
      database.collection('withdrawalRequests').createIndex({ code: 1 }, { unique: true }),
      database.collection('withdrawalRequests').createIndex({ userId: 1, createdAt: -1 }),
      database.collection('withdrawalRequests').createIndex({ status: 1, createdAt: -1 }),
      database.collection('refundRequests').createIndex({ code: 1 }, { unique: true }),
      database.collection('refundRequests').createIndex({ originalTransactionId: 1 }, { unique: true }),
      database.collection('balanceAdjustments').createIndex({ code: 1 }, { unique: true }),
      database.collection('media').createIndex({ ownerId: 1, createdAt: -1 }),
      database.collection('media').createIndex({ category: 1, ownerId: 1, createdAt: -1 }),
      database.collection('media').createIndex({ relationshipId: 1, createdAt: -1 }, { sparse: true }),
      database.collection('media').createIndex({ cloudinaryPublicId: 1 }, { unique: true }),
      database.collection('media').createIndex({ destroyRetryAt: 1 }, { sparse: true }),
    ])
  } catch (error) {
    await client.close()
    throw error
  }

  return {
    database,
    client,
    close: () => client.close(),
    async withTransaction(operation) {
      const session = client.startSession()
      try {
        let result
        await session.withTransaction(async () => {
          result = await operation(session)
        })
        return result
      } finally {
        await session.endSession()
      }
    },
  }
}
