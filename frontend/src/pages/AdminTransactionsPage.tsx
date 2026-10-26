import { useEffect, useState } from 'react'
import { api, type ApiAdminTransaction, type ApiAdminTransactionSummary, type ApiAdminUser } from '../apiClient'
import type { Page } from '../routing'
import AdminSectionPage from './admin/AdminSectionPage'

const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value)

export default function AdminTransactionsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<'all' | 'credit' | 'debit'>('all')
  const [type, setType] = useState<'all' | 'deposit' | 'withdrawal' | 'refund' | 'adjustment' | 'other'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [adjustUserSearch, setAdjustUserSearch] = useState('')
  const [adjustUser, setAdjustUser] = useState<ApiAdminUser | null>(null)
  const [adjustUserResults, setAdjustUserResults] = useState<ApiAdminUser[]>([])
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [refundTransactionId, setRefundTransactionId] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [transactions, setTransactions] = useState<ApiAdminTransaction[]>([])
  const [summary, setSummary] = useState<ApiAdminTransactionSummary | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      api.adminTransactions({
        search, direction, type, from, to, page, pageSize: 50,
        ...(amountMin ? { amountMin: Number(amountMin) } : {}),
        ...(amountMax ? { amountMax: Number(amountMax) } : {}),
      }).then((result) => {
        if (!active) return
        setTransactions(result.transactions)
        setSummary(result.summary)
        setTotalPages(result.pagination.totalPages)
        setTotal(result.pagination.total)
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải sổ cái giao dịch.')
      }).finally(() => { if (active) setLoading(false) })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [amountMax, amountMin, direction, from, page, reloadKey, search, to, type])

  useEffect(() => {
    let active = true
    if (adjustUserSearch.trim().length < 2 || adjustUser) return () => { active = false }
    const timer = window.setTimeout(() => {
      void api.adminUsers({ search: adjustUserSearch.trim(), status: 'active', page: 1, pageSize: 8 })
        .then((result) => { if (active) setAdjustUserResults(result.users) })
        .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tìm người dùng.') })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [adjustUser, adjustUserSearch])

  const submitAdjustment = async () => {
    const amount = Number(adjustAmount)
    if (!adjustUser || !Number.isSafeInteger(amount) || amount === 0 || adjustReason.trim().length < 3) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.adjustAdminWallet(adjustUser.id, amount, adjustReason.trim())
      setNotice(`Đã ghi điều chỉnh ${result.adjustment.code}; số dư mới ${number(result.balance)} xu.`)
      setAdjustAmount('')
      setAdjustReason('')
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể điều chỉnh số dư.')
    } finally {
      setSaving(false)
    }
  }

  const submitRefund = async () => {
    if (!refundTransactionId || refundReason.trim().length < 3 || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.refundAdminWalletTransaction(refundTransactionId, refundReason.trim())
      setNotice(`Đã hoàn xu theo mã ${result.refund.code}.`)
      setRefundTransactionId('')
      setRefundReason('')
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể hoàn xu.')
    } finally {
      setSaving(false)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setDirection('all')
    setType('all')
    setFrom('')
    setTo('')
    setAmountMin('')
    setAmountMax('')
    setPage(1)
  }
  return (
    <AdminSectionPage page="admin-transactions" title="Lịch sử giao dịch" onNavigate={onNavigate}>
      <section className="admin-wallet-summary admin-transaction-summary">
        <article><span>Số bút toán sổ cái</span><strong>{summary ? number(summary.totalTransactions) : '—'}</strong></article>
        <article><span>Tổng xu ghi có</span><strong>{summary ? number(summary.totalCoinCredits) : '—'}</strong></article>
        <article><span>Tổng xu ghi nợ</span><strong>{summary ? number(summary.totalCoinDebits) : '—'}</strong></article>
        <article><span>Số dư ròng theo sổ cái (xu)</span><strong>{summary ? number(summary.ledgerCoinBalance) : '—'}</strong></article>
      </section>
      <section className="admin-finance-card admin-transaction-history">
        <h2>Biến động xu đã ghi sổ</h2>
        <p>Đây là số xu trong ứng dụng, không phải số tiền VND. Yêu cầu nạp/rút đang chờ xử lý không được tính là đã hoàn tất.</p>
        {error && <p className="admin-finance-message error" role="alert">{error}</p>}
        {notice && <p className="admin-finance-message success" role="status">{notice}</p>}
        <div className="admin-finance-card">
          <h3>Điều chỉnh số dư</h3>
          <p>Chỉ điều chỉnh sau khi kiểm tra người dùng và ghi lý do. Không thể làm số dư âm.</p>
          <div className="admin-finance-filters">
            <input value={adjustUser ? `${adjustUser.name} · ${adjustUser.publicId}` : adjustUserSearch} onChange={(event) => { setAdjustUser(null); setAdjustUserResults([]); setAdjustUserSearch(event.target.value) }} placeholder="Tìm tên, email hoặc mã người dùng" aria-label="Tìm người dùng để điều chỉnh" />
            <input type="number" step="1" value={adjustAmount} onChange={(event) => setAdjustAmount(event.target.value)} placeholder="+/- số xu" aria-label="Số xu cần điều chỉnh" />
            <input value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} maxLength={500} placeholder="Lý do bắt buộc" aria-label="Lý do điều chỉnh" />
            <button type="button" disabled={saving || !adjustUser || !Number.isSafeInteger(Number(adjustAmount)) || Number(adjustAmount) === 0 || adjustReason.trim().length < 3} onClick={() => void submitAdjustment()}>{saving ? 'Đang ghi…' : 'Ghi điều chỉnh'}</button>
          </div>
          {adjustUserResults.length > 0 && <div className="admin-finance-list">{adjustUserResults.map((user) => <button type="button" className="admin-finance-link" key={user.id} onClick={() => { setAdjustUser(user); setAdjustUserSearch(''); setAdjustUserResults([]) }}>{user.name} · {user.publicId} · {user.email}</button>)}</div>}
          {adjustUser && <p className="admin-finance-message">Đang chọn: {adjustUser.name} · {adjustUser.publicId} · {adjustUser.email}</p>}
        </div>
        {refundTransactionId && <div className="admin-finance-card">
          <h3>Hoàn xu về Ví</h3>
          <p>Hoàn toàn bộ số xu của bút toán ghi nợ đã chọn. Giao dịch gốc chỉ được hoàn một lần.</p>
          <label>Lý do hoàn tiền<textarea rows={2} maxLength={500} value={refundReason} onChange={(event) => setRefundReason(event.target.value)} /></label>
          <button type="button" disabled={saving || refundReason.trim().length < 3} onClick={() => void submitRefund()}>{saving ? 'Đang hoàn…' : 'Xác nhận hoàn xu'}</button>
          <button type="button" className="secondary" disabled={saving} onClick={() => setRefundTransactionId('')}>Hủy</button>
        </div>}
        <div className="admin-finance-filters">
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Mã giao dịch, mã tham chiếu, ID hoặc người dùng" aria-label="Tìm giao dịch" />
          <select value={direction} onChange={(event) => { setDirection(event.target.value as typeof direction); setPage(1) }} aria-label="Lọc loại biến động">
            <option value="all">Xu vào và xu ra</option><option value="credit">Xu ghi có</option><option value="debit">Xu ghi nợ</option>
          </select>
          <select value={type} onChange={(event) => { setType(event.target.value as typeof type); setPage(1) }} aria-label="Lọc loại giao dịch">
            <option value="all">Tất cả giao dịch</option>
            <option value="deposit">Nạp xu</option>
            <option value="withdrawal">Rút tiền</option>
            <option value="refund">Hoàn xu</option>
            <option value="adjustment">Điều chỉnh số dư</option>
            <option value="other">Giao dịch khác</option>
          </select>
          <label>Từ ngày<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} /></label>
          <label>Đến ngày<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} /></label>
          <input type="number" min="0" step="1" value={amountMin} onChange={(event) => { setAmountMin(event.target.value); setPage(1) }} placeholder="Xu từ" aria-label="Số xu từ" />
          <input type="number" min="0" step="1" value={amountMax} onChange={(event) => { setAmountMax(event.target.value); setPage(1) }} placeholder="Xu đến" aria-label="Số xu đến" />
          <button type="button" className="admin-finance-reload" onClick={resetFilters}>Xóa bộ lọc</button>
        </div>
        {loading ? <p className="admin-finance-message">Đang tải sổ cái…</p>
          : transactions.length === 0 ? <p className="admin-finance-message">Không có bút toán phù hợp.</p>
            : <div className="admin-finance-table-wrap"><table className="admin-finance-table">
              <thead><tr><th>Mã giao dịch</th><th>Người dùng</th><th>Loại</th><th>Biến động (xu)</th><th>Mã tham chiếu</th><th>Thời gian</th><th>Trạng thái sổ cái</th></tr></thead>
              <tbody>{transactions.map((item) => <tr key={item.id}>
                <td title={item.transactionCode || item.id}>{item.transactionCode || item.id.slice(0, 12)}<button type="button" className="admin-finance-link" onClick={() => navigator.clipboard.writeText(item.transactionCode || item.id).then(() => setNotice('Đã sao chép mã giao dịch.')).catch(() => setError('Không thể sao chép mã giao dịch.'))}>Sao chép</button></td>
                <td>{item.displayName}<small>{item.publicId} · {item.email}</small></td>
                <td>{item.type}<small>{item.description}</small></td>
                <td className={item.direction === 'credit' ? 'amount positive' : 'amount negative'}>{item.direction === 'credit' ? '+' : '-'}{number(item.amount)}</td>
                <td>{item.reference}</td>
                <td>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt))}</td>
                <td>{item.status}{item.direction === 'debit' && <button type="button" className="admin-finance-link" disabled={saving} onClick={() => { setRefundTransactionId(item.id); setRefundReason('') }}>Hoàn xu</button>}</td>
              </tr>)}</tbody>
            </table></div>}
        <div className="admin-finance-actions admin-wallet-pagination">
          <button className="secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trang trước</button>
          <span>{number(total)} kết quả · Trang {page}{totalPages ? ` / ${totalPages}` : ''}</span>
          <button className="secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
        </div>
      </section>
    </AdminSectionPage>
  )
}
