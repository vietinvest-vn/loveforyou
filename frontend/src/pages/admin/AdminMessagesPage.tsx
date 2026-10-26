import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

export default function AdminMessagesPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <AdminSectionPage page="admin-messages" title="Quản lý tin nhắn" onNavigate={onNavigate} />
}
