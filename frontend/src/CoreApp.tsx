import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, Bell, BookOpen, CalendarHeart, Crown, Flower2, Gift, Heart, HeartHandshake, House, Image as ImageIcon, ImagePlus, Mail, MailPlus, MessagesSquare, Sparkles, Star, UserRound, Wallet, X } from 'lucide-react'
import { api, apiUrl, ApiError, type ApiChatMessage, type ApiConnection, type ApiEntry, type ApiLoveLevel, type ApiNotification, type ApiProfile, type ApiReceivedGift, type ApiUser } from './apiClient'
import { optimizeImage } from './utils/image'
import { authModeFromPath, authPaths, isAdminPage, isKnownPagePath, landingPathForRole, pageFromPath, pagePaths, type Page } from './routing'
import AuthGate from './components/auth/AuthGate'
import ActivityFeedPage from './pages/ActivityFeedPage'
import ConnectionsPage from './pages/ConnectionsPage'
import ChatPage from './pages/ChatPage'
import EntriesPage from './pages/EntriesPage'
import EventsPage from './pages/EventsPage'
import FeaturePlaceholderPage from './pages/FeaturePlaceholderPage'
import HomePage from './pages/HomePage'
import JourneyPage from './pages/JourneyPage'
import WalletPage from './pages/WalletPage'
import WalletHistoryPage from './pages/WalletHistoryPage'
import GiftsPage from './pages/GiftsPage'
import LoveLevelPage from './pages/LoveLevelPage'
import ProfileEditPage from './pages/ProfileEditPage'
import ProfilePage from './pages/ProfilePage'
import PremiumPage from './pages/PremiumPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import SettingsPage from './pages/SettingsPage'
import ShortcutsPage from './pages/ShortcutsPage'
import TermsPage from './pages/TermsPage'
import AdminDashboardPage from './pages/admin/AdminOverviewPage'
import UserManagementPage from './pages/admin/AdminUsersPage'
import AdminTransactionsPage from './pages/admin/AdminTransactionsPage'
import AdminCouplesPage from './pages/admin/AdminCouplesPage'
import AdminContentPage from './pages/admin/AdminContentPage'
import AdminMessagesPage from './pages/admin/AdminMessagesPage'
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage'
import AdminPremiumPage from './pages/admin/AdminPremiumPage'
import AdminWalletPage from './pages/admin/AdminWalletPage'
import AdminDepositsPage from './pages/admin/AdminDepositsPage'
import AdminPaymentQrPage from './pages/admin/AdminPaymentQrPage'
import AdminTopupPackagesPage from './pages/admin/AdminTopupPackagesPage'
import AdminWithdrawalsPage from './pages/admin/AdminWithdrawalsPage'
import AdminStorePage from './pages/admin/AdminStorePage'
import AdminGiftsPage from './pages/admin/AdminGiftsPage'
import AdminItemsPage from './pages/admin/AdminItemsPage'
import AdminPromotionsPage from './pages/admin/AdminPromotionsPage'
import AdminSupportPage from './pages/admin/AdminSupportPage'
import AdminSecurityPage from './pages/admin/AdminSecurityPage'
import AdminAuditLogPage from './pages/admin/AdminAuditLogPage'
import AdminReportsPage from './pages/admin/AdminReportsPage'
import AdminRolesPage from './pages/admin/AdminRolesPage'
import AdminSystemPage from './pages/admin/AdminSystemPage'
import AdminBackupsPage from './pages/admin/AdminBackupsPage'
import AdminHelpPage from './pages/admin/AdminHelpPage'
import AdminAccountPage from './pages/admin/AdminAccountPage'
import './CoreApp.css'
import { giftItems } from './utils/gifts'

type EntryType = Extract<Page, 'journal' | 'memory' | 'letter'>
type QuickActionId = 'love-letter' | 'memory' | 'gift' | 'countdown' | 'private-room' | 'daily-question'
const DEFAULT_PINNED_QUICK_ACTIONS: QuickActionId[] = ['love-letter', 'memory', 'gift', 'countdown']
const quickActions: { id: QuickActionId; label: string; page: Page; icon: typeof House; entryType?: EntryType; development?: boolean }[] = [
  { id: 'love-letter', label: 'Gửi thư tình', page: 'letter', icon: MailPlus, entryType: 'letter' },
  { id: 'memory', label: 'Tạo kỷ niệm', page: 'memory', icon: ImagePlus, entryType: 'memory' },
  { id: 'gift', label: 'Gửi quà', page: 'gifts', icon: Gift, development: true },
  { id: 'countdown', label: 'Đếm ngược', page: 'events', icon: CalendarHeart, development: true },
  { id: 'private-room', label: 'Chat', page: 'chat', icon: MessagesSquare },
  { id: 'daily-question', label: 'Câu hỏi hằng ngày', page: 'questions', icon: Star, development: true },
]

const pageLabels: Record<Page, string> = {
  home: 'Trang chủ',
  activities: 'Hoạt động',
  journey: 'Hành trình tình yêu',
  shortcuts: 'Tất cả lối tắt',
  journal: 'Nhật ký',
  memory: 'Kỷ niệm',
  letter: 'Thư',
  profile: 'Hồ sơ',
  'profile-edit': 'Chỉnh sửa hồ sơ',
  settings: 'Cài đặt',
  'love-level': 'Cấp độ tình yêu',
  terms: 'Điều khoản sử dụng',
  'privacy-policy': 'Chính sách bảo mật',
  premium: 'Nâng cấp Premium',
  chat: 'Chat',
  connections: 'Kết nối',
  notifications: 'Thông báo',
  events: 'Sự kiện',
  gifts: 'Quà tặng',
  wallet: 'Ví',
  'wallet-history': 'Lịch sử giao dịch',
  privacy: 'Phòng riêng',
  questions: 'Câu hỏi hằng ngày',
  admin: 'Bảng điều khiển',
  'admin-users': 'Quản lý người dùng',
  'admin-couples': 'Quản lý cặp đôi',
  'admin-content': 'Quản lý nội dung',
  'admin-messages': 'Quản lý tin nhắn',
  'admin-notifications': 'Quản lý thông báo',
  'admin-premium': 'Quản lý Premium',
  'admin-wallet': 'Quản lý ví',
  'admin-deposits': 'Quản lý nạp tiền',
  'admin-payment-qr': 'Cấu hình thanh toán QR',
  'admin-topup-packages': 'Quản lý gói nạp',
  'admin-withdrawals': 'Quản lý rút tiền',
  'admin-transactions': 'Lịch sử giao dịch',
  'admin-store': 'Quản lý cửa hàng',
  'admin-gifts': 'Quản lý quà tặng',
  'admin-items': 'Quản lý xu và vật phẩm',
  'admin-promotions': 'Quản lý khuyến mãi',
  'admin-support': 'Hỗ trợ và khiếu nại',
  'admin-security': 'Quản lý an ninh',
  'admin-audit-log': 'Nhật ký quản trị',
  'admin-reports': 'Báo cáo và thống kê',
  'admin-roles': 'Quản lý Admin và phân quyền',
  'admin-system': 'Cấu hình hệ thống',
  'admin-backups': 'Quản lý dữ liệu và sao lưu',
  'admin-help': 'Trợ giúp và tài liệu',
  'admin-account': 'Tài khoản Admin của tôi',
}

const navItems: { page: Page; label: string; icon: typeof House }[] = [
  { page: 'home', label: 'Trang chủ', icon: House },
  { page: 'activities', label: 'Hoạt động', icon: Activity },
  { page: 'memory', label: 'Kỷ niệm', icon: ImageIcon },
  { page: 'wallet', label: 'Ví', icon: Wallet },
  { page: 'profile', label: 'Cá nhân', icon: UserRound },
]

const developmentDescriptions: Partial<Record<Page, string>> = {
  privacy: 'Các công cụ phòng riêng đang được phát triển.',
  questions: 'Câu hỏi mỗi ngày đang được phát triển.',
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi')).join('')
}

function dayCountFrom(startDate: string, today: Date) {
  if (!startDate) return null
  const start = new Date(`${startDate}T00:00:00Z`)
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  if (Number.isNaN(startDay) || startDay > current) return null
  return Math.floor((current - startDay) / 86_400_000) + 1
}

function annualDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, Math.min(day, new Date(year, month, 0).getDate()))
}

function daysUntil(date: Date, today: Date) {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const targetUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((targetUtc - todayUtc) / 86_400_000)
}

type UpcomingCelebration = {
  kind: 'birthday' | 'anniversary'
  title: string
  date: Date
  days: number
}

function nextBirthday(dateOfBirth: string, displayName: string, today: Date): UpcomingCelebration | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth)
  if (!match) return null
  const [, yearPart, monthPart, dayPart] = match
  const birthYear = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  const birthDate = annualDate(birthYear, month, day)
  if (birthDate.getFullYear() !== birthYear || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return null
  let date = annualDate(today.getFullYear(), month, day)
  if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    date = annualDate(today.getFullYear() + 1, month, day)
  }
  return { kind: 'birthday', title: `Sinh nhật ${displayName}`, date, days: daysUntil(date, today) }
}

function nextAnniversary(startDate: string, today: Date): UpcomingCelebration | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate)
  if (!match) return null
  const [, yearPart, monthPart, dayPart] = match
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  const start = annualDate(year, month, day)
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (start > todayDate) return null
  let targetYear = today.getFullYear()
  let date = annualDate(targetYear, month, day)
  if (date < todayDate || targetYear === year) {
    targetYear += 1
    date = annualDate(targetYear, month, day)
  }
  return {
    kind: 'anniversary',
    title: `Kỷ niệm ${Math.max(1, targetYear - year)} năm`,
    date,
    days: daysUntil(date, today),
  }
}

function greeting(today: Date) {
  const hour = today.getHours()
  return hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
}

function localDateValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function relativeActivityTime(value: string, now: Date) {
  const createdAt = new Date(value)
  if (Number.isNaN(createdAt.getTime())) return 'Thời gian không xác định'
  const minutes = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000))
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' }).format(createdAt)
}

function CoreApp() {
  const location = useLocation()
  const navigate = useNavigate()
  const authMode = authModeFromPath(location.pathname)
  const currentPath = useRef(location.pathname)
  const previousPath = useRef<string | null>(null)
  const [today, setToday] = useState(() => new Date())
  const [user, setUser] = useState<ApiUser | null>(null)
  const page = pageFromPath(location.pathname)
  const [entries, setEntries] = useState<ApiEntry[]>([])
  const [profile, setProfile] = useState<ApiProfile | null>(null)
  const [connection, setConnection] = useState<ApiConnection>({ relationship: null, received: [], sent: [] })
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [notificationsReady, setNotificationsReady] = useState(false)
  const [giftNotificationQueue, setGiftNotificationQueue] = useState<ApiNotification[]>([])
  const [openedIncomingGift, setOpenedIncomingGift] = useState<ApiReceivedGift | null>(null)
  const [openingIncomingGiftId, setOpeningIncomingGiftId] = useState('')
  const [chatData, setChatData] = useState<{ relationshipId: string; messages: ApiChatMessage[]; partnerTyping: boolean } | null>(null)
  const [sendingChat, setSendingChat] = useState(false)
  const [loveLevel, setLoveLevel] = useState<ApiLoveLevel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [savingPins, setSavingPins] = useState(false)
  const [refreshingConnections, setRefreshingConnections] = useState(false)
  const [editing, setEditing] = useState<ApiEntry | null>(null)
  const [entryImagePreview, setEntryImagePreview] = useState('')
  const [entryImageMediaId, setEntryImageMediaId] = useState<string | null>(null)
  const [entryImageBusy, setEntryImageBusy] = useState(false)
  const [entryImageError, setEntryImageError] = useState('')
  const [removeEntryImage, setRemoveEntryImage] = useState(false)
  const entryImageInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [relationshipStart, setRelationshipStart] = useState('')
  const [pinDraft, setPinDraft] = useState<QuickActionId[]>(DEFAULT_PINNED_QUICK_ACTIONS)
  const [foundAccount, setFoundAccount] = useState<Pick<ApiUser, 'publicId' | 'displayName'> | null>(null)
  const lastLoveLevelSync = useRef(0)
  const knownNotificationIds = useRef(new Set<string>())
  const maxRelationshipStart = localDateValue(today)
  const relationshipIdForLevelRefresh = connection.relationship?.id
  const hasChatDataForRelationship = chatData?.relationshipId === relationshipIdForLevelRefresh
  const chatMessages = hasChatDataForRelationship ? chatData?.messages ?? [] : []
  const chatPartnerTyping = hasChatDataForRelationship ? chatData?.partnerTyping ?? false : false
  const loadingChat = page === 'chat' && Boolean(relationshipIdForLevelRefresh) && !hasChatDataForRelationship

  function setPage(nextPage: Page) {
    const nextPath = pagePaths[nextPage]
    if (location.pathname !== nextPath) navigate(nextPath)
  }

  function pageForBackFallback(currentPage: Page): Page {
    if (currentPage === 'wallet-history') return 'wallet'
    if (currentPage === 'settings' || currentPage === 'profile-edit' || currentPage === 'love-level' || currentPage === 'connections') return 'profile'
    if (currentPage === 'profile' || isAdminPage(currentPage)) return 'home'
    return 'home'
  }

  function goBack(fallback: Page) {
    if (previousPath.current && previousPath.current !== location.pathname) navigate(previousPath.current)
    else setPage(fallback)
  }

  useEffect(() => {
    if (currentPath.current !== location.pathname) {
      previousPath.current = currentPath.current
      currentPath.current = location.pathname
    }
  }, [location.pathname])

  useEffect(() => {
    if (authMode) {
      if (user) navigate(landingPathForRole(user.role), { replace: true })
      return
    }
    if (!isKnownPagePath(location.pathname)) {
      navigate(user ? landingPathForRole(user.role) : authPaths.login, { replace: true })
      return
    }
    if (!loading && !user && page !== 'terms' && page !== 'privacy-policy') navigate(authPaths.login, { replace: true })
  }, [authMode, location.pathname, loading, navigate, page, user])

  useEffect(() => {
    if (loading || !user) return

    const isAdminUser = user.role === 'admin'
    const isAdminRoute = isAdminPage(page)

    if (isAdminUser) {
      if (!isAdminRoute) {
        navigate(landingPathForRole(user.role), { replace: true })
      }
      return
    }

    if (isAdminRoute) {
      navigate(landingPathForRole(user.role), { replace: true })
    }
  }, [loading, navigate, page, user])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4_000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (page !== 'chat' || !user || !relationshipIdForLevelRefresh) return
    let active = true
    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let reconnectDelay = 1_000
    const refreshChat = async () => {
      try {
        const result = await api.chatMessages()
        if (active) setChatData((current) => {
          const latestMessages = current?.relationshipId === relationshipIdForLevelRefresh ? current.messages : []
          const messagesById = new Map(result.messages.map((message) => [message.id, message]))
          for (const message of latestMessages) {
            const serverMessage = messagesById.get(message.id)
            messagesById.set(message.id, serverMessage
              ? { ...message, ...serverMessage, readAt: serverMessage.readAt || message.readAt }
              : message)
          }
          return {
            relationshipId: relationshipIdForLevelRefresh,
            messages: [...messagesById.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
            partnerTyping: result.partnerTyping,
          }
        })
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải tin nhắn.')
      }
    }
    void refreshChat()

    const connect = () => {
      if (!active) return
      const socketUrl = new URL(apiUrl('/chat/socket'), window.location.href)
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(socketUrl)
      socket.addEventListener('open', () => {
        reconnectDelay = 1_000
        void refreshChat()
      })
      socket.addEventListener('message', (event) => {
        let payload: { type?: string; message?: ApiChatMessage; typing?: boolean; readAt?: string }
        try {
          payload = JSON.parse(String(event.data)) as typeof payload
        } catch {
          return
        }
        if (payload.type === 'message' && payload.message) {
          const receivedMessage = payload.message
          setChatData((current) => {
            const messages = current?.relationshipId === relationshipIdForLevelRefresh ? current.messages : []
            if (messages.some((message) => message.id === receivedMessage.id)) return current
            return { relationshipId: relationshipIdForLevelRefresh, messages: [...messages, receivedMessage], partnerTyping: current?.partnerTyping ?? false }
          })
          if (receivedMessage.sender === 'partner') void refreshChat()
        } else if (payload.type === 'typing' && typeof payload.typing === 'boolean') {
          setChatData((current) => ({
            relationshipId: relationshipIdForLevelRefresh,
            messages: current?.relationshipId === relationshipIdForLevelRefresh ? current.messages : [],
            partnerTyping: payload.typing ?? false,
          }))
        } else if (payload.type === 'read' && payload.readAt) {
          setChatData((current) => ({
            relationshipId: relationshipIdForLevelRefresh,
            messages: current?.relationshipId === relationshipIdForLevelRefresh
              ? current.messages.map((message) => message.sender === 'me' && !message.readAt ? { ...message, readAt: payload.readAt ?? '' } : message)
              : [],
            partnerTyping: current?.partnerTyping ?? false,
          }))
        }
      })
      socket.addEventListener('close', () => {
        if (!active) return
        reconnectTimer = window.setTimeout(connect, reconnectDelay)
        reconnectDelay = Math.min(reconnectDelay * 2, 10_000)
      })
      socket.addEventListener('error', () => socket?.close())
    }
    connect()

    return () => {
      active = false
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [page, relationshipIdForLevelRefresh, user])

  useEffect(() => {
    const interval = window.setInterval(() => setToday(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!user || !notificationsReady) return
    let active = true
    let refreshing = false
    const refreshNotifications = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const latestNotifications = await api.notifications()
        if (!active) return
        const newGiftNotifications = latestNotifications.filter((item) =>
          item.type === 'gift_received' && !knownNotificationIds.current.has(item.id),
        )
        knownNotificationIds.current = new Set(latestNotifications.map((item) => item.id))
        setNotifications(latestNotifications)
        if (newGiftNotifications.length) {
          setGiftNotificationQueue((queue) => {
            const queuedIds = new Set(queue.map((item) => item.id))
            return [...queue, ...newGiftNotifications.filter((item) => !queuedIds.has(item.id))]
          })
          if (document.visibilityState !== 'visible' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            for (const item of newGiftNotifications) {
              const browserNotification = new Notification('Bạn nhận được quà mới', {
                body: `${item.actorName || 'Người thương'} gửi bạn ${item.giftName || 'một món quà'}`,
              })
              browserNotification.onclick = () => window.focus()
            }
          }
        }
      } catch {
        // Notification refresh is best-effort; the existing notification badge remains available.
      } finally {
        refreshing = false
      }
    }
    const interval = window.setInterval(() => { void refreshNotifications() }, 3_000)
    window.addEventListener('focus', refreshNotifications)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshNotifications)
    }
  }, [notificationsReady, user])

  async function loadData(nextUser: ApiUser) {
    setUser(nextUser)
    setError('')
    try {
      const [nextProfile, nextEntries, nextConnection, initialNotifications] = await Promise.all([
        api.profile(),
        api.entries(),
        api.connections(),
        api.notifications(),
      ])
      let nextLoveLevel: ApiLoveLevel | null = null
      let nextNotifications = initialNotifications
      if (nextConnection.relationship) {
        try {
          nextLoveLevel = await api.loveLevel()
          nextNotifications = await api.notifications()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Không thể tải Love Level.')
        }
      }
      let unopenedGiftNotifications: ApiNotification[] = []
      if (nextUser.role !== 'admin') {
        try {
          const unopenedGiftIds = new Set((await api.receivedGifts()).filter((gift) => !gift.openedAt).map((gift) => gift.id))
          unopenedGiftNotifications = nextNotifications.filter((item) =>
            item.type === 'gift_received' && !item.readAt && unopenedGiftIds.has(item.id),
          )
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra quà chưa mở.')
        }
      }
      setProfile(nextProfile)
      setEntries(nextEntries)
      setConnection(nextConnection)
      setNotifications(nextNotifications)
      knownNotificationIds.current = new Set(nextNotifications.map((item) => item.id))
      setGiftNotificationQueue(unopenedGiftNotifications)
      setNotificationsReady(true)
      setLoveLevel(nextLoveLevel)
      lastLoveLevelSync.current = Date.now()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu tài khoản.')
      throw cause
    }
  }

  useEffect(() => {
    let active = true
    api.currentUser()
      .then(async (nextUser) => {
        if (active) await loadData(nextUser)
      })
      .catch((cause: unknown) => {
        if (!active || cause instanceof ApiError && cause.status === 401) return
        setError(cause instanceof Error ? cause.message : 'Không thể kết nối máy chủ.')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user || !relationshipIdForLevelRefresh) return
    let active = true
    const refreshLevel = async () => {
      if (Date.now() - lastLoveLevelSync.current < 60_000) return
      try {
        const result = await api.loveLevel()
        if (active) {
          setLoveLevel(result)
          lastLoveLevelSync.current = Date.now()
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể cập nhật Love Level.')
      }
    }
    let lastLocalDate = localDateValue(new Date())
    const timer = window.setInterval(() => {
      const currentLocalDate = localDateValue(new Date())
      if (currentLocalDate !== lastLocalDate) {
        lastLocalDate = currentLocalDate
        setToday(new Date())
        lastLoveLevelSync.current = 0
        void refreshLevel()
      }
    }, 60_000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshLevel()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [user, relationshipIdForLevelRefresh])

  async function refresh() {
    if (!user) return
    await loadData(user)
  }

  async function refreshConnections() {
    setRefreshingConnections(true)
    try {
      const [nextConnection, nextNotifications] = await Promise.all([
        api.connections(),
        api.notifications(),
      ])
      setConnection(nextConnection)
      setNotifications(nextNotifications)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải lời mời kết nối.')
    } finally {
      setRefreshingConnections(false)
    }
  }

  useEffect(() => {
    if (!user) return
    let active = true
    let refreshing = false
    const syncIncomingInvitations = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const [nextConnection, nextNotifications] = await Promise.all([
          api.connections(),
          api.notifications(),
        ])
        if (active) {
          setConnection(nextConnection)
          setNotifications(nextNotifications)
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải lời mời kết nối.')
      } finally {
        refreshing = false
      }
    }
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncIncomingInvitations()
    }
    const interval = window.setInterval(syncWhenVisible, 10_000)
    window.addEventListener('focus', syncWhenVisible)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', syncWhenVisible)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [user])

  function openEntryEditor(entry: ApiEntry) {
    setEntryImageError('')
    setEntryImageBusy(false)
    setRemoveEntryImage(false)
    setEntryImagePreview(entry.image ?? '')
    setEntryImageMediaId(entry.imageMediaId ?? null)
    setEditing(entry)
  }

  function closeEntryEditor() {
    setEditing(null)
    setEntryImagePreview('')
    setEntryImageMediaId(null)
    setEntryImageError('')
    setEntryImageBusy(false)
    setRemoveEntryImage(false)
  }

  async function chooseEntryImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !editing) return
    setEntryImageBusy(true)
    setEntryImageError('')
    try {
      const dataUrl = await optimizeImage(file)
      const category = editing.type === 'journal' ? 'entry_journal' : editing.type === 'letter' ? 'entry_letter' : 'entry_memory'
      const uploaded = await api.uploadMedia({
        category,
        dataUrl,
        ...(entryImageMediaId ? { replaceMediaId: entryImageMediaId } : {}),
      })
      setEntryImagePreview(uploaded.media.url ?? dataUrl)
      setEntryImageMediaId(uploaded.media.id)
      setRemoveEntryImage(false)
    } catch (cause) {
      setEntryImageError(cause instanceof Error ? cause.message : 'Không thể tải ảnh lên.')
    } finally {
      setEntryImageBusy(false)
    }
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || entryImageBusy || !['journal', 'memory', 'letter'].includes(page)) return
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const value = {
      title: String(form.get('title') ?? '').trim(),
      date: String(form.get('date') ?? ''),
      text: String(form.get('text') ?? '').trim(),
      ...(removeEntryImage
        ? { imageMediaId: null as string | null }
        : entryImageMediaId
          ? { imageMediaId: entryImageMediaId }
          : {}),
    }
    try {
      if (editing?.id) await api.updateEntry(editing.id, value)
      else await api.createEntry({ ...value, type: editing?.type ?? page as EntryType })
      closeEntryEditor()
      setNotice('Đã lưu vào tài khoản của bạn.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu nội dung.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteEntry(entry: ApiEntry) {
    if (!window.confirm(`Xóa “${entry.title}” khỏi tài khoản của bạn?`)) return
    try {
      await api.deleteEntry(entry.id)
      setEntries((items) => items.filter((item) => item.id !== entry.id))
      setNotice('Đã xóa nội dung.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xóa nội dung.')
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const updated = await api.updateProfile({
        displayName: String(form.get('displayName') ?? '').trim(),
        bio: String(form.get('bio') ?? '').trim(),
      })
      setProfile(updated)
      setUser(updated)
      setPage('profile')
      setNotice('Đã lưu hồ sơ.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ.')
    }
  }

  function openQuickAction(action: typeof quickActions[number]) {
    setPage(action.page)
    if (action.entryType) {
      openEntryEditor({ id: '', type: action.entryType, title: '', date: localDateValue(today), text: '', createdAt: '', updatedAt: '' })
    }
  }

  function togglePinnedQuickAction(id: QuickActionId) {
    const nextPinned = pinDraft.includes(id) ? pinDraft.filter((item) => item !== id) : [...pinDraft, id]
    if (nextPinned.length > quickActions.length) {
      setError(`Bạn chỉ có thể ghim tối đa ${quickActions.length} lối tắt.`)
      return
    }
    setError('')
    setPinDraft(nextPinned)
  }

  async function savePinnedQuickActions() {
    if (!profile || savingPins || pinDraft.length < 1 || pinDraft.length > quickActions.length) return
    setSavingPins(true)
    setError('')
    try {
      const updated = await api.updateProfile({ pinnedQuickActions: pinDraft })
      setProfile(updated)
      setNotice('Đã lưu lối tắt đã ghim.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật lối tắt đã ghim.')
    } finally {
      setSavingPins(false)
    }
  }

  async function searchAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFoundAccount(null)
    try {
      const result = await api.searchAccount(query)
      setFoundAccount(result.account)
      setRelationshipStart(profile?.relationshipStart ?? '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tìm tài khoản.')
    }
  }

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!foundAccount || !relationshipStart || busy) return
    setBusy(true)
    setError('')
    try {
      await api.sendInvitation(foundAccount.publicId, '', relationshipStart)
      setFoundAccount(null)
      setNotice('Đã gửi lời mời kết nối.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi lời mời.')
    } finally {
      setBusy(false)
    }
  }

  async function sendChatMessage(text: string) {
    if (!connection.relationship || !text.trim() || sendingChat) return false
    setSendingChat(true)
    try {
      const result = await api.sendChatMessage(text)
      const relationshipId = connection.relationship.id
      setChatData((current) => {
        const messages = current?.relationshipId === relationshipId ? current.messages : []
        return {
          relationshipId,
          messages: messages.some((message) => message.id === result.message.id) ? messages : [...messages, result.message],
          partnerTyping: current?.relationshipId === relationshipId ? current.partnerTyping : false,
        }
      })
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi tin nhắn.')
      return false
    } finally {
      setSendingChat(false)
    }
  }

  async function markChatMessagesRead() {
    const relationshipId = connection.relationship?.id
    if (!relationshipId) return
    try {
      const result = await api.markChatMessagesRead()
      setChatData((current) => {
        const latestMessages = current?.relationshipId === relationshipId ? current.messages : []
        return {
          relationshipId,
          messages: latestMessages.map((message) => message.sender === 'partner' && !message.readAt && result.readAt
            ? { ...message, readAt: result.readAt }
            : message),
          partnerTyping: current?.relationshipId === relationshipId ? current.partnerTyping : false,
        }
      })
      setNotifications(await api.notifications())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái đã đọc.')
    }
  }

  async function updateChatTyping(typing: boolean) {
    if (!connection.relationship) return
    try {
      await api.setChatTyping(typing)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái nhập tin nhắn.')
    }
  }

  async function respondToInvitation(id: string, action: 'accept' | 'reject' | 'cancel') {
    try {
      await api.respondToInvitation(id, action)
      setNotice(action === 'accept' ? 'Đã chấp nhận lời mời.' : action === 'reject' ? 'Đã từ chối lời mời.' : 'Đã hủy lời mời.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật lời mời.')
    }
  }

  async function markAllRead() {
    try {
      const unreadActivityNotifications = notifications.filter((item) =>
        !item.readAt && (
          item.type === 'chat_message' ||
          item.type === 'gift_received' ||
          item.type === 'couple_invitation' && connection.received.some((invitation) => invitation.id === item.invitationId)
        ),
      )
      const updatedNotifications = await Promise.all(unreadActivityNotifications.map(async (item) => ({
        id: item.id,
        readAt: (await api.markNotificationRead(item.id)).readAt,
      })))
      setNotifications((items) => items.map((item) => {
        const updated = updatedNotifications.find((notification) => notification.id === item.id)
        return updated ? { ...item, readAt: updated.readAt } : item
      }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật thông báo.')
    }
  }

  async function markGiftNotificationRead(id: string) {
    try {
      const result = await api.markNotificationRead(id)
      setNotifications((items) => items.map((item) => item.id === result.id ? { ...item, readAt: result.readAt } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái thông báo.')
    }
  }

  async function openIncomingGift(notification: ApiNotification) {
    if (openingIncomingGiftId) return
    setOpeningIncomingGiftId(notification.id)
    setError('')
    try {
      const result = await api.openReceivedGift(notification.id)
      setOpenedIncomingGift(result.gift)
      setGiftNotificationQueue((queue) => queue.filter((item) => item.id !== notification.id))
      await markGiftNotificationRead(notification.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể mở quà.')
    } finally {
      setOpeningIncomingGiftId('')
    }
  }

  async function logout() {
    try {
      await api.logout()
      setUser(null)
      setProfile(null)
      setEntries([])
      setNotifications([])
      setGiftNotificationQueue([])
      setOpenedIncomingGift(null)
      setOpeningIncomingGiftId('')
      setNotificationsReady(false)
      knownNotificationIds.current.clear()
      setChatData(null)
      setConnection({ relationship: null, received: [], sent: [] })
      setLoveLevel(null)
      setNotice('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất.')
    }
  }

  if (loading) return <main className="core-loading">Đang kết nối LoveForYou...</main>
  if (!user && page === 'terms') return <main className="core-shell"><section className="core-content"><TermsPage onBack={() => navigate(authPaths.register)} backLabel="Quay lại đăng ký" /></section></main>
  if (!user && page === 'privacy-policy') return <main className="core-shell"><section className="core-content"><PrivacyPolicyPage onBack={() => navigate(authPaths.register)} backLabel="Quay lại đăng ký" /></section></main>
  if (!user) return <AuthGate mode={authMode ?? 'login'} onAuthenticated={loadData} initialError={error} onModeChange={(nextMode) => navigate(authPaths[nextMode])} />

  const isAdminUser = user?.role === 'admin'

  if (isAdminPage(page)) {
    if (!isAdminUser) {
      return (
        <main className="core-shell admin-denied-shell">
          <section className="core-content admin-denied-content">
            <div className="admin-denied-card">
              <div className="admin-denied-icon" aria-hidden="true">
                <Crown size={28} />
              </div>
              <span className="admin-denied-badge">Quyền truy cập</span>
              <h1>Bạn không có quyền truy cập khu vực quản trị.</h1>
              <p>
                Tài khoản hiện tại chưa được cấp quyền quản trị. Nếu bạn tin đây là sự nhầm lẫn,
                hãy liên hệ người quản lý hệ thống hoặc đăng nhập bằng tài khoản admin.
              </p>
              <div className="admin-denied-actions">
                <button type="button" className="core-primary" onClick={() => setPage('home')}>
                  <House size={16} />
                  Về trang chủ
                </button>
                <button type="button" className="core-secondary" onClick={() => setPage('profile')}>
                  <UserRound size={16} />
                  Hồ sơ của tôi
                </button>
              </div>
            </div>
          </section>
        </main>
      )
    }
    if (page === 'admin') return <AdminDashboardPage onNavigate={setPage} />
    if (page === 'admin-users') return <UserManagementPage onNavigate={setPage} />
    if (page === 'admin-transactions') return <AdminTransactionsPage onNavigate={setPage} />
    if (page === 'admin-couples') return <AdminCouplesPage onNavigate={setPage} />
    if (page === 'admin-content') return <AdminContentPage onNavigate={setPage} />
    if (page === 'admin-messages') return <AdminMessagesPage onNavigate={setPage} />
    if (page === 'admin-notifications') return <AdminNotificationsPage onNavigate={setPage} />
    if (page === 'admin-premium') return <AdminPremiumPage onNavigate={setPage} />
    if (page === 'admin-wallet') return <AdminWalletPage onNavigate={setPage} />
    if (page === 'admin-deposits') return <AdminDepositsPage onNavigate={setPage} />
    if (page === 'admin-payment-qr') return <AdminPaymentQrPage onNavigate={setPage} />
    if (page === 'admin-topup-packages') return <AdminTopupPackagesPage onNavigate={setPage} />
    if (page === 'admin-withdrawals') return <AdminWithdrawalsPage onNavigate={setPage} />
    if (page === 'admin-store') return <AdminStorePage onNavigate={setPage} />
    if (page === 'admin-gifts') return <AdminGiftsPage onNavigate={setPage} />
    if (page === 'admin-items') return <AdminItemsPage onNavigate={setPage} />
    if (page === 'admin-promotions') return <AdminPromotionsPage onNavigate={setPage} />
    if (page === 'admin-support') return <AdminSupportPage onNavigate={setPage} />
    if (page === 'admin-security') return <AdminSecurityPage onNavigate={setPage} />
    if (page === 'admin-audit-log') return <AdminAuditLogPage onNavigate={setPage} />
    if (page === 'admin-reports') return <AdminReportsPage onNavigate={setPage} />
    if (page === 'admin-roles') return <AdminRolesPage onNavigate={setPage} />
    if (page === 'admin-system') return <AdminSystemPage onNavigate={setPage} />
    if (page === 'admin-backups') return <AdminBackupsPage onNavigate={setPage} />
    if (page === 'admin-help') return <AdminHelpPage onNavigate={setPage} />
    if (page === 'admin-account') return <AdminAccountPage onNavigate={setPage} />
  }

  const visibleEntries = entries.filter((entry) => entry.type === page)
  const invitationActivityItems = connection.received
    .map((invitation) => {
      const notification = notifications.find((item) => item.invitationId === invitation.id)
      return {
        id: notification?.id ?? `invitation:${invitation.id}`,
        type: 'couple_invitation' as const,
        createdAt: invitation.createdAt,
        readAt: notification?.readAt ?? '',
        actorName: invitation.displayName,
        invitation,
      }
    })
  const chatActivityItems = notifications
    .filter((item) => item.type === 'chat_message' && !item.readAt)
    .map((item) => ({
      id: item.id,
      type: 'chat_message' as const,
      createdAt: item.createdAt,
      readAt: item.readAt,
      actorName: item.actorName,
      message: item.message ?? '',
    }))
  const giftActivityItems = notifications
    .filter((item) => item.type === 'gift_received')
    .map((item) => ({
      id: item.id,
      type: 'gift_received' as const,
      createdAt: item.createdAt,
      readAt: item.readAt,
      actorName: item.actorName,
      giftName: item.giftName ?? 'một món quà',
      message: item.message ?? '',
    }))
  const activityItems = [...invitationActivityItems, ...chatActivityItems, ...giftActivityItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  const unreadCount = activityItems.filter((item) => !item.readAt).length
  const incomingGiftNotification = openedIncomingGift ? null : giftNotificationQueue[0] ?? null
  const openedGiftItem = openedIncomingGift ? giftItems.find((item) => item.id === openedIncomingGift.giftId) : null
  const chatUnreadCount = chatActivityItems.filter((item) => !item.readAt).length
  const recentMemories = entries.filter((entry) => entry.type === 'memory').slice(0, 4)
  const pinnedQuickActions = (profile?.pinnedQuickActions ?? DEFAULT_PINNED_QUICK_ACTIONS)
    .filter((id): id is QuickActionId => quickActions.some((action) => action.id === id))
    .slice(0, 4)
  const connectedSince = connection.relationship ? profile?.relationshipStart ?? '' : ''
  const upcomingCelebrationList = [
    nextBirthday(profile?.dateOfBirth ?? '', user.displayName, today),
    ...(connection.relationship ? [
      nextBirthday(connection.relationship.dateOfBirth, connection.relationship.displayName, today),
      nextAnniversary(connectedSince, today),
    ] : []),
  ]
    .filter((item): item is UpcomingCelebration => item !== null)
    .sort((left, right) => left.days - right.days)
  const upcomingCelebration = upcomingCelebrationList[0] ?? null
  const daysTogether = dayCountFrom(connectedSince, today)
  const LevelIcon = loveLevel?.currentLevel.icon === 'crown'
    ? Crown
    : loveLevel?.currentLevel.icon === 'flower'
      ? Flower2
      : loveLevel?.currentLevel.icon === 'sparkles'
        ? Sparkles
        : Heart
  const profileActivityItems = [
    ...entries.map((entry) => ({
      id: `entry:${entry.id}`,
      createdAt: entry.updatedAt || entry.createdAt,
      title: entry.type === 'memory' ? 'Đã lưu một kỷ niệm' : entry.type === 'letter' ? 'Đã viết một lá thư' : 'Đã viết nhật ký',
      description: entry.title,
      icon: entry.type === 'memory' ? ImageIcon : entry.type === 'letter' ? Mail : BookOpen,
      page: entry.type,
    })),
    ...notifications.map((item) => ({
      id: `notification:${item.id}`,
      createdAt: item.createdAt,
      title: item.type === 'gift_received' ? `Nhận được ${item.giftName || 'một món quà'}` : item.type === 'couple_invitation' ? 'Nhận được lời mời kết nối' : item.type === 'couple_invitation_accepted' ? 'Lời mời kết nối được chấp nhận' : item.type === 'couple_connected' ? 'Hai bạn đã kết nối' : 'Thông báo mới',
      description: item.actorName || 'LoveForYou',
      icon: HeartHandshake,
      page: 'activities' as const,
    })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 4)

  return (
    <main className="core-shell">
      {page !== 'profile' && <header className="core-header">
        <button className="core-brand" onClick={() => setPage('home')} aria-label="Về trang chủ">
          <span className="core-brand-mark"><Heart size={23} fill="currentColor" /></span>
          <span><strong>LoveForYou</strong><small>Cùng nhau, đi xa hơn</small></span>
        </button>
        <div className="core-header-actions">
          <button className="core-icon-button notification-button" onClick={() => setPage('activities')} aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}>
            <Bell size={21} />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button className="core-avatar" onClick={() => setPage('profile')} aria-label="Mở hồ sơ">{initials(user.displayName)}</button>
        </div>
      </header>}

      <section className="core-content">
        {page !== 'chat' && !['home', 'activities', 'memory', 'wallet', 'profile', 'settings', 'journey', 'terms', 'privacy-policy'].includes(page) && <button type="button" className="core-back-button" onClick={() => goBack(pageForBackFallback(page))} aria-label="Quay lại trang trước" title="Quay lại"><ArrowLeft size={18} /></button>}
        {error && <p className="core-error" role="alert">{error}{user && !profile && <button className="core-secondary" onClick={() => { void refresh().catch(() => undefined) }}>Thử tải lại</button>}</p>}
        {notice && <p className="core-notice" role="status">{notice}</p>}
        {incomingGiftNotification && <div className="gift-global-notification" role="presentation">
          <section className="gift-global-notification-card" role="dialog" aria-modal="true" aria-labelledby="gift-global-notification-title">
            <button type="button" className="gift-global-notification-close" aria-label="Đóng thông báo" onClick={() => {
              void markGiftNotificationRead(incomingGiftNotification.id)
              setGiftNotificationQueue((queue) => queue.slice(1))
            }} disabled={Boolean(openingIncomingGiftId)}>×</button>
            <span className="gift-global-notification-icon"><Gift size={34} /></span>
            <p>MÓN QUÀ MỚI</p>
            <h2 id="gift-global-notification-title">{incomingGiftNotification.actorName || 'Người thương'} gửi bạn {incomingGiftNotification.giftName || 'một món quà'}</h2>
            {incomingGiftNotification.message && <blockquote>“{incomingGiftNotification.message}”</blockquote>}
            <button type="button" className="gift-global-notification-open" disabled={Boolean(openingIncomingGiftId)} onClick={() => void openIncomingGift(incomingGiftNotification)}>
              {openingIncomingGiftId === incomingGiftNotification.id ? 'Đang mở...' : <>Mở quà ngay <Heart size={16} fill="currentColor" /></>}
            </button>
          </section>
        </div>}
        {openedIncomingGift && <div className="gift-reveal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenedIncomingGift(null) }}>
          <section className="gift-reveal-dialog" role="dialog" aria-modal="true" aria-labelledby="incoming-gift-title">
            <button type="button" className="gift-reveal-close" onClick={() => setOpenedIncomingGift(null)} aria-label="Đóng">×</button>
            <span className="gift-reveal-spark gift-reveal-spark-one">♥</span><span className="gift-reveal-spark gift-reveal-spark-two">✦</span><span className="gift-reveal-spark gift-reveal-spark-three">♥</span>
            <div className="gift-reveal-stage">
              <span className="gift-reveal-burst" aria-hidden="true"><i>♥</i><i>✦</i><i>♥</i><i>✧</i><i>·</i><i>♥</i><i>✦</i><i>·</i></span>
              <span className={`gift-reveal-art gift-art-${openedGiftItem?.category ?? 'special'}`}>
                {openedGiftItem?.art ?? '🎁'}
              </span>
            </div>
            <p>{openedIncomingGift.senderName} gửi tặng bạn</p>
            <h2 id="incoming-gift-title">{openedIncomingGift.giftName}</h2>
            {openedIncomingGift.message && <blockquote>“{openedIncomingGift.message}”</blockquote>}
            <button type="button" className="gift-reveal-confirm" onClick={() => setOpenedIncomingGift(null)}>Đóng · Đổi quà sau <Heart size={15} fill="currentColor" /></button>
          </section>
        </div>}

        {page === 'home' && <HomePage
          today={today}
          user={user}
          connection={connection}
          daysTogether={daysTogether}
          connectedSince={connectedSince}
          upcomingCelebration={upcomingCelebration}
          pinnedQuickActions={pinnedQuickActions}
          chatUnreadCount={chatUnreadCount}
          quickActions={quickActions}
          recentMemories={recentMemories}
          initials={initials}
          greeting={greeting}
          onNavigate={setPage}
          onManageShortcuts={() => { setPinDraft(pinnedQuickActions); setPage('shortcuts') }}
          onOpenQuickAction={openQuickAction}
          onCreateMemory={() => { setPage('memory'); openEntryEditor({ id: '', type: 'memory', title: '', date: new Date().toISOString().slice(0, 10), text: '', createdAt: '', updatedAt: '' }) }}
        />}

        {page === 'journey' && profile && <JourneyPage
          profile={profile}
          connection={connection}
          entries={entries}
          loveLevel={loveLevel}
          connectedSince={connectedSince}
          daysTogether={daysTogether}
          initials={initials}
          onBack={() => goBack('home')}
          onNavigate={setPage}
          onCreateMemory={() => { setPage('memory'); openEntryEditor({ id: '', type: 'memory', title: '', date: new Date().toISOString().slice(0, 10), text: '', createdAt: '', updatedAt: '' }) }}
        />}

        {(page === 'activities' || page === 'notifications') && <ActivityFeedPage
          items={activityItems}
          today={today}
          unreadCount={unreadCount}
          initials={initials}
          relativeTime={relativeActivityTime}
          onMarkAllRead={() => void markAllRead()}
          onRespondToInvitation={(id, action) => void respondToInvitation(id, action)}
          onOpenChat={() => setPage('chat')}
        />}

        {page !== 'home' && page !== 'activities' && page !== 'notifications' && <>
          {page !== 'profile' && page !== 'journey' && page !== 'chat' && page !== 'wallet' && page !== 'gifts' && <div className="core-page-heading">
            <div><p className="core-eyebrow">{page === 'connections' ? 'KẾT NỐI CÓ SỰ ĐỒNG Ý' : page === 'events' ? 'NGÀY ĐẶC BIỆT CỦA HAI BẠN' : developmentDescriptions[page] ? 'TÍNH NĂNG MỚI' : 'MỘT GÓC RIÊNG CỦA BẠN'}</p>
              <h1>{pageLabels[page]}</h1>
            </div>
            {['journal', 'memory', 'letter'].includes(page) && <button className="core-primary core-heading-button" onClick={() => openEntryEditor({ id: '', type: page as EntryType, title: '', date: new Date().toISOString().slice(0, 10), text: '', createdAt: '', updatedAt: '' })}>Viết mới</button>}
          </div>}

          {page === 'wallet' && <WalletPage onNavigate={setPage} />}
          {page === 'wallet-history' && <WalletHistoryPage />}
          {page === 'gifts' && <GiftsPage onNavigate={setPage} />}

          {developmentDescriptions[page] && page !== 'wallet' && <FeaturePlaceholderPage page={page} title={pageLabels[page]} description={developmentDescriptions[page]} />}

          {page === 'events' && <EventsPage celebrations={upcomingCelebrationList} />}

          {page === 'shortcuts' && <ShortcutsPage
            actions={quickActions}
            pinDraft={pinDraft}
            saving={savingPins}
            onOpen={openQuickAction}
            onToggle={togglePinnedQuickAction}
            onSave={() => void savePinnedQuickActions()}
          />}

          {page === 'chat' && <ChatPage
            connection={connection}
            messages={chatMessages}
            partnerTyping={chatPartnerTyping}
            loading={loadingChat}
            sending={sendingChat}
            onExit={() => goBack('home')}
            onMarkRead={() => { void markChatMessagesRead() }}
            onNavigate={setPage}
            onSend={sendChatMessage}
            onTypingStatus={(typing) => void updateChatTyping(typing)}
          />}

          {(['journal', 'memory', 'letter'] as Page[]).includes(page) && <EntriesPage
            entries={visibleEntries}
            onEdit={openEntryEditor}
            onDelete={(entry) => void deleteEntry(entry)}
          />}

          {page === 'profile' && profile && <ProfilePage
            profile={profile}
            connection={connection}
            loveLevel={loveLevel}
            unreadCount={unreadCount}
            daysTogether={daysTogether}
            connectedSince={connectedSince}
            activityItems={profileActivityItems}
            today={today}
            initials={initials}
            relativeTime={relativeActivityTime}
            onNavigate={setPage}
          />}

          {page === 'love-level' && profile && <LoveLevelPage
            profile={profile}
            loveLevel={loveLevel}
            LevelIcon={LevelIcon}
          />}

          {page === 'profile-edit' && profile && <ProfileEditPage
            profile={profile}
            onSubmit={saveProfile}
            onCancel={() => setPage('profile')}
          />}

          {page === 'settings' && profile && <SettingsPage
            profile={profile}
            connection={connection}
            initials={initials}
            onNavigate={setPage}
            onLogout={() => void logout()}
            onNotice={setNotice}
          />}

          {page === 'premium' && <PremiumPage onNotice={setNotice} />}

          {page === 'terms' && <TermsPage onBack={() => setPage('settings')} />}
          {page === 'privacy-policy' && <PrivacyPolicyPage onBack={() => setPage('settings')} />}

          {page === 'connections' && <ConnectionsPage
            connection={connection}
            refreshing={refreshingConnections}
            query={query}
            setQuery={setQuery}
            foundAccount={foundAccount}
            relationshipStart={relationshipStart}
            setRelationshipStart={setRelationshipStart}
            maxRelationshipStart={maxRelationshipStart}
            busy={busy}
            onRefresh={() => void refreshConnections()}
            onSearch={searchAccount}
            onSendInvitation={sendInvitation}
            onRespondToInvitation={(id, action) => void respondToInvitation(id, action)}
          />}

        </>}
      </section>

      <nav className="mobile-tabbar" aria-label="Điều hướng chính">
        {navItems.map(({ page: item, label, icon: Icon }) => {
          const active = page === item || item === 'profile' && (page === 'settings' || page === 'profile-edit')
          return <button key={item} className={active ? 'active' : ''} onClick={() => setPage(item)} aria-current={active ? 'page' : undefined}>
          <Icon size={21} strokeWidth={active ? 2.5 : 1.9} /><span>{label}</span>{developmentDescriptions[item] && <small>Đang phát triển</small>}
        </button>})}
      </nav>

      {editing && <div className="core-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEntryEditor() }}>
        <form className="core-modal core-form" onSubmit={saveEntry}>
          <h2>{editing.id ? 'Sửa nội dung' : `Tạo ${pageLabels[editing.type].toLocaleLowerCase('vi')}`}</h2>
          <label>Tiêu đề<input name="title" defaultValue={editing.title} maxLength={72} required /></label>
          <label>Ngày<input name="date" type="date" defaultValue={editing.date} required /></label>
          <label>Nội dung<textarea name="text" defaultValue={editing.text} maxLength={2000} rows={7} required /></label>
          <div className="entry-image-field">
            <span className="entry-image-label">Ảnh đính kèm</span>
            {entryImagePreview && !removeEntryImage ? (
              <div className="entry-image-preview">
                <img src={entryImagePreview} alt="Xem trước ảnh đính kèm" />
                <div className="entry-image-preview-actions">
                  <button type="button" className="core-secondary" disabled={busy || entryImageBusy} onClick={() => entryImageInputRef.current?.click()}>
                    {entryImageBusy ? 'Đang tải…' : 'Đổi ảnh'}
                  </button>
                  <button type="button" className="core-secondary" disabled={busy || entryImageBusy} onClick={() => { setRemoveEntryImage(true); setEntryImagePreview(''); setEntryImageMediaId(null) }} aria-label="Xóa ảnh">
                    <X size={16} /> Xóa ảnh
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="entry-image-picker" disabled={busy || entryImageBusy} onClick={() => entryImageInputRef.current?.click()}>
                <ImagePlus size={20} />
                <strong>{entryImageBusy ? 'Đang tải ảnh lên…' : 'Chọn ảnh từ thiết bị'}</strong>
                <span>JPEG, PNG hoặc WebP · tối ưu trước khi lưu</span>
              </button>
            )}
            <input ref={entryImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void chooseEntryImage(event)} />
            {entryImageError && <p className="core-error" role="alert">{entryImageError}</p>}
          </div>
          <div className="core-modal-actions">
            <button type="button" className="core-secondary" onClick={closeEntryEditor}>Hủy</button>
            <button className="core-primary" disabled={busy || entryImageBusy}>{busy ? 'Đang lưu...' : entryImageBusy ? 'Đang tải ảnh...' : 'Lưu'}</button>
          </div>
        </form>
      </div>}
    </main>
  )
}

export default CoreApp
