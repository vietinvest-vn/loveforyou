import { useEffect, useState } from 'react'
import { api, type ApiAdminWallet, type ApiAdminWalletSummary } from '../../apiClient'
import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

type WalletStatus = 'all' | 'balanced' | 'mismatch'
const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value)

export default function AdminWalletPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<WalletStatus>('all')
  const [page, setPage] = useState(1)
  const [wallets, setWallets] = useState<ApiAdminWallet[]>([])
  const [summary, setSummary] = useState<ApiAdminWalletSummary | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      api.adminWallets({ search, status, page, pageSize: 25 }).then((result) => {
        if (!active) return
        setWallets(result.wallets)
        setSummary(result.summary)
        setTotalPages(result.pagination.totalPages)
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu ví.')
      }).finally(() => { if (active) setLoading(false) })
    }, 180)
    return () => { active = false; window.clearTimeout(timer) }
  }, [page, search, status])

  return (
    <AdminSectionPage page="admin-wallet" title="Quản lý ví" onNavigate={onNavigate}>
      <section className="admin-finance-section admin-wallet-section">
        <div className="admin-wallet-summary">
          <article><span>Số ví trong kết quả</span><strong>{summary ? number(summary.totalWallets) : '—'}</strong></article>
          <article><span>Xu ròng theo sổ cái</span><strong>{summary ? number(summary.totalLedgerCoins) : '—'}</strong><small>Đơn vị xu trong ứng dụng, không phải VND.</small></article>
          <article><span>Ví lệch đối soát</span><strong>{summary ? number(summary.mismatchCount) : '—'}</strong></article>
        </div>
        <div className="admin-finance-card">
          <h2>Đối soát số dư</h2>
          <p>Số dư sổ cái được tính từ biến động xu. Số dư khả dụng hiển thị từ tài khoản ví để phát hiện sai lệch.</p>
          <p>Hệ thống hiện chưa có mô hình số dư đang giữ; không thể báo cáo hoặc điều chỉnh phần đang giữ từ trang này.</p>
          <div className="admin-finance-filters">
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Tìm tên, email hoặc ID" aria-label="Tìm ví theo người dùng" />
            <select value={status} onChange={(event) => { setStatus(event.target.value as WalletStatus); setPage(1) }} aria-label="Lọc tình trạng đối soát">
              <option value="all">Tất cả ví</option>
              <option value="balanced">Khớp sổ cái</option>
              <option value="mismatch">Có sai lệch</option>
            </select>
          </div>
          {loading ? <p className="admin-finance-message">Đang tải ví…</p>
            : error ? <p className="admin-finance-message error" role="alert">{error}</p>
              : wallets.length === 0 ? <p className="admin-finance-message">Không có ví phù hợp.</p>
                : <div className="admin-finance-table-wrap"><table className="admin-finance-table">
                  <thead><tr><th>Người dùng</th><th>Sổ cái (xu)</th><th>Khả dụng (xu)</th><th>Giao dịch</th><th>Đối soát</th></tr></thead>
                  <tbody>{wallets.map((wallet) => <tr key={wallet.userId}>
                    <td>{wallet.displayName}<small>{wallet.publicId} · {wallet.email}</small></td>
                    <td>{number(wallet.ledgerBalance)}</td><td>{number(wallet.availableBalance)}</td>
                    <td>{number(wallet.transactionCount)}</td>
                    <td>{wallet.hasMismatch ? <strong className="admin-wallet-mismatch">Lệch {number(wallet.ledgerBalance - wallet.availableBalance)} xu</strong> : 'Khớp'}</td>
                  </tr>)}</tbody>
                </table></div>}
          <div className="admin-finance-actions admin-wallet-pagination">
            <button className="secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trang trước</button>
            <span>Trang {page}{totalPages ? ` / ${totalPages}` : ''}</span>
            <button className="secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
          </div>
        </div>
      </section>
    </AdminSectionPage>
  )
}
