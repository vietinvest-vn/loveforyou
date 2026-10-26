import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, ChevronDown, RotateCcw, Search, X } from 'lucide-react'
import { api, type ApiBank, type ApiPaymentMethod } from '../../apiClient'
import type { Page } from '../../routing'
import { createVietQrImageUrl } from '../../utils/vietqr'
import AdminSectionPage from './AdminSectionPage'

type PaymentForm = Omit<ApiPaymentMethod, 'id' | 'createdAt' | 'updatedAt'>
const emptyForm: PaymentForm = {
  name: 'Chuyển khoản ngân hàng',
  bankName: '',
  bankCode: '',
  bankBin: '',
  accountHolder: '',
  accountNumber: '',
  paymentQrImage: '',
  transferTemplate: 'NAP {code}',
  instructions: 'Vui lòng chuyển đúng số tiền và nội dung chuyển khoản được hiển thị trong yêu cầu nạp.',
  enabled: true,
  isDefault: true,
}
const formatVnd = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount)
const maskAccount = (value: string) => value.length > 4 ? `${'•'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}` : value

export default function AdminPaymentQrPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [methods, setMethods] = useState<ApiPaymentMethod[]>([])
  const [banks, setBanks] = useState<ApiBank[]>([])
  const [form, setForm] = useState<PaymentForm>(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [bankSearch, setBankSearch] = useState('')
  const [bankPickerOpen, setBankPickerOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingMethods, setLoadingMethods] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const bankPickerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setError('')
    const [methodResult, bankResult] = await Promise.allSettled([api.adminPaymentMethods(), api.banks()])
    if (methodResult.status === 'rejected') throw methodResult.reason
    setMethods(methodResult.value.methods)
    if (bankResult.status === 'fulfilled') setBanks(bankResult.value.banks)
    else setError('Không thể tải danh sách ngân hàng. Hãy thử tải lại trước khi chọn ngân hàng.')
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void load().catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải cấu hình thanh toán.')
      }).finally(() => { if (active) setLoading(false) })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [load])

  useEffect(() => {
    if (!bankPickerOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !bankPickerRef.current?.contains(event.target)) setBankPickerOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBankPickerOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [bankPickerOpen])

  const update = <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const selectBank = (bank: ApiBank) => {
    setForm((current) => ({ ...current, bankName: bank.name, bankCode: bank.code, bankBin: bank.bin }))
    setBankSearch('')
    setBankPickerOpen(false)
    setError('')
  }

  const edit = (method: ApiPaymentMethod) => {
    setEditingId(method.id)
    setForm({
      name: method.name ?? method.bankName,
      bankName: method.bankName,
      bankCode: method.bankCode,
      bankBin: method.bankBin ?? '',
      accountHolder: method.accountHolder,
      accountNumber: method.accountNumber,
      paymentQrImage: '',
      transferTemplate: method.transferTemplate,
      instructions: method.instructions,
      enabled: method.enabled,
      isDefault: method.isDefault,
    })
    setBankPickerOpen(false)
    setBankSearch('')
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveForm = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const selectedBank = banks.find((bank) => bank.bin === form.bankBin)
    if (!selectedBank || selectedBank.name !== form.bankName || selectedBank.code !== form.bankCode) {
      setError('Hãy chọn ngân hàng hợp lệ từ danh sách.')
      return
    }
    if (!/^\d{4,40}$/.test(form.accountNumber.trim())) {
      setError('Số tài khoản chỉ được chứa từ 4 đến 40 chữ số.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = { ...form, accountNumber: form.accountNumber.trim(), paymentQrImage: '' }
      const response = editingId
        ? await api.updateAdminPaymentMethod(editingId, payload)
        : await api.createAdminPaymentMethod(payload)
      setEditingId(response.method.id)
      try {
        const latest = await api.adminPaymentMethods()
        setMethods(latest.methods)
        setNotice('Đã lưu cấu hình. QR VietQR sẽ được tạo riêng theo số tiền và nội dung của từng yêu cầu.')
      } catch {
        setNotice('Backend đã lưu cấu hình. Không thể tải lại danh sách; hãy thử tải lại.')
      }
      setBankPickerOpen(false)
      setBankSearch('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu cấu hình thanh toán.')
    } finally {
      setSaving(false)
    }
  }

  const changeMethod = async (method: ApiPaymentMethod, changes: Partial<PaymentForm>, message: string) => {
    if (saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.updateAdminPaymentMethod(method.id, changes)
      const latest = await api.adminPaymentMethods()
      setMethods(latest.methods)
      setNotice(message)
      if (editingId === method.id) {
        setForm((current) => ({ ...current, ...changes }))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật phương thức thanh toán.')
    } finally {
      setSaving(false)
    }
  }

  const filteredBanks = banks.filter((bank) =>
    `${bank.name} ${bank.shortName} ${bank.code} ${bank.bin}`.toLocaleLowerCase('vi')
      .includes(bankSearch.trim().toLocaleLowerCase('vi')))
  const selectedBank = banks.find((bank) => bank.bin === form.bankBin)
  const previewQrImage = createVietQrImageUrl({
    bankBin: form.bankBin,
    accountNumber: form.accountNumber.trim(),
    accountHolder: form.accountHolder,
    amount: 50000,
    transferContent: form.transferTemplate.replace('{code}', 'DEMO'),
  })
  return (
    <AdminSectionPage page="admin-payment-qr" title="Cấu hình thanh toán QR" onNavigate={onNavigate}>
      <section className="admin-finance-section admin-payment-qr-layout">
        <div className="admin-finance-card">
          <h2>{editingId ? 'Cập nhật phương thức thanh toán' : 'Thêm phương thức thanh toán'}</h2>
          <p>Thông tin được lưu vào MongoDB. Mỗi yêu cầu nạp mới giữ bản chụp riêng, không bị ảnh hưởng khi cấu hình thay đổi.</p>
          {error && <p className="admin-finance-message error" role="alert">{error}</p>}
          {notice && <p className="admin-finance-message success" role="status">{notice}</p>}
          {loading && <p className="admin-finance-message">Đang tải cấu hình…</p>}
          <form className="admin-finance-form" onSubmit={(event) => void saveForm(event)}>
            <label className="admin-finance-wide">Tên phương thức thanh toán
              <input required maxLength={100} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Chuyển khoản ngân hàng" />
            </label>

            <div className="admin-payment-bank-field admin-finance-wide" ref={bankPickerRef}>
              <span className="admin-payment-field-label">Ngân hàng nhận tiền</span>
              {selectedBank && !bankPickerOpen ? <div className="admin-payment-selected-bank">
                <img src={selectedBank.logo} alt="" />
                <span><strong>{selectedBank.name}</strong><small>{selectedBank.shortName} · BIN {selectedBank.bin}</small></span>
                <button type="button" className="secondary" disabled={saving} onClick={() => { setBankPickerOpen(true); setBankSearch('') }}>Thay đổi</button>
              </div> : <div className="admin-payment-bank-picker">
                <button type="button" className="admin-payment-bank-trigger" aria-expanded={bankPickerOpen} aria-haspopup="listbox" disabled={banks.length === 0 || saving} onClick={() => setBankPickerOpen((open) => !open)}>
                  <span>{selectedBank ? 'Chọn ngân hàng khác' : 'Tìm và chọn ngân hàng'}</span><ChevronDown size={17} />
                </button>
                {bankPickerOpen && <div className="admin-payment-bank-popover">
                  <label className="admin-payment-bank-search"><Search size={16} /><input autoFocus value={bankSearch} onChange={(event) => setBankSearch(event.target.value)} placeholder="Tên, tên viết tắt, mã hoặc BIN" aria-label="Tìm kiếm ngân hàng" /></label>
                  <div className="admin-bank-picker" role="listbox" aria-label="Danh sách ngân hàng">
                    {filteredBanks.map((bank) => <button type="button" role="option" aria-selected={form.bankBin === bank.bin} className={form.bankBin === bank.bin ? 'is-selected' : ''} key={bank.bin} onClick={() => selectBank(bank)}>
                      <img src={bank.logo} alt="" /><span><strong>{bank.name}</strong><small>{bank.shortName} · {bank.code} · BIN {bank.bin}</small></span>
                      {form.bankBin === bank.bin && <Check size={17} />}
                    </button>)}
                    {banks.length === 0 && <p className="admin-finance-message">Danh sách ngân hàng chưa khả dụng. Tải lại để thử lại.</p>}
                    {banks.length > 0 && filteredBanks.length === 0 && <p className="admin-finance-message">Không tìm thấy ngân hàng phù hợp.</p>}
                  </div>
                </div>}
              </div>}
            </div>

            <label>Tên chủ tài khoản<input required maxLength={100} value={form.accountHolder} onChange={(event) => update('accountHolder', event.target.value)} placeholder="Tên trên tài khoản ngân hàng" /></label>
            <label>Số tài khoản<input required inputMode="numeric" maxLength={40} value={form.accountNumber} onChange={(event) => update('accountNumber', event.target.value)} placeholder="Nhập số tài khoản" /></label>
            <label className="admin-finance-wide">Hướng dẫn thanh toán
              <textarea required maxLength={1000} rows={3} value={form.instructions} onChange={(event) => update('instructions', event.target.value)} />
            </label>

            <label className="admin-finance-check"><input type="checkbox" checked={form.enabled} onChange={(event) => update('enabled', event.target.checked)} /> Bật phương thức thanh toán</label>
            <label className="admin-finance-check"><input type="checkbox" checked={form.isDefault} disabled={!form.enabled} onChange={(event) => update('isDefault', event.target.checked)} /> Đặt làm phương thức mặc định</label>
            <div className="admin-finance-actions admin-finance-wide admin-payment-form-actions">
              <button type="submit" disabled={saving || loading || banks.length === 0}>{saving ? 'Đang lưu…' : 'Lưu cấu hình'}</button>
              <button type="button" className="secondary" disabled={saving} onClick={() => setPreviewOpen(true)}>Xem trước thanh toán</button>
              {editingId && <button type="button" className="secondary" disabled={saving} onClick={() => { setEditingId(''); setForm(emptyForm); setBankSearch(''); setBankPickerOpen(false); setError(''); setNotice('') }}><RotateCcw size={15} /> Thêm phương thức mới</button>}
            </div>
          </form>
        </div>

        <div className="admin-finance-card">
          <h2>Phương thức hiện có</h2>
          <p>Tắt phương thức để lưu trữ; không xóa bản ghi đang được yêu cầu nạp cũ tham chiếu.</p>
          {loading ? <p className="admin-finance-message">Đang tải…</p>
            : methods.length === 0 ? <div className="admin-payment-empty">
              <p className="admin-finance-message">Chưa có phương thức thanh toán nào.</p>
              <button type="button" className="admin-finance-reload" onClick={() => { setEditingId(''); setForm(emptyForm); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Thêm phương thức thanh toán</button>
            </div>
              : <div className="admin-finance-list">{methods.map((method) => {
                const bank = banks.find((item) => item.bin === method.bankBin)
                const maskedAccount = maskAccount(method.accountNumber)
                return <article className="admin-finance-list-item admin-payment-method-card" key={method.id}>
                  {bank ? <img src={bank.logo} alt="" /> : <div className="admin-payment-method-icon">{method.bankCode.slice(0, 3)}</div>}
                  <div className="admin-payment-method-details">
                    <strong>{method.name || method.bankName}</strong>
                    <span>{method.bankName} · {method.accountHolder}</span>
                    <span>{maskedAccount} · {method.enabled ? 'Đang bật' : 'Đã tắt'}{method.isDefault ? ' · Mặc định' : ''}</span>
                  </div>
                  <div className="admin-payment-method-actions">
                    <button type="button" className="secondary" disabled={saving} onClick={() => edit(method)}>Sửa</button>
                    <button type="button" className="secondary" disabled={saving} onClick={() => void changeMethod(method, { enabled: !method.enabled, ...(!method.enabled && !method.isDefault ? {} : { isDefault: false }) }, method.enabled ? 'Đã tắt và lưu trữ phương thức.' : 'Đã bật phương thức.')}>{method.enabled ? 'Tắt' : 'Bật'}</button>
                    {!method.isDefault && method.enabled && <button type="button" className="secondary" disabled={saving} onClick={() => void changeMethod(method, { isDefault: true }, 'Đã đặt làm phương thức mặc định.')}>Đặt mặc định</button>}
                  </div>
                </article>
              })}</div>}
          <button type="button" className="admin-finance-reload" disabled={loadingMethods} onClick={() => {
            setLoadingMethods(true)
            void load()
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách phương thức.'))
              .finally(() => setLoadingMethods(false))
          }}>{loadingMethods ? 'Đang tải…' : 'Tải lại cấu hình và ngân hàng'}</button>
        </div>
      </section>

      {previewOpen && <div className="admin-payment-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false) }}>
        <section className="admin-payment-preview-modal" role="dialog" aria-modal="true" aria-labelledby="admin-payment-preview-title">
          <header><h2 id="admin-payment-preview-title">Xem trước thanh toán</h2><button type="button" aria-label="Đóng xem trước" onClick={() => setPreviewOpen(false)}><X size={19} /></button></header>
          <p className="admin-finance-message">Bản xem trước minh họa, chưa phải yêu cầu nạp thực tế.</p>
          <div className="admin-payment-preview-content">
            <strong>{form.name || 'Chuyển khoản ngân hàng'}</strong>
            {previewQrImage && <img className="admin-payment-qr-preview" src={previewQrImage} alt="QR VietQR xem trước" />}
            <p><b>Ngân hàng:</b> {form.bankName || 'Chưa chọn'}</p>
            <p><b>Chủ tài khoản:</b> {form.accountHolder || 'Chưa nhập'}</p>
            <p><b>Số tài khoản:</b> {form.accountNumber || 'Chưa nhập'}</p>
            <p><b>Số tiền mẫu:</b> {formatVnd(50000)} VND</p>
          </div>
          <button type="button" className="admin-payment-preview-close" onClick={() => setPreviewOpen(false)}>Đóng</button>
        </section>
      </div>}
    </AdminSectionPage>
  )
}
