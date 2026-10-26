import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api, type ApiAdminCouple } from '../../apiClient'
import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

type CoupleFilter = 'all' | 'connected' | 'pending' | 'rejected' | 'cancelled' | 'expired'

const statusLabels: Record<ApiAdminCouple['status'], string> = {
  connected: 'Đã kết nối',
  pending: 'Đang chờ',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy',
  expired: 'Đã hết hạn',
}

export default function AdminCouplesPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CoupleFilter>('all')
  const [couples, setCouples] = useState<ApiAdminCouple[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      api.adminCouples({ search, status: filter }).then((result) => {
        if (active) setCouples(result)
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách kết nối.')
      }).finally(() => {
        if (active) setLoading(false)
      })
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [filter, search])

  return (
    <AdminSectionPage page="admin-couples" title="Quản lý cặp đôi" onNavigate={onNavigate}>
      <section className="admin-section-placeholder admin-data-section">
        <div className="admin-data-toolbar">
          <label className="admin-data-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo ID hoặc tên người dùng"
              aria-label="Tìm cặp đôi theo ID hoặc tên"
            />
          </label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as CoupleFilter)} aria-label="Lọc trạng thái kết nối">
            <option value="all">Tất cả trạng thái</option>
            <option value="connected">Đã kết nối</option>
            <option value="pending">Đang chờ</option>
            <option value="rejected">Đã từ chối</option>
            <option value="cancelled">Đã hủy</option>
            <option value="expired">Đã hết hạn</option>
          </select>
        </div>
        {loading ? <p className="admin-data-message" role="status">Đang tải danh sách kết nối...</p>
          : error ? <p className="admin-data-message error" role="alert">{error}</p>
            : couples.length === 0 ? <p className="admin-data-message">Không có kết nối phù hợp.</p>
              : (
                <div className="admin-data-table-wrap">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>Thành viên</th>
                        <th>ID người dùng</th>
                        <th>Trạng thái</th>
                        <th>Ngày bắt đầu yêu</th>
                        <th>Ngày tạo / xử lý</th>
                      </tr>
                    </thead>
                    <tbody>
                      {couples.map((couple) => (
                        <tr key={couple.id}>
                          <td>{couple.participants.map((person) => person.displayName).join(' · ')}</td>
                          <td>{couple.participants.map((person) => person.publicId).join(' · ')}</td>
                          <td>{statusLabels[couple.status]}</td>
                          <td>{couple.relationshipStart || '—'}</td>
                          <td>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(couple.actedAt || couple.createdAt))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      </section>
    </AdminSectionPage>
  )
}
