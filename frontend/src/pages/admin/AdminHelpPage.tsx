import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminHelpPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-help" title="Trợ giúp và tài liệu" onNavigate={onNavigate} />
}
