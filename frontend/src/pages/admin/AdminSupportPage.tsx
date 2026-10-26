import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminSupportPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-support" title="Hỗ trợ và khiếu nại" onNavigate={onNavigate} />
}
