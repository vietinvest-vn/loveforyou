import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type ApiTopupPackage } from '../../apiClient'
import type { Page } from '../../routing'
import AdminSectionPage from './AdminSectionPage'

type PackageForm = {
  name: string
  priceVnd: string
  bonusCoins: string
  enabled: boolean
  displayOrder: string
}
type PackagePayload = Omit<ApiTopupPackage, 'id' | 'coins' | 'purchases' | 'revenueVnd'>
const emptyForm: PackageForm = { name: '', priceVnd: '10000', bonusCoins: '0', enabled: true, displayOrder: '0' }
const money = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount)

export default function AdminTopupPackagesPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [packages, setPackages] = useState<ApiTopupPackage[]>([])
  const [coinPriceVnd, setCoinPriceVnd] = useState<number | null>(null)
  const [form, setForm] = useState<PackageForm>(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    try {
      const result = await api.adminTopupPackages()
      setPackages(result.packages)
      setCoinPriceVnd(result.coinPriceVnd)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách gói nạp.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const set = <K extends keyof PackageForm>(key: K, value: PackageForm[K]) => setForm((current) => ({ ...current, [key]: value }))
  const edit = (item: ApiTopupPackage) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      priceVnd: String(item.priceVnd),
      bonusCoins: String(item.bonusCoins),
      enabled: item.enabled,
      displayOrder: String(item.displayOrder),
    })
    setNotice('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const priceVnd = Number(form.priceVnd)
    const bonusCoins = Number(form.bonusCoins)
    const displayOrder = Number(form.displayOrder)
    if (!Number.isSafeInteger(priceVnd) || priceVnd < 1000 || priceVnd > 100_000_000
      || !Number.isSafeInteger(bonusCoins) || bonusCoins < 0 || bonusCoins > 1_000_000_000
      || !Number.isSafeInteger(displayOrder) || displayOrder < 0 || displayOrder > 10_000) {
      setError('Kiểm tra lại giá gói, xu thưởng và thứ tự hiển thị.')
      return
    }
    const payload: PackagePayload = { ...form, priceVnd, bonusCoins, displayOrder }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editingId) await api.updateAdminTopupPackage(editingId, payload)
      else await api.createAdminTopupPackage(payload)
      setNotice('Đã lưu gói nạp.')
      setEditingId('')
      setForm(emptyForm)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu gói nạp.') }
    finally { setSaving(false) }
  }
  const previewPrice = Number(form.priceVnd)
  const previewBonus = Number(form.bonusCoins)
  const canPreview = form.priceVnd !== '' && form.bonusCoins !== ''
    && Number.isSafeInteger(previewPrice) && previewPrice >= 1000
    && Number.isSafeInteger(previewBonus) && previewBonus >= 0
  return (
    <AdminSectionPage page="admin-topup-packages" title="Quản lý gói nạp" onNavigate={onNavigate}>
      <section className="admin-finance-section">
        <div className="admin-finance-card">
          <h2>{editingId ? 'Sửa gói nạp' : 'Tạo gói nạp'}</h2>
          <p>Quyền lợi được xác minh và chụp tại backend khi người dùng tạo yêu cầu nạp.</p>
          {error && <p className="admin-finance-message error" role="alert">{error}</p>}
          {notice && <p className="admin-finance-message success" role="status">{notice}</p>}
          <form className="admin-finance-form" onSubmit={(event) => void submit(event)}>
            <label className="admin-finance-wide">Tên gói<input required maxLength={80} value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
            <label className="admin-finance-wide">Giá gói nạp (VND)<input required type="number" min={1000} max={100000000} step={1} value={form.priceVnd} onChange={(event) => set('priceVnd', event.target.value)} /><small>{coinPriceVnd ? `Hệ thống tính xu theo tỷ lệ 1 xu = ${money(coinPriceVnd)} VND; phần lẻ được làm tròn xuống.` : 'Đang tải tỷ lệ tính xu từ máy chủ…'}</small></label>
            <label>Xu thưởng<input required type="number" min={0} max={1000000000} step={1} value={form.bonusCoins} onChange={(event) => set('bonusCoins', event.target.value)} /></label>
            <label>Thứ tự<input required type="number" min={0} max={10000} step={1} value={form.displayOrder} onChange={(event) => set('displayOrder', event.target.value)} /></label>
            <label className="admin-finance-check"><input type="checkbox" checked={form.enabled} onChange={(event) => set('enabled', event.target.checked)} /> Đang bán</label>
            <div className="admin-finance-wide admin-package-preview">
              {!coinPriceVnd ? 'Đang tải tỷ lệ tính xu từ máy chủ…'
                : canPreview ? (() => {
                  const coins = Math.floor(previewPrice / coinPriceVnd)
                  return <>Xem trước: {form.name || 'Gói nạp'} · {money(previewPrice)}đ → {money(coins)} xu cơ bản + {money(previewBonus)} xu thưởng = {money(coins + previewBonus)} xu</>
                })() : 'Nhập giá gói và xu thưởng hợp lệ để xem trước.'}
            </div>
            <div className="admin-finance-actions admin-finance-wide">
              <button type="submit" disabled={saving || !coinPriceVnd}>{saving ? 'Đang lưu…' : 'Lưu gói nạp'}</button>
              {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(''); setForm(emptyForm); setError('') }}>Hủy sửa</button>}
            </div>
          </form>
        </div>
        <div className="admin-finance-card">
          <h2>Các gói nạp</h2>
          {loading ? <p className="admin-finance-message">Đang tải…</p>
            : packages.length === 0 ? <p className="admin-finance-message">Chưa có gói nạp nào.</p>
              : <div className="admin-finance-table-wrap"><table className="admin-finance-table">
                <thead><tr><th>Gói</th><th>Giá</th><th>Xu</th><th>Lượt mua</th><th>Doanh thu VND</th><th>Trạng thái</th><th></th></tr></thead>
                <tbody>{packages.map((item) => <tr key={item.id}>
                  <td>{item.name}</td><td>{money(item.priceVnd)}đ</td><td>{money(item.coins)} + {money(item.bonusCoins)}</td>
                  <td>{item.purchases ?? 0}</td><td>{money(item.revenueVnd ?? 0)}đ</td>
                  <td>{item.enabled ? 'Đang bán' : 'Đã tắt'}</td><td><button type="button" onClick={() => edit(item)}>Sửa</button></td>
                </tr>)}</tbody>
              </table></div>}
          <button type="button" className="admin-finance-reload" onClick={() => { setError(''); void load() }}>Tải lại</button>
        </div>
      </section>
    </AdminSectionPage>
  )
}
