import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminRolesPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-roles" title="Quản lý Admin và phân quyền" onNavigate={onNavigate} />
}
