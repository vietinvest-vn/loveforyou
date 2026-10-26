import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminSecurityPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-security" title="Quản lý an ninh" onNavigate={onNavigate} />
}
