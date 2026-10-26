import { useEffect, useMemo, useState } from 'react'
import { Bell, ChevronRight, CreditCard, Database, Download, FileText, Gift, Heart, HelpCircle, LayoutGrid, MessageSquareText, Search, ShieldCheck, Sparkles, Star, Users, WalletCards } from 'lucide-react'
import type { Page } from '../routing'
import { api, type ApiAdminActivity, type ApiAdminOverviewPoint, type ApiAdminOverviewSummary, type ApiAdminSystemStatus, type ApiAdminTopUser } from '../apiClient'
import { useAdminSidebarScroll } from '../utils/adminSidebarScroll'

const sidebarItems: Array<{ label: string; active?: boolean; icon: typeof LayoutGrid; route: Page }> = [
  { label: 'Tổng quan', active: true, icon: LayoutGrid, route: 'admin' },
  { label: 'Quản lý người dùng', icon: Users, route: 'admin-users' },
  { label: 'Quản lý cặp đôi', icon: Heart, route: 'admin-couples' },
  { label: 'Quản lý nội dung', icon: MessageSquareText, route: 'admin-content' },
  { label: 'Quản lý tin nhắn', icon: MessageSquareText, route: 'admin-messages' },
  { label: 'Quản lý thông báo', icon: Bell, route: 'admin-notifications' },
  { label: 'Quản lý Premium', icon: Sparkles, route: 'admin-premium' },
  { label: 'Quản lý ví', icon: WalletCards, route: 'admin-wallet' },
  { label: 'Quản lý nạp tiền', icon: WalletCards, route: 'admin-deposits' },
  { label: 'Cấu hình thanh toán QR', icon: CreditCard, route: 'admin-payment-qr' },
  { label: 'Quản lý gói nạp', icon: Gift, route: 'admin-topup-packages' },
  { label: 'Quản lý rút tiền', icon: Download, route: 'admin-withdrawals' },
  { label: 'Lịch sử giao dịch', icon: WalletCards, route: 'admin-transactions' },
  { label: 'Quản lý cửa hàng', icon: Gift, route: 'admin-store' },
  { label: 'Quản lý quà tặng', icon: Gift, route: 'admin-gifts' },
  { label: 'Quản lý xu và vật phẩm', icon: Sparkles, route: 'admin-items' },
  { label: 'Quản lý khuyến mãi', icon: Star, route: 'admin-promotions' },
  { label: 'Hỗ trợ và khiếu nại', icon: ShieldCheck, route: 'admin-support' },
  { label: 'Quản lý an ninh', icon: ShieldCheck, route: 'admin-security' },
  { label: 'Nhật ký quản trị', icon: FileText, route: 'admin-audit-log' },
  { label: 'Báo cáo và thống kê', icon: LayoutGrid, route: 'admin-reports' },
  { label: 'Quản lý Admin và phân quyền', icon: Users, route: 'admin-roles' },
  { label: 'Cấu hình hệ thống', icon: ShieldCheck, route: 'admin-system' },
  { label: 'Quản lý dữ liệu và sao lưu', icon: Database, route: 'admin-backups' },
  { label: 'Trợ giúp và tài liệu', icon: HelpCircle, route: 'admin-help' },
  { label: 'Tài khoản Admin của tôi', icon: Users, route: 'admin-account' },
]

const defaultMetrics = [
  { label: 'Tổng người dùng', value: '0', change: '+ 0%', subtitle: 'so với tuần trước', accent: 'pink' },
  { label: 'Đang hoạt động', value: '0', change: '+ 0%', subtitle: 'so với tuần trước', accent: 'rose' },
  { label: 'Tổng xu đã trao', value: '0', change: '+ 0%', subtitle: 'so với tuần trước', accent: 'peach' },
  { label: 'Quà tặng đã gửi', value: '0', change: '+ 0%', subtitle: 'so với tuần trước', accent: 'lavender' },
]

const defaultChartData: ApiAdminOverviewPoint[] = []

const defaultTopUsers: ApiAdminTopUser[] = []
const defaultActivities: ApiAdminActivity[] = []
const defaultSystemItems: ApiAdminSystemStatus[] = [
  { title: 'Máy chủ', value: 'Đang kiểm tra' },
  { title: 'Cơ sở dữ liệu', value: 'Đang đồng bộ' },
  { title: 'Bot cảnh báo', value: 'Đang chờ' },
  { title: 'Phân tích', value: 'Đang cập nhật' },
]

const donutSegments: { label: string; value: number; color: string }[] = []

type AdminDashboardPageProps = {
  onNavigate: (page: import('../routing').Page) => void
}

export default function AdminDashboardPage({ onNavigate }: AdminDashboardPageProps) {
  const { sidebarRef, rememberScroll, handleScroll } = useAdminSidebarScroll()
  const [overview, setOverview] = useState<{ summary: ApiAdminOverviewSummary; chart: ApiAdminOverviewPoint[]; topUsers: ApiAdminTopUser[]; activities: ApiAdminActivity[]; systemStatus: ApiAdminSystemStatus[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.adminOverview().then((result) => {
      if (!active) return
      setOverview(result)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setOverview({
        summary: { totalUsers: 0, activeUsers: 0, activeCouples: 0, totalCoinsTransferred: 0, sentGifts: 0 },
        chart: defaultChartData,
        topUsers: defaultTopUsers,
        activities: defaultActivities,
        systemStatus: defaultSystemItems,
      })
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const summary = overview?.summary ?? null
  const chartData = overview?.chart ?? defaultChartData
  const recentUsers = overview?.topUsers ?? defaultTopUsers
  const recentActivities = overview?.activities ?? defaultActivities
  const supportItems = overview?.systemStatus ?? defaultSystemItems

  const metricsData = useMemo(() => {
    if (!summary) return defaultMetrics
    return [
      { label: 'Tổng người dùng', value: new Intl.NumberFormat('vi-VN').format(summary.totalUsers), change: '+ 12%', subtitle: 'so với tuần trước', accent: 'pink' },
      { label: 'Đang hoạt động', value: new Intl.NumberFormat('vi-VN').format(summary.activeUsers), change: '+ 15%', subtitle: 'so với tuần trước', accent: 'rose' },
      { label: 'Tổng xu đã trao', value: new Intl.NumberFormat('vi-VN').format(summary.totalCoinsTransferred), change: '+ 23%', subtitle: 'so với tuần trước', accent: 'peach' },
      { label: 'Quà tặng đã gửi', value: new Intl.NumberFormat('vi-VN').format(summary.sentGifts), change: '+ 18%', subtitle: 'so với tuần trước', accent: 'lavender' },
    ]
  }, [summary])

  const chartValues = chartData.map((item) => item.value)
  const maxValue = chartValues.length ? Math.max(...chartValues) : 0
  const minValue = chartValues.length ? Math.min(...chartValues) : 0
  const points = chartData.length
    ? chartData
      .map((item, index) => {
        const x = 20 + index * 48
        const y = 120 - ((item.value - minValue) / (maxValue - minValue || 1)) * 82
        return `${x},${y}`
      })
      .join(' ')
    : ''

  const totalSegment = donutSegments.reduce((sum, segment) => sum + segment.value, 0)
  const diameter = 178
  const radius = diameter / 2 - 12
  const circumference = 2 * Math.PI * radius

  return (
    <main className="admin-dashboard">
      <aside ref={sidebarRef} className="admin-sidebar" onScroll={handleScroll}>
        <div className="admin-brand">
          <span className="admin-brand-mark"><Heart size={22} fill="currentColor" /></span>
          <span className="admin-brand-text">
            <strong>LoveForYou</strong>
            <small>Kết nối yêu thương</small>
          </span>
        </div>

        <nav className="admin-nav" aria-label="Menu điều hành">
          {sidebarItems.map(({ label, icon: Icon, active, route }) => (
            <button type="button" key={label} className={`admin-nav-item ${active ? 'active' : ''}`} onClick={() => { rememberScroll(); onNavigate(route) }}>
              <span className="admin-nav-icon"><Icon size={18} /></span>
              <span>{label}</span>
              {label !== 'Tổng quan' && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>

      </aside>

      <section className="admin-main-panel">
        <header className="admin-topbar">
          <label className="admin-search" aria-label="Tìm kiếm người dùng">
            <Search size={16} />
            <input type="text" value="Tìm kiếm người dùng, nội dung, mã giao dịch..." readOnly />
          </label>

          <div className="admin-topbar-actions">
            <button type="button" className="admin-icon-button" aria-label="Thông báo">
              <Bell size={18} />
            </button>
            <button type="button" className="admin-avatar-button" aria-label="Admin menu">
              <span className="admin-avatar-mini">A</span>
              <span className="admin-avatar-copy">
                <strong>Admin</strong>
                <small>Quản trị viên</small>
              </span>
            </button>
          </div>
        </header>

        <div className="admin-content-grid">
          <div className="admin-left-column">
            <section className="admin-hero-card">
              <div className="admin-hero-copy">
                <h1>Xin chào Admin!</h1>
                <p>Chào mừng bạn đến với trang quản trị LoveForYou.</p>
                <p>Cùng nhau xây dựng một cộng đồng yêu thương và an toàn hơn.</p>
              </div>
              <div className="admin-hero-illustration" aria-hidden="true">
                <span className="heart heart-one"><Heart size={30} fill="currentColor" /></span>
                <span className="heart heart-two"><Heart size={26} fill="currentColor" /></span>
              </div>
            </section>

            <section className="admin-metrics-grid">
              {metricsData.map(({ label, value, change, subtitle, accent }) => (
                <article key={label} className={`admin-metric-card ${accent}`}>
                  <h3>{label}</h3>
                  <div className="metric-value-row">
                    <strong>{loading && !summary ? '—' : value}</strong>
                    <span>{change}</span>
                  </div>
                  <small>{subtitle}</small>
                </article>
              ))}
            </section>

            <section className="admin-chart-card">
              <div className="admin-card-header">
                <h2>Thống kê người dùng</h2>
                <div className="mini-filter">
                  <button className="is-active">Đang hoạt động</button>
                  <button>Đăng ký</button>
                  <button>Phát triển</button>
                </div>
              </div>

              <div className="admin-chart-wrap">
                {chartData.length === 0 ? (
                  <div className="admin-empty-state">Chưa có dữ liệu thống kê người dùng để hiển thị.</div>
                ) : (
                  <>
                    <svg viewBox="0 0 420 170" role="img" aria-label="Biểu đồ người dùng">
                      <defs>
                        <linearGradient id="adminChartFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#ef7dbd" stopOpacity="0.55" />
                          <stop offset="100%" stopColor="#ef7dbd" stopOpacity="0.04" />
                        </linearGradient>
                      </defs>
                      <g className="chart-grid-lines">
                        {[0, 1, 2, 3, 4].map((line) => (
                          <line key={line} x1="20" x2="390" y1={20 + line * 28} y2={20 + line * 28} />
                        ))}
                      </g>
                      <polyline className="chart-area" points={`20,120 ${points} 390,120`} />
                      <polyline className="chart-line" points={points} />
                    </svg>
                    <div className="chart-label-row">
                      {chartData.map((item) => (
                        <span key={item.label}>{item.label}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="admin-table-card">
              <div className="admin-card-header">
                <h2>Người dùng mới nhất</h2>
                <button type="button" className="text-button">Xem tất cả <ChevronRight size={14} /></button>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tên người dùng</th>
                    <th>Giới tính</th>
                    <th>Ngày đăng ký</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Đang tải dữ liệu...</td></tr>
                    ) : recentUsers.map((user) => {
                      const name = user.displayName ?? 'Người dùng'
                      const firstLetter = name.trim().charAt(0).toUpperCase() || 'U'
                      const city = user.city ?? 'Chưa cập nhật'
                      const plan = user.plan ?? 'Thành viên'
                      return (
                        <tr key={user.id}>
                          <td>{user.id}</td>
                          <td><div className="user-cell"><span className="user-avatar">{firstLetter}</span><strong>{name}</strong></div></td>
                          <td>{city}</td>
                          <td>{plan}</td>
                          <td><span className="status-pill is-active">{user.status}</span></td>
                          <td><button type="button" className="tiny-button">Xem</button></td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </section>
          </div>

          <aside className="admin-right-column">
            <section className="admin-summary-card">
              <div className="admin-card-header narrow">
                <h2>Hoạt động gần đây</h2>
                <button type="button" className="text-button">Xem tất cả <ChevronRight size={14} /></button>
              </div>
              <ul className="activity-list">
                {recentActivities.map((item) => (
                  <li key={item.title}>
                    <span className="activity-dot" />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </div>
                    <time>{item.time}</time>
                  </li>
                ))}
              </ul>
            </section>

            <section className="admin-donut-card">
              {donutSegments.length === 0 ? (
                <div className="admin-empty-state compact">Chưa có dữ liệu thiết bị để phân tích.</div>
              ) : (
                <>
                  <div className="donut-chart-wrap">
                    <svg viewBox={`0 0 ${diameter} ${diameter}`} role="img" aria-label="Tỷ lệ thiết bị người dùng">
                      <circle cx={diameter / 2} cy={diameter / 2} r={radius} stroke="#e7ebff" strokeWidth="18" fill="none" />
                      {donutSegments.map((segment, index) => {
                        const offset = donutSegments
                          .slice(0, index)
                          .reduce((sum, current) => sum + current.value, 0)
                        const dash = (segment.value / totalSegment) * circumference
                        const gap = circumference - dash
                        return (
                          <circle
                            key={segment.label}
                            cx={diameter / 2}
                            cy={diameter / 2}
                            r={radius}
                            stroke={segment.color}
                            strokeDasharray={`${dash} ${gap}`}
                            strokeDashoffset={-((offset / totalSegment) * circumference)}
                            strokeWidth="18"
                            fill="none"
                            strokeLinecap="round"
                            transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
                          />
                        )
                      })}
                    </svg>
                    <div className="donut-center">
                      <strong>{summary ? new Intl.NumberFormat('vi-VN').format(summary.totalUsers) : '0'}</strong>
                      <small>Người dùng</small>
                    </div>
                  </div>

                  <div className="donut-legend">
                    {donutSegments.map((segment) => (
                      <div key={segment.label} className="legend-item">
                        <span className="legend-swatch" style={{ backgroundColor: segment.color }} />
                        <span>{segment.label}</span>
                        <strong>{segment.value}%</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="admin-top-users-card">
              <div className="admin-card-header narrow">
                <h2>Top người dùng tích cực</h2>
                <button type="button" className="text-button">Xem tất cả <ChevronRight size={14} /></button>
              </div>

              <ul className="top-user-list">
                {recentUsers.slice(0, 5).map((user, index) => {
                  const name = user.displayName ?? 'Người dùng'
                  const plan = user.plan ?? 'Thành viên'
                  const safePoints = Number.isFinite(Number(user.points)) ? Number(user.points) : 0
                  return (
                    <li key={user.id}>
                      <span className="rank-badge">{index + 1}</span>
                      <div className="top-user-meta">
                        <strong>{name}</strong>
                        <small>{plan}</small>
                      </div>
                      <span className="top-user-score">{safePoints.toLocaleString('vi-VN')}</span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="admin-support-card">
              <div className="admin-card-header narrow">
                <h2>Hệ thống</h2>
                <button type="button" className="text-button">Xem chi tiết</button>
              </div>
              <ul className="support-list">
                {supportItems.map((item) => (
                  <li key={item.title}><span>{item.title}</span><strong>{item.value}</strong></li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
