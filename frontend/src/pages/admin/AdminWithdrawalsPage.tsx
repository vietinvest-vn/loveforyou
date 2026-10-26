import { useCallback, useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { api, type ApiWithdrawal } from '../../apiClient'
import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

const statuses: Record<ApiWithdrawal['status'], string> = {
  pending_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  processing: 'Đang chuyển tiền',
  paid: 'Đã thanh toán',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy',
  failed: 'Thất bại',
}
const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value)

export default function AdminWithdrawalsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [items, setItems] = useState<ApiWithdrawal[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [bankReference, setBankReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selected = items.find((item) => item.id === selectedId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.adminWithdrawals({ search, status, from, to })
      setItems(result.withdrawals)
      setSelectedId((current) => result.withdrawals.some((item) => item.id === current) ? current : result.withdrawals[0]?.id ?? '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải yêu cầu rút tiền.')
    } finally {
      setLoading(false)
    }
  }, [from, search, status, to])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 150)
    return () => window.clearTimeout(timer)
  }, [load])

  const perform = async (action: 'approve' | 'reject' | 'processing' | 'paid' | 'failed') => {
    if (!selected || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.reviewAdminWithdrawal(selected.id, {
        action,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(bankReference.trim() ? { bankReference: bankReference.trim() } : {}),
      })
      setItems((current) => current.map((item) => item.id === result.withdrawal.id ? result.withdrawal : item))
      setNotice(`Đã cập nhật ${result.withdrawal.code}: ${statuses[result.withdrawal.status]}.`)
      setReason('')
      if (action === 'paid') setBankReference('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xử lý yêu cầu rút tiền.')
    } finally {
      setBusy(false)
    }
  }

  const copyCode = async () => {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(selected.code)
      setNotice(`Đã sao chép mã ${selected.code}.`)
    } catch {
      setError('Không thể sao chép mã. Hãy chọn và sao chép thủ công.')
    }
  }

  return <AdminSectionPage page="admin-withdrawals" title="Quản lý rút tiền" onNavigate={onNavigate}>
    <div className="admin-finance-card">
      <h2>Yêu cầu rút tiền</h2>
      <div className="admin-finance-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã LFR, mã người dùng hoặc tên" aria-label="Tìm yêu cầu rút tiền" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái">
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <label>Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Đến ngày<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button type="button" className="admin-finance-reload" disabled={loading} onClick={() => void load()}>{loading ? 'Đang tải…' : 'Tải lại'}</button>
      </div>
      {error && <p className="admin-finance-message error" role="alert">{error}</p>}
      {notice && <p className="admin-finance-message success" role="status">{notice}</p>}
      {loading ? <p className="admin-finance-message">Đang tải…</p>
        : items.length === 0 ? <p className="admin-finance-message">Chưa có yêu cầu rút tiền phù hợp.</p>
          : <div className="admin-finance-table-wrap"><table className="admin-finance-table">
            <thead><tr><th>Mã yêu cầu</th><th>Người dùng</th><th>Số xu / VND</th><th>Tài khoản nhận</th><th>Trạng thái</th><th>Thời gian</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id} className={selectedId === item.id ? 'is-selected' : ''}>
              <td><button type="button" className="admin-finance-link" onClick={() => { setSelectedId(item.id); setReason(''); setBankReference('') }}>{item.code}</button></td>
              <td>{item.user?.displayName}<small>{item.user?.publicId} · {item.user?.email}</small></td>
              <td>{money(item.coins)} xu<small>{money(item.amountVnd)} VND · phí {money(item.feeVnd)} VND</small></td>
              <td>{item.bankAccount.bankShortName}<small>{item.bankAccount.accountName} · {item.bankAccount.accountNumber}</small></td>
              <td>{statuses[item.status]}</td>
              <td>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</td>
            </tr>)}</tbody>
          </table></div>}
    </div>
    {selected && <div className="admin-finance-card admin-deposit-review">
      <h2>Chi tiết {selected.code} <button type="button" className="secondary" onClick={() => void copyCode()}><Copy size={15} /> Sao chép mã</button></h2>
      <p><strong>Người dùng:</strong> {selected.user?.displayName} · {selected.user?.publicId} · {selected.user?.email}</p>
      <p><strong>Số xu giữ:</strong> {money(selected.coins)} xu</p>
      <p><strong>Số tiền:</strong> {money(selected.amountVnd)} VND · phí {money(selected.feeVnd)} VND · dự kiến chuyển {money(selected.receiveAmountVnd)} VND</p>
      <p><strong>Ngân hàng nhận:</strong> {selected.bankAccount.bankName} ({selected.bankAccount.bankShortName})</p>
      <p><strong>Chủ tài khoản / số tài khoản:</strong> {selected.bankAccount.accountName} · {selected.bankAccount.accountNumber}</p>
      <p><strong>Trạng thái:</strong> {statuses[selected.status]}</p>
      {selected.bankReference && <p><strong>Mã tham chiếu ngân hàng:</strong> {selected.bankReference}</p>}
      {selected.history.map((event, index) => <p key={`${event.status}-${event.createdAt}-${index}`}>{statuses[event.status as ApiWithdrawal['status']] ?? event.status} · {new Date(event.createdAt).toLocaleString('vi-VN')} {event.reason}</p>)}
      {['pending_review', 'approved', 'processing'].includes(selected.status) && <>
        <label>Lý do xử lý<textarea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bắt buộc khi từ chối hoặc chuyển thất bại" /></label>
        {selected.status === 'processing' && <label>Mã tham chiếu ngân hàng<input maxLength={120} value={bankReference} onChange={(event) => setBankReference(event.target.value)} /></label>}
        <div className="admin-finance-actions">
          {selected.status === 'pending_review' && <>
            <button type="button" disabled={busy} onClick={() => void perform('approve')}>Phê duyệt</button>
            <button type="button" className="danger" disabled={busy || reason.trim().length < 3} onClick={() => void perform('reject')}>Từ chối và trả xu</button>
          </>}
          {selected.status === 'approved' && <>
            <button type="button" disabled={busy} onClick={() => void perform('processing')}>Bắt đầu chuyển tiền</button>
            <button type="button" className="danger" disabled={busy || reason.trim().length < 3} onClick={() => void perform('failed')}>Đánh dấu thất bại và trả xu</button>
          </>}
          {selected.status === 'processing' && <>
            <button type="button" disabled={busy || bankReference.trim().length < 1} onClick={() => void perform('paid')}>Đã chuyển tiền</button>
            <button type="button" className="danger" disabled={busy || reason.trim().length < 3} onClick={() => void perform('failed')}>Thất bại và trả xu</button>
          </>}
        </div>
      </>}
    </div>}
  </AdminSectionPage>
}
