import { useEffect, useMemo, useState } from 'react'
import { Bell, ChevronRight, CreditCard, Database, Download, Eye, FileText, Gift, Heart, HelpCircle, LayoutGrid, Lock, Menu, MessageSquareText, Search, ShieldCheck, Sparkles, Star, Unlock, Users, WalletCards, X } from 'lucide-react'
import { api, type ApiAdminUser, type ApiAdminUserSummary } from '../apiClient'
import type { Page } from '../routing'
import { useAdminSidebarScroll } from '../utils/adminSidebarScroll'

type UserRow = {
  accountId: string
  id: string
  name: string
  level: string
  age: string
  email: string
  phone: string
  role: string
  status: 'Đang hoạt động' | 'Bị khóa'
  online: boolean
  lastLoginAt: string
  lockReason: string
  lockedAt: string
  joinedAt: string
  avatar: string
}

const sidebarItems: Array<{ label: string; active?: boolean; icon: typeof LayoutGrid; route: Page }> = [
  { label: 'Tổng quan', icon: LayoutGrid, route: 'admin' },
  { label: 'Quản lý người dùng', icon: Users, active: true, route: 'admin-users' },
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
  { label: 'Tổng người dùng', value: '0', change: '+ 0%', icon: Users, tone: 'pink' },
  { label: 'Đang hoạt động', value: '0', change: '+ 0%', icon: Heart, tone: 'mint' },
  { label: 'Bị khóa', value: '0', change: '+ 0%', icon: ShieldCheck, tone: 'amber' },
  { label: 'Cấp độ yêu', value: '0', change: '+ 0%', icon: Sparkles, tone: 'purple' },
]

type UserManagementPageProps = {
  onNavigate?: (page: Page) => void
}

export default function UserManagementPage({ onNavigate }: UserManagementPageProps) {
  const { sidebarRef, rememberScroll, handleScroll } = useAdminSidebarScroll()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all')
  const [registeredFrom, setRegisteredFrom] = useState('')
  const [registeredTo, setRegisteredTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalFiltered, setTotalFiltered] = useState(0)
  const [rows, setRows] = useState<UserRow[]>([])
  const [summary, setSummary] = useState<ApiAdminUserSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [selectedTransactions, setSelectedTransactions] = useState<{ id: string; description: string; amount: number; reference: string; createdAt: string }[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const updateSearch = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }
  const updateStatusFilter = (value: 'all' | 'active' | 'locked') => {
    setStatusFilter(value)
    setCurrentPage(1)
  }
  const updateRegisteredFrom = (value: string) => {
    setRegisteredFrom(value)
    setCurrentPage(1)
  }
  const updateRegisteredTo = (value: string) => {
    setRegisteredTo(value)
    setCurrentPage(1)
  }

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      api.adminUsers({ search, status: statusFilter, registeredFrom, registeredTo, page: currentPage, pageSize: 25 }).then((result) => {
        if (!active) return
        const mappedRows = result.users.map((user: ApiAdminUser) => ({
          accountId: user.id,
          id: user.publicId || user.id.slice(0, 6),
          name: user.name,
          level: 'LV1',
          age: 'Thành viên',
          email: user.email,
          phone: user.phone || 'Chưa có',
          role: user.role,
          status: user.status,
          online: user.online,
          lastLoginAt: user.lastLoginAt,
          lockReason: user.lockReason,
          lockedAt: user.lockedAt,
          joinedAt: new Date(user.joinedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }),
          avatar: user.avatar,
        }))
        setRows(mappedRows)
        setSummary(result.summary)
        setTotalPages(Math.max(1, result.pagination.totalPages))
        setTotalFiltered(result.pagination.total)
        setLoading(false)
      }).catch((cause: unknown) => {
        if (!active) return
        setRows([])
        setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách người dùng. Vui lòng thử lại.')
        setLoading(false)
      })
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [currentPage, registeredFrom, registeredTo, refreshKey, search, statusFilter])

  const metrics = useMemo(() => {
    const base = summary ?? { totalUsers: 0, activeUsers: 0, blockedUsers: 0 }
    return [
      { label: 'Tổng người dùng', value: new Intl.NumberFormat('vi-VN').format(base.totalUsers), change: '+ 12%', icon: Users, tone: 'pink' },
      { label: 'Đang hoạt động', value: new Intl.NumberFormat('vi-VN').format(base.activeUsers), change: '+ 15%', icon: Heart, tone: 'mint' },
      { label: 'Bị khóa', value: new Intl.NumberFormat('vi-VN').format(base.blockedUsers), change: '+ 2%', icon: ShieldCheck, tone: 'amber' },
      { label: 'Kết quả phù hợp', value: new Intl.NumberFormat('vi-VN').format(totalFiltered), change: 'Theo bộ lọc hiện tại', icon: Sparkles, tone: 'purple' },
    ]
  }, [summary, totalFiltered])

  const filteredRows = useMemo(() => rows, [rows])

  async function updateUserStatus(user: UserRow) {
    const nextStatus = user.status === 'Bị khóa' ? 'active' : 'locked'
    const reason = nextStatus === 'locked'
      ? window.prompt(`Nhập lý do khóa tài khoản ${user.name}:`)?.trim() ?? ''
      : ''
    if (nextStatus === 'locked' && !reason) return
    const confirmed = window.confirm(
      nextStatus === 'locked'
        ? `Xác nhận khóa tài khoản ${user.name}? Phiên đăng nhập hiện tại của họ sẽ bị thu hồi.`
        : `Xác nhận mở khóa tài khoản ${user.name}?`,
    )
    if (!confirmed) return
    setActionMessage('')
    try {
      await api.updateAdminUserStatus(user.accountId, nextStatus, reason)
      const updatedUser = { ...user, status: nextStatus === 'locked' ? 'Bị khóa' as const : 'Đang hoạt động' as const, lockReason: nextStatus === 'locked' ? reason : '', lockedAt: nextStatus === 'locked' ? new Date().toISOString() : '' }
      setRows((current) => current.map((row) => row.accountId === user.accountId
        ? updatedUser
        : row))
      setSelectedUser((current) => current?.accountId === user.accountId ? updatedUser : current)
      setSummary((current) => current ? {
        ...current,
        activeUsers: current.activeUsers + (nextStatus === 'active' ? 1 : -1),
        blockedUsers: current.blockedUsers + (nextStatus === 'locked' ? 1 : -1),
      } : current)
      setActionMessage(nextStatus === 'locked' ? 'Đã khóa tài khoản và thu hồi phiên đăng nhập.' : 'Đã mở khóa tài khoản.')
      setRefreshKey((current) => current + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái tài khoản.')
    }
  }

  async function showUserDetail(user: UserRow) {
    setSelectedUser(user)
    setSelectedTransactions([])
    setDetailLoading(true)
    try {
      const detail = await api.adminUserDetail(user.accountId)
      setSelectedTransactions(detail.walletTransactions)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết tài khoản.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function exportUsers() {
    setError('')
    try {
      const blob = await api.exportAdminUsers({ search, status: statusFilter, registeredFrom, registeredTo })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'loveforyou-users.csv'
      link.click()
      URL.revokeObjectURL(url)
      setActionMessage('Đã xuất danh sách người dùng theo bộ lọc hiện tại.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xuất danh sách người dùng.')
    }
  }

  return (
    <div className="user-management-shell">
      <aside ref={sidebarRef} className="user-sidebar" onScroll={handleScroll}>
        <div className="user-brand-block">
          <div className="user-brand-mark"><Heart size={20} fill="currentColor" /></div>
          <div className="user-brand-copy">
            <strong>LoveForYou</strong>
            <small>Kết nối yêu thương</small>
          </div>
        </div>

        <nav className="user-sidebar-nav" aria-label="Sidebar admin">
          {sidebarItems.map(({ label, icon: Icon, active, route }) => (
            <button
              type="button"
              key={label}
              className={`user-nav-item ${active ? 'active' : ''}`}
              onClick={() => { rememberScroll(); onNavigate?.(route) }}
            >
              <span className="user-nav-icon"><Icon size={17} /></span>
              <span>{label}</span>
              {!active && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>

      </aside>

      <main className="user-main-panel">
        <header className="user-header">
          <button type="button" className="user-menu-button" aria-label="Mở menu"><Menu size={18} /></button>

          <label className="user-search" aria-label="Tìm kiếm người dùng">
            <Search size={16} />
            <input type="text" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Tìm kiếm theo tên, ID, email, số điện thoại..." />
          </label>

          <div className="user-header-tools">
            <button type="button" className="header-icon" aria-label="Thông báo"><Bell size={18} /></button>
            <button type="button" className="header-icon" aria-label="Chế độ sáng tối"><Sparkles size={18} /></button>
            <button type="button" className="user-admin-pill" aria-label="Admin">
              <span className="admin-avatar">A</span>
              <span className="admin-name">
                <strong>Admin</strong>
                <small>Quản trị viên</small>
              </span>
            </button>
          </div>
        </header>

        <div className="user-page-header">
          <div>
            <p className="page-kicker">QUẢN LÝ</p>
            <h1>Quản lý người dùng</h1>
          </div>
          <div className="user-kpis">
            {(loading && !summary ? defaultMetrics : metrics).map(({ label, value, change, icon: Icon, tone }) => (
              <article key={label} className={`user-kpi ${tone}`}>
                <div className="kpi-icon"><Icon size={18} /></div>
                <div className="kpi-copy">
                  <strong>{loading && !summary ? '—' : value}</strong>
                  <small>{label}</small>
                </div>
                <span className="kpi-trend">{change}</span>
              </article>
            ))}
          </div>
        </div>

        <section className="user-table-panel">
          <div className="table-controls">
            <label className="search-inline" aria-label="Tìm kiếm trong bảng">
              <Search size={15} />
              <input type="text" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Tìm kiếm theo tên, ID, email, số điện thoại..." />
            </label>

            <div className="filters-inline">
              <button type="button" className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => updateStatusFilter('all')}>Tất cả trạng thái</button>
              <button type="button" className={`filter-pill ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => updateStatusFilter('active')}>Đang hoạt động</button>
              <button type="button" className={`filter-pill ${statusFilter === 'locked' ? 'active' : ''}`} onClick={() => updateStatusFilter('locked')}>Bị khóa</button>
              <label className="admin-date-filter">Từ ngày<input type="date" value={registeredFrom} max={registeredTo || undefined} onChange={(event) => updateRegisteredFrom(event.target.value)} /></label>
              <label className="admin-date-filter">Đến ngày<input type="date" value={registeredTo} min={registeredFrom || undefined} onChange={(event) => updateRegisteredTo(event.target.value)} /></label>
              <button type="button" className="filter-pill" onClick={() => void exportUsers()}><Download size={14} /> Xuất CSV</button>
              <span className="user-list-count">{summary ? `${summary.totalUsers} tài khoản` : ''}</span>
            </div>
          </div>

          <div className="user-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="checkbox-col"><input type="checkbox" aria-label="Chọn tất cả" /></th>
                  <th>ID</th>
                  <th>Ảnh đại diện</th>
                  <th>Tên người dùng</th>
                  <th>Email</th>
                  <th>Số điện thoại</th>
                  <th>Vai trò</th>
                  <th>Tình trạng</th>
                  <th>Ngày đăng ký</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={10} className="empty-row">{loading ? 'Đang tải dữ liệu người dùng...' : error || 'Không có người dùng nào phù hợp.'}</td></tr>
                ) : filteredRows.map((user) => (
                  <tr key={user.id}>
                    <td className="checkbox-col"><input type="checkbox" aria-label={`Chọn ${user.name}`} /></td>
                    <td>{user.id}</td>
                    <td><span className="avatar-badge">{user.avatar}</span></td>
                    <td>
                      <div className="user-name-cell">
                        <strong>{user.name}</strong>
                        <small>{user.online ? 'Đang trực tuyến' : 'Ngoại tuyến'} · {user.role}</small>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.phone}</td>
                    <td><span className="role-badge">{user.role}</span></td>
                    <td>
                      <span className={`status-badge ${user.status === 'Đang hoạt động' ? 'active' : 'locked'}`}>
                        {user.status}
                      </span>
                      {user.status === 'Bị khóa' && (
                        <small className="user-lock-meta">
                          {user.lockedAt ? new Date(user.lockedAt).toLocaleString('vi-VN') : 'Thời điểm khóa không có'}
                          {user.lockReason ? ` · ${user.lockReason}` : ''}
                        </small>
                      )}
                    </td>
                    <td>{user.joinedAt}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" aria-label={`Xem ${user.name}`} onClick={() => void showUserDetail(user)}><Eye size={15} /></button>
                        <button
                          type="button"
                          aria-label={`${user.status === 'Bị khóa' ? 'Mở khóa' : 'Khóa'} ${user.name}`}
                          onClick={() => void updateUserStatus(user)}
                        >
                          {user.status === 'Bị khóa' ? <Unlock size={15} /> : <Lock size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {actionMessage && <p className="admin-action-message" role="status">{actionMessage}</p>}
          {error && !loading && <p className="admin-action-message error" role="alert">{error}</p>}

          <div className="table-footer">
            <span>{loading ? 'Đang tải dữ liệu...' : totalFiltered > 0 ? `Trang ${currentPage} / ${totalPages} · ${totalFiltered} người dùng phù hợp` : 'Không có người dùng nào phù hợp'}</span>
            <div className="pagination">
              <button type="button" className="page-arrow" disabled={currentPage <= 1 || loading} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>‹</button>
              <button type="button" className="page-number active" aria-current="page">{currentPage}</button>
              <button type="button" className="page-arrow" disabled={currentPage >= totalPages || loading} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>›</button>
            </div>
          </div>
        </section>
        {selectedUser && (
          <div className="admin-detail-backdrop" role="presentation" onClick={() => setSelectedUser(null)}>
            <section
              className="admin-user-detail"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-user-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="admin-detail-close" aria-label="Đóng chi tiết" onClick={() => setSelectedUser(null)}><X size={18} /></button>
              <p className="page-kicker">HỒ SƠ TÀI KHOẢN</p>
              <h2 id="admin-user-detail-title">{selectedUser.name}</h2>
              <dl>
                <div><dt>ID LoveForYou</dt><dd>{selectedUser.id}</dd></div>
                <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
                <div><dt>Trạng thái tài khoản</dt><dd>{selectedUser.status}</dd></div>
                <div><dt>Hoạt động</dt><dd>{selectedUser.online ? 'Đang trực tuyến' : 'Ngoại tuyến'}</dd></div>
                <div><dt>Ngày đăng ký</dt><dd>{selectedUser.joinedAt}</dd></div>
                <div><dt>Lần đăng nhập gần nhất</dt><dd>{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString('vi-VN') : 'Chưa có dữ liệu'}</dd></div>
                {selectedUser.lockReason && <div><dt>Lý do khóa</dt><dd>{selectedUser.lockReason}</dd></div>}
                {selectedUser.lockedAt && <div><dt>Thời điểm khóa</dt><dd>{new Date(selectedUser.lockedAt).toLocaleString('vi-VN')}</dd></div>}
              </dl>
              <h3>Lịch sử giao dịch gần đây</h3>
              {detailLoading ? <p role="status">Đang tải lịch sử giao dịch...</p>
                : selectedTransactions.length === 0 ? <p>Không có giao dịch để hiển thị.</p>
                  : <ul className="admin-user-transaction-list">
                    {selectedTransactions.map((transaction) => (
                      <li key={transaction.id}>
                        <span>{transaction.description || 'Giao dịch ví'}{transaction.createdAt ? ` · ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(transaction.createdAt))}` : ''}</span>
                        <strong>{transaction.amount > 0 ? '+' : ''}{new Intl.NumberFormat('vi-VN').format(transaction.amount)} xu</strong>
                      </li>
                    ))}
                  </ul>}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
