export type Page = 'home' | 'activities' | 'journey' | 'shortcuts' | 'journal' | 'memory' | 'letter' | 'profile' | 'profile-edit' | 'settings' | 'love-level' | 'terms' | 'privacy-policy' | 'premium' | 'chat' | 'connections' | 'notifications' | 'events' | 'gifts' | 'wallet' | 'wallet-history' | 'privacy' | 'questions' | 'admin' | 'admin-users' | 'admin-couples' | 'admin-content' | 'admin-messages' | 'admin-notifications' | 'admin-premium' | 'admin-wallet' | 'admin-deposits' | 'admin-payment-qr' | 'admin-topup-packages' | 'admin-withdrawals' | 'admin-transactions' | 'admin-store' | 'admin-gifts' | 'admin-items' | 'admin-promotions' | 'admin-support' | 'admin-security' | 'admin-audit-log' | 'admin-reports' | 'admin-roles' | 'admin-system' | 'admin-backups' | 'admin-help' | 'admin-account'
export type AuthMode = 'login' | 'register'

export const authPaths: Record<AuthMode, string> = {
  login: '/login',
  register: '/register',
}

export const pagePaths: Record<Page, string> = {
  home: '/',
  activities: '/activities',
  journey: '/journey',
  shortcuts: '/shortcuts',
  journal: '/journal',
  memory: '/memories',
  letter: '/letters',
  profile: '/profile',
  'profile-edit': '/profile/edit',
  settings: '/settings',
  'love-level': '/love-level',
  terms: '/terms',
  'privacy-policy': '/privacy-policy',
  premium: '/premium',
  chat: '/chat',
  connections: '/connections',
  notifications: '/notifications',
  events: '/events',
  gifts: '/gifts',
  wallet: '/wallet',
  'wallet-history': '/wallet/history',
  privacy: '/private-room',
  questions: '/questions',
  admin: '/admin',
  'admin-users': '/admin/users',
  'admin-couples': '/admin/couples',
  'admin-content': '/admin/content',
  'admin-messages': '/admin/messages',
  'admin-notifications': '/admin/notifications',
  'admin-premium': '/admin/premium',
  'admin-wallet': '/admin/wallet',
  'admin-deposits': '/admin/deposits',
  'admin-payment-qr': '/admin/payment-qr',
  'admin-topup-packages': '/admin/topup-packages',
  'admin-withdrawals': '/admin/withdrawals',
  'admin-transactions': '/admin/transactions',
  'admin-store': '/admin/store',
  'admin-gifts': '/admin/gifts',
  'admin-items': '/admin/items',
  'admin-promotions': '/admin/promotions',
  'admin-support': '/admin/support',
  'admin-security': '/admin/security',
  'admin-audit-log': '/admin/audit-log',
  'admin-reports': '/admin/reports',
  'admin-roles': '/admin/roles',
  'admin-system': '/admin/system',
  'admin-backups': '/admin/backups',
  'admin-help': '/admin/help',
  'admin-account': '/admin/account',
}

export function isAdminPage(page: Page) {
  return page === 'admin' || page.startsWith('admin-')
}

export function landingPathForRole(role: 'admin' | 'member') {
  return role === 'admin' ? pagePaths.admin : pagePaths.home
}

const pagesByPath = Object.fromEntries(
  Object.entries(pagePaths).map(([page, path]) => [path, page]),
) as Record<string, Page | undefined>

export function pageFromPath(pathname: string): Page {
  return pagesByPath[pathname] ?? 'home'
}

export function isKnownPagePath(pathname: string) {
  return pagesByPath[pathname] !== undefined
}

export function authModeFromPath(pathname: string): AuthMode | null {
  if (pathname === authPaths.login) return 'login'
  if (pathname === authPaths.register) return 'register'
  return null
}