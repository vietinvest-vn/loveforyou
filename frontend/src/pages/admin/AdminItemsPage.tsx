import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminItemsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-items" title="Quản lý xu và vật phẩm" onNavigate={onNavigate} />
}
