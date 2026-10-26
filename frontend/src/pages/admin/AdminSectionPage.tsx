import {
  Bell, BookOpen, CreditCard, Database, FileText, Gift, Heart, HelpCircle, LayoutGrid,
  MessageSquareText, Package, Percent, ShieldCheck, ShoppingBag, Sparkles, Users, WalletCards,
} from 'lucide-react'
import type { Page } from '../../routing'
import type { ComponentType, ReactNode } from 'react'
import { useAdminSidebarScroll } from '../../utils/adminSidebarScroll'

type AdminSectionPageProps = {
  page: Page
  title: string
  onNavigate: (page: Page) => void
  children?: ReactNode
}

const menuItems: { label: string; page: Page; icon: ComponentType<{ size?: number }> }[] = [
  { label: 'Tổng quan', page: 'admin', icon: LayoutGrid },
  { label: 'Quản lý người dùng', page: 'admin-users', icon: Users },
  { label: 'Quản lý cặp đôi', page: 'admin-couples', icon: Heart },
  { label: 'Quản lý nội dung', page: 'admin-content', icon: FileText },
  { label: 'Quản lý tin nhắn', page: 'admin-messages', icon: MessageSquareText },
  { label: 'Quản lý thông báo', page: 'admin-notifications', icon: Bell },
  { label: 'Quản lý Premium', page: 'admin-premium', icon: Sparkles },
  { label: 'Quản lý ví', page: 'admin-wallet', icon: WalletCards },
  { label: 'Quản lý nạp tiền', page: 'admin-deposits', icon: CreditCard },
  { label: 'Cấu hình thanh toán QR', page: 'admin-payment-qr', icon: CreditCard },
  { label: 'Quản lý gói nạp', page: 'admin-topup-packages', icon: Package },
  { label: 'Quản lý rút tiền', page: 'admin-withdrawals', icon: WalletCards },
  { label: 'Lịch sử giao dịch', page: 'admin-transactions', icon: WalletCards },
  { label: 'Quản lý cửa hàng', page: 'admin-store', icon: ShoppingBag },
  { label: 'Quản lý quà tặng', page: 'admin-gifts', icon: Gift },
  { label: 'Quản lý xu và vật phẩm', page: 'admin-items', icon: Sparkles },
  { label: 'Quản lý khuyến mãi', page: 'admin-promotions', icon: Percent },
  { label: 'Hỗ trợ và khiếu nại', page: 'admin-support', icon: HelpCircle },
  { label: 'Quản lý an ninh', page: 'admin-security', icon: ShieldCheck },
  { label: 'Nhật ký quản trị', page: 'admin-audit-log', icon: FileText },
  { label: 'Báo cáo và thống kê', page: 'admin-reports', icon: LayoutGrid },
  { label: 'Quản lý Admin và phân quyền', page: 'admin-roles', icon: Users },
  { label: 'Cấu hình hệ thống', page: 'admin-system', icon: ShieldCheck },
  { label: 'Quản lý dữ liệu và sao lưu', page: 'admin-backups', icon: Database },
  { label: 'Trợ giúp và tài liệu', page: 'admin-help', icon: BookOpen },
  { label: 'Tài khoản Admin của tôi', page: 'admin-account', icon: Users },
]

export default function AdminSectionPage({ page, title, onNavigate, children }: AdminSectionPageProps) {
  const { sidebarRef, rememberScroll, handleScroll } = useAdminSidebarScroll()
  return (
    <div className="admin-dashboard">
      <aside ref={sidebarRef} className="admin-sidebar" onScroll={handleScroll}>
        <div className="admin-brand">
          <span className="admin-brand-mark"><Heart size={22} fill="currentColor" /></span>
          <span className="admin-brand-text">
            <strong>LoveForYou</strong>
            <small>Kết nối yêu thương</small>
          </span>
        </div>
        <nav className="admin-nav" aria-label="Menu điều hành">
          {menuItems.map(({ label, page: targetPage, icon: Icon }) => (
            <button
              key={targetPage}
              type="button"
              className={`admin-nav-item ${page === targetPage ? 'active' : ''}`}
              aria-current={page === targetPage ? 'page' : undefined}
              onClick={() => { rememberScroll(); onNavigate(targetPage) }}
            >
              <span className="admin-nav-icon"><Icon size={18} /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="admin-main-panel">
        <header className="admin-topbar">
          <div>
            <p className="page-kicker">QUẢN TRỊ LOVEFORYOU</p>
            <h1>{title}</h1>
          </div>
        </header>
        {children ?? (
          <section className="admin-section-placeholder" aria-live="polite">
            <h2>{title}</h2>
            <p>Trang quản trị riêng đã được tạo. Chức năng sẽ được kết nối với API và dữ liệu thật khi module này được triển khai.</p>
          </section>
        )}
      </main>
    </div>
  )
}
