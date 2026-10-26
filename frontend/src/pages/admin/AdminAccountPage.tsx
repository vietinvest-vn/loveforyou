import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminAccountPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-account" title="Tài khoản Admin của tôi" onNavigate={onNavigate} />
}
