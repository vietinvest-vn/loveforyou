export type ApiUser = {
  publicId: string
  email: string
  displayName: string
  online: boolean
  role: 'admin' | 'member'
}

export type ApiProfile = ApiUser & {
  joinedAt: string
  bio: string
  relationshipStart: string
  pinnedQuickActions: string[]
  dateOfBirth: string
  gender: string
}

export type ApiEntry = {
  id: string
  type: 'journal' | 'memory' | 'letter'
  title: string
  date: string
  text: string
  image?: string | null
  imageMediaId?: string | null
  createdAt: string
  updatedAt: string
}

export type ApiMedia = {
  id: string
  category: string
  visibility: 'public' | 'private' | 'couple'
  format: string
  width: number
  height: number
  bytes: number
  relationshipId: string | null
  createdAt: string
  updatedAt: string
  url?: string
}

export type ApiInvitation = {
  id: string
  message: string
  relationshipStart: string
  status: string
  createdAt: string
  expiresAt: string
  publicId: string
  displayName: string
}

export type ApiConnection = {
  relationship: { id: string; connectedAt: string; publicId: string; displayName: string; dateOfBirth: string; relationshipStart: string; online: boolean } | null
  received: ApiInvitation[]
  sent: ApiInvitation[]
}

export type ApiNotification = {
  id: string
  type: string
  createdAt: string
  readAt: string
  invitationId: string | null
  messageId?: string
  giftId?: string
  giftName?: string
  actorName: string
  actorPublicId: string
  title?: string
  message?: string
}

export type ApiChatMessage = {
  id: string
  sender: 'me' | 'partner'
  text: string
  createdAt: string
  readAt: string
}

export type ApiLoveLevel = {
  relationshipId: string
  coupleRank: number
  partnerName: string
  relationshipStart: string
  daysTogether: number
  duration: { years: number; months: number; days: number }
  currentLevel: { number: number; title: string; icon: string; description: string }
  levels: { number: number; title: string; icon: string; description: string; date: string; achieved: boolean }[]
  nextLevel: { number: number; title: string; icon: string; description: string; date: string; daysRemaining: number } | null
  progressPercent: number
  daysToNextLevel: number | null
  milestones: {
    id: string
    title: string
    date: string
    level: number | null
    icon: string
    achievedAt: string
    message: string
    notificationId: string
    readAt: string
  }[]
  upcomingMilestones: { id: string; title: string; date: string; achieved: boolean; level: number | null; icon: string }[]
}

export type ApiWallet = {
  balance: number
  coinPriceVnd: number
  totalEarned: number
  totalSpent: number
  canSendCoins: boolean
  partnerName: string | null
  transactions: ApiWalletTransaction[]
}

export type ApiWalletTransaction = { id: string; code: string; item: string; amount: number; createdAt: string }

export type ApiWithdrawal = {
  id: string
  code: string
  status: 'pending_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled' | 'failed'
  coins: number
  amountVnd: number
  feeVnd: number
  receiveAmountVnd: number
  bankAccount: { bankName: string; bankShortName: string; accountName: string; accountNumber: string; accountLastFour: string }
  reason: string
  bankReference: string
  createdAt: string
  updatedAt: string
  reviewedAt: string
  history: { status: string; createdAt: string; reason: string; actor: string }[]
  user?: { id: string; publicId: string; displayName: string; email: string }
}

export type ApiPaymentMethod = {
  id: string
  name: string
  bankName: string
  bankCode: string
  bankBin: string
  accountHolder: string
  accountNumber: string
  paymentQrImage: string
  transferTemplate: string
  instructions: string
  enabled: boolean
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}

export type ApiBank = {
  id: number
  name: string
  code: string
  bin: string
  shortName: string
  logo: string
  lookupSupported: 0 | 1
  transferSupported: 0 | 1
}

export type ApiBankAccount = {
  id: string
  bankName: string
  bankShortName: string
  bankBin: string
  accountName: string
  maskedAccountNumber: string
  isDefault: boolean
  verifiedAt: string
}

export type ApiTopupPackage = {
  id: string
  name: string
  priceVnd: number
  coins: number
  bonusCoins: number
  enabled: boolean
  displayOrder: number
  purchases?: number
  revenueVnd?: number
}

export type ApiDeposit = {
  id: string
  code: string
  package: { packageId: string; name: string; priceVnd: number; coins: number; bonusCoins: number }
  paymentMethod?: Omit<ApiPaymentMethod, 'id' | 'enabled' | 'isDefault'> & { transferContent: string }
  status: 'awaiting_payment' | 'awaiting_review' | 'info_requested' | 'approved' | 'rejected' | 'cancelled'
  paymentProofImage?: string
  rejectionReason: string
  cancellationReason: string
  reviewMessage: string
  bankReference: string
  createdAt: string
  expiresAt: string
  paymentProofUploadedAt: string
  confirmedAt: string
  reviewedAt: string
  history: { status: string; createdAt: string; reason: string; actor?: { publicId: string; displayName: string } | null }[]
  reviewedBy?: { publicId: string; displayName: string } | null
  user?: { publicId: string; displayName: string; email: string }
}

export type ApiAdminOverviewSummary = {
  totalUsers: number
  activeUsers: number
  activeCouples: number
  totalCoinsTransferred: number
  sentGifts: number
}

export type ApiAdminOverviewPoint = {
  label: string
  value: number
}

export type ApiAdminTopUser = {
  id: string
  displayName: string
  plan: string
  points: number
  city: string
  status: string
}

export type ApiAdminActivity = {
  title: string
  subtitle: string
  time: string
}

export type ApiAdminSystemStatus = {
  title: string
  value: string
}

export type ApiAdminUser = {
  id: string
  publicId: string
  name: string
  email: string
  phone: string
  role: string
  status: 'Đang hoạt động' | 'Bị khóa'
  online: boolean
  joinedAt: string
  lastLoginAt: string
  lastSeenAt: string
  lockReason: string
  lockedAt: string
  avatar: string
}

export type ApiAdminUserSummary = {
  totalUsers: number
  activeUsers: number
  blockedUsers: number
}

export type ApiAdminUserDetail = {
  user: {
    id: string
    publicId: string
    displayName: string
    email: string
    phone: string
    accountStatus: 'active' | 'locked'
    createdAt: string
    lastLoginAt: string
    lastSeenAt: string
    lockReason: string
    lockedAt: string
  }
  walletTransactions: { id: string; description: string; amount: number; reference: string; createdAt: string }[]
}

export type ApiAdminTransaction = {
  id: string
  transactionCode: string
  userId: string
  publicId: string
  displayName: string
  email: string
  amount: number
  direction: 'credit' | 'debit'
  type: string
  reference: string
  status: string
  createdAt: string
  description: string
}

export type ApiAdminTransactionSummary = {
  totalTransactions: number
  totalCoinCredits: number
  totalCoinDebits: number
  ledgerCoinBalance: number
}

export type ApiAdminWallet = {
  userId: string
  publicId: string
  displayName: string
  email: string
  ledgerBalance: number
  availableBalance: number
  transactionCount: number
  hasMismatch: boolean
}

export type ApiAdminWalletSummary = {
  totalWallets: number
  totalLedgerCoins: number
  mismatchCount: number
}

export type ApiAdminCouple = {
  id: string
  status: 'connected' | 'pending' | 'rejected' | 'cancelled' | 'expired'
  participants: { id: string; publicId: string; displayName: string }[]
  relationshipStart: string
  createdAt: string
  actedAt: string
}

export type ApiReceivedGift = {
  id: string
  giftId: string
  giftName: string
  message: string
  senderName: string
  createdAt: string
  openedAt: string
  redeemedAt: string
  redeemedCoins: number
  coinValue: number
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  const apiPath = path.startsWith('/api/') ? path.slice(4) : path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}/api${apiPath}`
}

function parseResponseBody(text: string): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function responseErrorMessage(result: unknown, response: Response, text: string) {
  if (result && typeof result === 'object') {
    for (const field of ['error', 'message']) {
      const message = Reflect.get(result, field)
      if (typeof message === 'string' && message.trim()) return message
    }
  }
  const plainText = text.trim()
  if (plainText && !/^<!doctype html|^<html[\s>]/i.test(plainText)) return plainText
  const statusText = response.statusText ? ` ${response.statusText}` : ''
  return `Request failed (${response.status}${statusText}).`
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const result = parseResponseBody(text)
  if (!response.ok) {
    throw new ApiError(responseErrorMessage(result, response, text), response.status)
  }
  if (result === undefined) throw new ApiError('Invalid server response.', response.status)
  return result as T
}

function jsonBody(value: unknown) {
  return JSON.stringify(value)
}

export const api = {
  banks() {
    return request<{ banks: ApiBank[] }>('/banks')
  },

  verifyBankAccount(bankBin: string, accountNumber: string) {
    return request<{
      status: 'verified' | 'not_found' | 'unsupported' | 'temporarily_unavailable'
      verificationId?: string
      bank?: Pick<ApiBank, 'bin' | 'name' | 'shortName'>
      accountName?: string
      message?: string
    }>('/bank-accounts/verify', { method: 'POST', body: jsonBody({ bankBin, accountNumber }) })
  },

  continueWithVerifiedBankAccount(verificationId: string, bankBin: string, accountNumber: string) {
    return request<{ account: ApiBankAccount }>('/bank-accounts/continue', {
      method: 'POST', body: jsonBody({ verificationId, bankBin, accountNumber }),
    })
  },

  bankAccounts() {
    return request<{ accounts: ApiBankAccount[] }>('/bank-accounts')
  },

  deleteBankAccount(id: string) {
    return request<{ deleted: boolean }>(`/bank-accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  async login(email: string, password: string, rememberMe: boolean) {
    return (await request<{ user: ApiUser }>('/auth/login', { method: 'POST', body: jsonBody({ email, password, rememberMe }) })).user
  },

  async register(email: string, displayName: string, password: string, termsAccepted: boolean, dateOfBirth: string, gender: string) {
    return (await request<{ user: ApiUser }>('/auth/register', {
      method: 'POST',
      body: jsonBody({ email, displayName, password, termsAccepted, dateOfBirth, gender }),
    })).user
  },

  async currentUser() {
    return (await request<{ user: ApiUser }>('/auth/me')).user
  },

  logout() {
    return request<void>('/auth/logout', { method: 'POST', body: '{}' })
  },

  profile() {
    return request<ApiProfile>('/profile')
  },

  updateProfile(update: { displayName?: string; bio?: string; relationshipStart?: string; pinnedQuickActions?: string[] }) {
    return request<ApiProfile>('/profile', { method: 'PATCH', body: jsonBody(update) })
  },

  async entries() {
    return (await request<{ entries: ApiEntry[] }>('/entries')).entries
  },

  createEntry(entry: Omit<ApiEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    return request<{ entry: ApiEntry }>('/entries', {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: jsonBody(entry),
    })
  },

  updateEntry(id: string, update: Partial<Omit<ApiEntry, 'id' | 'createdAt' | 'updatedAt' | 'type'>>) {
    return request<{ entry: ApiEntry }>(`/entries/${encodeURIComponent(id)}`, { method: 'PATCH', body: jsonBody(update) })
  },

  deleteEntry(id: string) {
    return request<void>(`/entries/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  uploadMedia(input: { category: string; dataUrl: string; relationshipId?: string; replaceMediaId?: string }) {
    return request<{ media: ApiMedia }>('/media/upload', {
      method: 'POST',
      body: jsonBody(input),
    })
  },

  media(id: string) {
    return request<{ media: ApiMedia }>(`/media/${encodeURIComponent(id)}`)
  },

  deleteMedia(id: string) {
    return request<{ deleted: boolean; id: string }>(`/media/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  replaceMedia(id: string, dataUrl: string) {
    return request<{ media: ApiMedia }>(`/media/${encodeURIComponent(id)}/replace`, {
      method: 'POST',
      body: jsonBody({ dataUrl }),
    })
  },

  connections() {
    return request<ApiConnection>('/connections')
  },

  loveLevel() {
    return request<ApiLoveLevel>('/love-level')
  },

  wallet() {
    return request<ApiWallet>('/wallet')
  },

  topupOptions() {
    return request<{ coinPriceVnd: number; paymentMethods: ApiPaymentMethod[]; packages: ApiTopupPackage[] }>('/wallet/topup-options')
  },

  createDeposit(packageId: string) {
    return request<{ deposit: ApiDeposit }>('/wallet/deposits', { method: 'POST', body: jsonBody({ packageId }) })
  },

  uploadDepositReceipt(id: string, paymentProofImage: string) {
    return request<{ uploaded: boolean; paymentProofUploadedAt: string; paymentProofImage?: string; mediaId?: string }>(`/wallet/deposits/${encodeURIComponent(id)}/receipt`, {
      method: 'POST', body: jsonBody({ paymentProofImage }),
    })
  },

  confirmDeposit(id: string) {
    return request<{ deposit: ApiDeposit }>(`/wallet/deposits/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: '{}' })
  },

  removeDepositReceipt(id: string) {
    return request<{ removed: boolean }>(`/wallet/deposits/${encodeURIComponent(id)}/receipt`, { method: 'DELETE' })
  },

  walletDeposit(id: string) {
    return request<{ deposit: ApiDeposit }>(`/wallet/deposits/${encodeURIComponent(id)}`)
  },

  walletDeposits() {
    return request<{ deposits: ApiDeposit[] }>('/wallet/deposits')
  },

  createWithdrawal(bankAccountId: string, coins: number) {
    return request<{ withdrawal: ApiWithdrawal }>('/wallet/withdrawals', {
      method: 'POST', body: jsonBody({ bankAccountId, coins }),
    })
  },

  walletWithdrawals() {
    return request<{ withdrawals: ApiWithdrawal[] }>('/wallet/withdrawals')
  },

  cancelWithdrawal(id: string) {
    return request<{ withdrawal: ApiWithdrawal }>(`/wallet/withdrawals/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}' })
  },

  async walletTransactions() {
    return (await request<{ transactions: ApiWalletTransaction[] }>('/wallet/transactions')).transactions
  },

  async adminOverview() {
    return await request<{
      summary: ApiAdminOverviewSummary
      chart: ApiAdminOverviewPoint[]
      topUsers: ApiAdminTopUser[]
      activities: ApiAdminActivity[]
      systemStatus: ApiAdminSystemStatus[]
    }>('/admin/overview')
  },

  async adminUsers(filters: {
    search?: string
    status?: 'all' | 'active' | 'locked'
    registeredFrom?: string
    registeredTo?: string
    page?: number
    pageSize?: number
  } = {}) {
    const query = new URLSearchParams()
    if (filters.search) query.set('search', filters.search)
    if (filters.status && filters.status !== 'all') query.set('status', filters.status)
    if (filters.registeredFrom) query.set('registeredFrom', filters.registeredFrom)
    if (filters.registeredTo) query.set('registeredTo', filters.registeredTo)
    if (filters.page) query.set('page', String(filters.page))
    if (filters.pageSize) query.set('pageSize', String(filters.pageSize))
    const suffix = query.size ? `?${query.toString()}` : ''
    return request<{
      summary: ApiAdminUserSummary
      pagination: { page: number; pageSize: number; total: number; totalPages: number }
      users: ApiAdminUser[]
    }>(`/admin/users${suffix}`)
  },

  adminUserDetail(id: string) {
    return request<ApiAdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`)
  },

  async exportAdminUsers(filters: {
    search?: string
    status?: 'all' | 'active' | 'locked'
    registeredFrom?: string
    registeredTo?: string
  } = {}) {
    const query = new URLSearchParams()
    if (filters.search) query.set('search', filters.search)
    if (filters.status && filters.status !== 'all') query.set('status', filters.status)
    if (filters.registeredFrom) query.set('registeredFrom', filters.registeredFrom)
    if (filters.registeredTo) query.set('registeredTo', filters.registeredTo)
    const suffix = query.size ? `?${query.toString()}` : ''
    const response = await fetch(apiUrl(`/admin/users/export${suffix}`), { credentials: 'include' })
    if (!response.ok) {
      const text = await response.text()
      throw new ApiError(responseErrorMessage(parseResponseBody(text), response, text), response.status)
    }
    return response.blob()
  },

  updateAdminUserStatus(id: string, status: 'active' | 'locked', reason = '') {
    return request<{ id: string; status: 'active' | 'locked'; updatedAt: string }>(
      `/admin/users/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: jsonBody({ status, reason }) },
    )
  },

  async adminCouples(filters: { search?: string; status?: string } = {}) {
    const query = new URLSearchParams()
    if (filters.search) query.set('search', filters.search)
    if (filters.status && filters.status !== 'all') query.set('status', filters.status)
    const suffix = query.size ? `?${query.toString()}` : ''
    return (await request<{ couples: ApiAdminCouple[] }>(`/admin/couples${suffix}`)).couples
  },

  adminTransactions(filters: {
    search?: string
    direction?: 'all' | 'credit' | 'debit'
    type?: 'all' | 'deposit' | 'withdrawal' | 'refund' | 'adjustment' | 'other'
    from?: string
    to?: string
    amountMin?: number
    amountMax?: number
    page?: number
    pageSize?: number
  } = {}) {
    const query = new URLSearchParams()
    if (filters.search) query.set('search', filters.search)
    if (filters.direction && filters.direction !== 'all') query.set('direction', filters.direction)
    if (filters.type && filters.type !== 'all') query.set('type', filters.type)
    if (filters.from) query.set('from', filters.from)
    if (filters.to) query.set('to', filters.to)
    if (filters.amountMin !== undefined) query.set('amountMin', String(filters.amountMin))
    if (filters.amountMax !== undefined) query.set('amountMax', String(filters.amountMax))
    if (filters.page) query.set('page', String(filters.page))
    if (filters.pageSize) query.set('pageSize', String(filters.pageSize))
    return request<{
      summary: ApiAdminTransactionSummary
      pagination: { page: number; pageSize: number; total: number; totalPages: number }
      transactions: ApiAdminTransaction[]
    }>(`/admin/transactions${query.size ? `?${query.toString()}` : ''}`)
  },

  adminWithdrawals(filters: { status?: string; search?: string; from?: string; to?: string } = {}) {
    const query = new URLSearchParams()
    if (filters.status && filters.status !== 'all') query.set('status', filters.status)
    if (filters.search) query.set('search', filters.search)
    if (filters.from) query.set('from', filters.from)
    if (filters.to) query.set('to', filters.to)
    return request<{ withdrawals: ApiWithdrawal[] }>(`/admin/withdrawals${query.size ? `?${query.toString()}` : ''}`)
  },

  reviewAdminWithdrawal(id: string, body: { action: 'approve' | 'reject' | 'processing' | 'paid' | 'failed'; reason?: string; bankReference?: string }) {
    return request<{ withdrawal: ApiWithdrawal }>(`/admin/withdrawals/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: jsonBody(body),
    })
  },

  refundAdminWalletTransaction(originalTransactionId: string, reason: string) {
    return request<{ refund: { id: string; code: string; coins: number; status: string } }>('/admin/wallet/refunds', {
      method: 'POST', body: jsonBody({ originalTransactionId, reason }),
    })
  },

  adjustAdminWallet(userId: string, amount: number, reason: string) {
    return request<{ adjustment: { id: string; code: string; amount: number }; balance: number }>('/admin/wallet/adjustments', {
      method: 'POST', body: jsonBody({ userId, amount, reason }),
    })
  },

  adminWallets(filters: {
    search?: string
    status?: 'all' | 'balanced' | 'mismatch'
    page?: number
    pageSize?: number
  } = {}) {
    const query = new URLSearchParams()
    if (filters.search) query.set('search', filters.search)
    if (filters.status && filters.status !== 'all') query.set('status', filters.status)
    if (filters.page) query.set('page', String(filters.page))
    if (filters.pageSize) query.set('pageSize', String(filters.pageSize))
    return request<{
      summary: ApiAdminWalletSummary
      pagination: { page: number; pageSize: number; total: number; totalPages: number }
      wallets: ApiAdminWallet[]
    }>(`/admin/wallets${query.size ? `?${query.toString()}` : ''}`)
  },

  adminPaymentMethods() {
    return request<{ methods: ApiPaymentMethod[] }>('/admin/payment-methods')
  },

  createAdminPaymentMethod(method: Omit<ApiPaymentMethod, 'id' | 'createdAt' | 'updatedAt'>) {
    return request<{ method: ApiPaymentMethod }>('/admin/payment-methods', { method: 'POST', body: jsonBody(method) })
  },

  updateAdminPaymentMethod(id: string, method: Partial<Omit<ApiPaymentMethod, 'id' | 'createdAt' | 'updatedAt'>>) {
    return request<{ method: ApiPaymentMethod }>(`/admin/payment-methods/${encodeURIComponent(id)}`, { method: 'PATCH', body: jsonBody(method) })
  },

  adminTopupPackages() {
    return request<{ coinPriceVnd: number; packages: ApiTopupPackage[] }>('/admin/topup-packages')
  },

  createAdminTopupPackage(item: Omit<ApiTopupPackage, 'id' | 'coins' | 'purchases' | 'revenueVnd'>) {
    return request<{ package: ApiTopupPackage }>('/admin/topup-packages', { method: 'POST', body: jsonBody(item) })
  },

  updateAdminTopupPackage(id: string, item: Omit<ApiTopupPackage, 'id' | 'coins' | 'purchases' | 'revenueVnd'>) {
    return request<{ package: ApiTopupPackage }>(`/admin/topup-packages/${encodeURIComponent(id)}`, { method: 'PATCH', body: jsonBody(item) })
  },

  adminDeposits(filters: { status?: string; search?: string; from?: string; to?: string; amountMin?: number; amountMax?: number } = {}) {
    const query = new URLSearchParams()
    if (filters.status && filters.status !== 'all') query.set('status', filters.status)
    if (filters.search) query.set('search', filters.search)
    if (filters.from) query.set('from', filters.from)
    if (filters.to) query.set('to', filters.to)
    if (filters.amountMin !== undefined) query.set('amountMin', String(filters.amountMin))
    if (filters.amountMax !== undefined) query.set('amountMax', String(filters.amountMax))
    return request<{ deposits: ApiDeposit[] }>(`/admin/deposits${query.size ? `?${query.toString()}` : ''}`)
  },

  reviewAdminDeposit(id: string, payload: {
    action: 'approve' | 'reject' | 'needs_info'
    reason?: string
    verifiedReceived?: boolean
    receivedAmountVnd?: number
    bankReference?: string
  }) {
    return request<{ id: string; status: ApiDeposit['status'] }>(`/admin/deposits/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: jsonBody(payload),
    })
  },

  sendWalletCoins(amount: number) {
    return request<{ transferId: string }>('/wallet/send', { method: 'POST', body: jsonBody({ amount }) })
  },

  sendGift(giftId: string, message: string) {
    return request<{ transactionId: string; balance: number }>('/gifts/send', { method: 'POST', body: jsonBody({ giftId, message }) })
  },

  async receivedGifts() {
    return (await request<{ gifts: ApiReceivedGift[] }>('/gifts/received')).gifts
  },

  openReceivedGift(id: string) {
    return request<{ gift: ApiReceivedGift }>(`/gifts/received/${encodeURIComponent(id)}/open`, { method: 'POST', body: '{}' })
  },

  redeemReceivedGift(id: string) {
    return request<{ balance: number; redeemedCoins: number; redeemedAt: string }>(`/gifts/received/${encodeURIComponent(id)}/redeem`, { method: 'POST', body: '{}' })
  },

  chatMessages() {
    return request<{ messages: ApiChatMessage[]; partnerTyping: boolean }>('/chat/messages')
  },

  markChatMessagesRead() {
    return request<{ readAt: string }>('/chat/read', { method: 'POST' })
  },

  sendChatMessage(text: string) {
    return request<{ message: ApiChatMessage }>('/chat/messages', { method: 'POST', body: jsonBody({ text }) })
  },

  setChatTyping(typing: boolean) {
    return request<{ typing: boolean }>('/chat/typing', { method: 'POST', body: jsonBody({ typing }) })
  },

  searchAccount(publicId: string) {
    return request<{ account: Pick<ApiUser, 'publicId' | 'displayName'> }>(`/connections/search?id=${encodeURIComponent(publicId)}`)
  },

  sendInvitation(recipientId: string, message: string, relationshipStart: string) {
    return request('/connections/invitations', { method: 'POST', body: jsonBody({ recipientId, message, relationshipStart }) })
  },

  respondToInvitation(id: string, action: 'accept' | 'reject' | 'cancel') {
    return request(`/connections/invitations/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' })
  },

  async notifications() {
    return (await request<{ notifications: ApiNotification[] }>('/notifications')).notifications
  },

  markNotificationRead(id: string) {
    return request<{ id: string; readAt: string }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: '{}' })
  },

  markAllNotificationsRead() {
    return request<{ updated: number }>('/notifications/read-all', { method: 'POST', body: '{}' })
  },
}
