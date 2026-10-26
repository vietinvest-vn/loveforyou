import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminSystemPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-system" title="Cấu hình hệ thống" onNavigate={onNavigate} />
}
