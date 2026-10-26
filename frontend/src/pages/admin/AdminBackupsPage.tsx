import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminBackupsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-backups" title="Quản lý dữ liệu và sao lưu" onNavigate={onNavigate} />
}
