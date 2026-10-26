import { Activity, Heart, House, Image as ImageIcon, UserRound, Wallet } from 'lucide-react'

export type Page = 'home' | 'activities' | 'journey' | 'journal' | 'memories' | 'letters' | 'profile' | 'connections' | 'notifications' | 'events' | 'bucket' | 'quotes' | 'gifts' | 'wallet' | 'coin-redemption' | 'coin-history' | 'coin-transaction' | 'help' | 'privacy' | 'settings' | 'premium'

export const navigation: { id: Page; label: string; icon: typeof Heart }[] = [
  { id: 'home', label: 'Trang ch?', icon: House },
  { id: 'activities', label: 'Ho?t d?ng', icon: Activity },
  { id: 'memories', label: 'K? ni?m', icon: ImageIcon },
  { id: 'wallet', label: 'Ví', icon: Wallet },
]

export const mobileNavigation = [...navigation, { id: 'profile' as const, label: 'Cá nhân', icon: UserRound }]

export const pageTitles: Record<Page, string> = {
  home: 'Không gian c?a hai b?n',
  activities: 'Ho?t d?ng chung',
  journey: 'Hành trình tình yêu',
  journal: 'Nh?t ký chung',
  memories: 'H?p k? ni?m',
  letters: 'Thu g?i nhau',
  premium: 'Free & Premium',
  profile: 'Cá nhân',
  connections: 'K?t n?i ngu?i thuong',
  notifications: 'Thông báo',
  events: 'S? ki?n & d?m ngu?c',
  bucket: 'Danh sách mong mu?n',
  quotes: 'Kho câu yêu thuong',
  gifts: 'Quà t?ng di?n t?',
  wallet: 'Ví',
  'coin-redemption': 'Quy d?i xu',
  'coin-history': 'L?ch s? giao d?ch',
  'coin-transaction': 'Chi ti?t giao d?ch',
  help: 'Tr? giúp & h? tr?',
  privacy: 'Quy?n riêng tu',
  settings: 'Cài d?t',
}

export const pageParents: Partial<Record<Page, Page>> = {
  activities: 'home',
  journey: 'home',
  journal: 'home',
  memories: 'home',
  letters: 'home',
  profile: 'home',
  connections: 'profile',
  notifications: 'home',
  events: 'home',
  bucket: 'home',
  quotes: 'home',
  gifts: 'home',
  wallet: 'gifts',
  'coin-redemption': 'wallet',
  'coin-history': 'wallet',
  'coin-transaction': 'coin-history',
  help: 'profile',
  privacy: 'settings',
  settings: 'profile',
  premium: 'profile',
}

export function isPage(value: unknown): value is Page {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(pageTitles, value)
}
