import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminGiftsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-gifts" title="Quản lý quà tặng" onNavigate={onNavigate} />
}
