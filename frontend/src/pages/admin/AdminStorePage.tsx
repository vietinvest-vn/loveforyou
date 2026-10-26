import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminStorePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-store" title="Quản lý cửa hàng" onNavigate={onNavigate} />
}
