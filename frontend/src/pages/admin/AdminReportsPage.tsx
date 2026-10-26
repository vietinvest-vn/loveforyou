import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminReportsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-reports" title="Báo cáo và thống kê" onNavigate={onNavigate} />
}
