import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminPromotionsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-promotions" title="Quản lý khuyến mãi" onNavigate={onNavigate} />
}
