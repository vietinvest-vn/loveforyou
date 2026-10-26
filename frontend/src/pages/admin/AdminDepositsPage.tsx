import { useEffect, useMemo, useState } from 'react'
import { api, type ApiDeposit } from '../../apiClient'
import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

const statuses: Record<ApiDeposit['status'], string> = {
  awaiting_payment: 'Chờ chuyển khoản',
  awaiting_review: 'Chờ duyệt',
  info_requested: 'Cần bổ sung',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hết hạn',
}
const money = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount)

export default function AdminDepositsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [deposits, setDeposits] = useState<ApiDeposit[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [reason, setReason] = useState('')
  const [bankReference, setBankReference] = useState('')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selected = useMemo(() => deposits.find((item) => item.id === selectedId) ?? null, [deposits, selectedId])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      api.adminDeposits().then(({ deposits: rows }) => {
        if (active) {
          setDeposits(rows)
          if (!rows.some((item) => item.id === selectedId)) setSelectedId(rows[0]?.id ?? '')
        }
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải yêu cầu nạp.')
      }).finally(() => { if (active) setLoading(false) })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [selectedId])

  const perform = async (action: 'approve' | 'reject' | 'needs_info') => {
    if (!selected) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.reviewAdminDeposit(selected.id, action === 'approve'
        ? { action, verifiedReceived: verified, receivedAmountVnd: Number(receivedAmount), bankReference }
        : { action, reason })
      setNotice(action === 'approve' ? 'Đã duyệt và cộng xu vào ví.' : action === 'reject' ? 'Đã từ chối yêu cầu.' : 'Đã yêu cầu người dùng bổ sung chứng từ.')
      setReason('')
      setVerified(false)
      setBankReference('')
      await api.adminDeposits().then(({ deposits: rows }) => {
        setDeposits(rows)
        setSelectedId(rows.some((item) => item.id === selected.id) ? selected.id : rows[0]?.id ?? '')
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xử lý yêu cầu nạp.')
    } finally { setSaving(false) }
  }

  return (
    <AdminSectionPage page="admin-deposits" title="Quản lý nạp tiền" onNavigate={onNavigate}>
      <section className="admin-finance-section admin-deposit-layout">
        <div className="admin-finance-card">
          <h2>Yêu cầu nạp</h2>
          {error && <p className="admin-finance-message error" role="alert">{error}</p>}
          {notice && <p className="admin-finance-message success" role="status">{notice}</p>}
          {loading ? <p className="admin-finance-message">Đang tải…</p>
            : deposits.length === 0 ? <p className="admin-finance-message">Không có yêu cầu phù hợp.</p>
              : <div className="admin-finance-table-wrap"><table className="admin-finance-table">
                <thead><tr><th>Mã</th><th>Người dùng</th><th>Gói / tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
                <tbody>{deposits.map((deposit) => <tr key={deposit.id} className={selectedId === deposit.id ? 'is-selected' : ''}>
                  <td><button type="button" className="admin-finance-link" onClick={() => { setSelectedId(deposit.id); setReceivedAmount(String(deposit.package.priceVnd)); setReason(''); setVerified(false); setBankReference('') }}>{deposit.code}</button></td>
                  <td>{deposit.user?.displayName ?? 'Người dùng'}<small>{deposit.user?.publicId} · {deposit.user?.email}</small></td>
                  <td>{deposit.package.name}<small>{money(deposit.package.priceVnd)}đ</small></td>
                  <td>{statuses[deposit.status]}</td>
                  <td>{deposit.createdAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(deposit.createdAt)) : '—'}</td>
                </tr>)}</tbody>
              </table></div>}
        </div>
        {selected && <div className="admin-finance-card admin-deposit-review">
          <h2>Chi tiết yêu cầu {selected.code}</h2>
          <p>{selected.user?.displayName} · {selected.user?.publicId} · {selected.user?.email}</p>
          <p><strong>Gói:</strong> {selected.package.name} · {money(selected.package.priceVnd)} VND</p>
          <p><strong>Xu cơ bản / thưởng / tổng:</strong> {money(selected.package.coins)} / {money(selected.package.bonusCoins)} / {money(selected.package.coins + selected.package.bonusCoins)} xu</p>
          <p><strong>Trạng thái:</strong> {statuses[selected.status]}</p>
          <p><strong>Thời gian tạo:</strong> {selected.createdAt ? new Date(selected.createdAt).toLocaleString('vi-VN') : '—'}</p>
          {selected.reviewedBy && <p><strong>Người xử lý gần nhất:</strong> {selected.reviewedBy.displayName} · {selected.reviewedBy.publicId}</p>}
          <p><strong>Ngân hàng:</strong> {selected.paymentMethod?.bankName} ({selected.paymentMethod?.bankCode}) · {selected.paymentMethod?.accountNumber} · {selected.paymentMethod?.accountHolder}</p>
          <p><strong>Nội dung chuyển khoản:</strong> {selected.paymentMethod?.transferContent}</p>
          {selected.paymentProofImage ? <a href={selected.paymentProofImage} target="_blank" rel="noreferrer"><img className="admin-receipt-preview" src={selected.paymentProofImage} alt={`Chứng từ ${selected.code}`} /></a> : <p>Chưa tải ảnh chứng từ.</p>}
          <div className="admin-deposit-history"><strong>Lịch sử xử lý</strong>{selected.history.map((entry, index) => <p key={`${entry.status}-${entry.createdAt}-${index}`}>{statuses[entry.status as ApiDeposit['status']] ?? entry.status} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString('vi-VN') : ''}{entry.actor ? ` · ${entry.actor.displayName} (${entry.actor.publicId})` : ''}{entry.reason ? ` · ${entry.reason}` : ''}</p>)}</div>
          {selected.status === 'awaiting_payment' && <>
            <p className="admin-finance-message">Chưa thể duyệt trước khi người dùng chuyển khoản, tải chứng từ và xác nhận. Có thể từ chối yêu cầu với lý do.</p>
            <label>Lý do từ chối<textarea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="admin-finance-actions">
              <button type="button" disabled>Chưa thể duyệt</button>
              <button type="button" className="danger" disabled={saving || reason.trim().length < 3} onClick={() => void perform('reject')}>Từ chối yêu cầu</button>
            </div>
          </>}
          {selected.status === 'awaiting_review' || selected.status === 'info_requested' ? <>
            <label>Số tiền thực nhận (VND)<input type="number" min="0" value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} /></label>
            <label>Mã tham chiếu ngân hàng<input value={bankReference} onChange={(event) => setBankReference(event.target.value)} maxLength={120} /></label>
            <label className="admin-finance-check"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} /> Tôi đã đối chiếu giao dịch thực tế trên ngân hàng</label>
            <button type="button" disabled={saving || !verified || !bankReference.trim() || Number(receivedAmount) !== selected.package.priceVnd} onClick={() => void perform('approve')}>{saving ? 'Đang xử lý…' : 'Xác nhận tiền và duyệt'}</button>
            <label>Lý do từ chối / yêu cầu bổ sung<textarea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="admin-finance-actions">
              <button type="button" className="secondary" disabled={saving || reason.trim().length < 3} onClick={() => void perform('needs_info')}>Yêu cầu bổ sung</button>
              <button type="button" className="danger" disabled={saving || reason.trim().length < 3} onClick={() => void perform('reject')}>Từ chối</button>
            </div>
          </> : <p className="admin-finance-message">Yêu cầu đã được xử lý hoặc đang chờ người dùng thanh toán.</p>}
        </div>}
      </section>
    </AdminSectionPage>
  )
}
