import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminNotificationsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-notifications" title="Quản lý thông báo" onNavigate={onNavigate} />
}
