import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminAuditLogPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-audit-log" title="Nhật ký quản trị" onNavigate={onNavigate} />
}
