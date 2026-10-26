import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminContentPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-content" title="Quản lý nội dung" onNavigate={onNavigate} />
}
