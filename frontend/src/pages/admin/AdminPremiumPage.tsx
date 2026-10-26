import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminPremiumPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-premium" title="Quản lý Premium" onNavigate={onNavigate} />
}
