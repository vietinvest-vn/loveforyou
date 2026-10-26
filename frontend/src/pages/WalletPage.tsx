import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, BadgeDollarSign, Check, ChevronRight, Copy, Download, Gift, Heart, PiggyBank, Plus, Wallet2, X } from 'lucide-react'
import { api, type ApiDeposit, type ApiTopupPackage, type ApiWallet } from '../apiClient'
import type { Page } from '../routing'
import { optimizePaymentImage } from '../utils/image'
import { createVietQrImageUrl } from '../utils/vietqr'
import WalletBankAccountPage from './WalletBankAccountPage'

type QuickActionItem = { label: string; icon: typeof Plus; accent: string }
type TopupView = 'none' | 'packages' | 'payment' | 'history' | 'success' | 'bank-accounts'

const depositStatuses: Record<ApiDeposit['status'], string> = {
  awaiting_payment: 'Chờ thanh toán',
  awaiting_review: 'Hệ thống đang kiểm tra',
  info_requested: 'Cần bổ sung chứng từ',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hết hạn',
}

export default function WalletPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [wallet, setWallet] = useState<ApiWallet | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [topupView, setTopupView] = useState<TopupView>('none')
  const [topupPackages, setTopupPackages] = useState<ApiTopupPackage[]>([])
  const [paymentAvailable, setPaymentAvailable] = useState(false)
  const [deposits, setDeposits] = useState<ApiDeposit[]>([])
  const [activeDeposit, setActiveDeposit] = useState<ApiDeposit | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupBusy, setTopupBusy] = useState(false)
  const [receiptDraft, setReceiptDraft] = useState('')
  const [receiptUploaded, setReceiptUploaded] = useState(false)
  const [topupError, setTopupError] = useState('')
  const [topupNotice, setTopupNotice] = useState('')
  const [copyNotice, setCopyNotice] = useState('')
  const [depositSecondsRemaining, setDepositSecondsRemaining] = useState(0)
  const depositTimeRemainingPercent = Math.min(100, Math.max(0, depositSecondsRemaining / 900 * 100))

  useEffect(() => {
    let active = true
    const refresh = () => api.wallet().then((result) => {
      if (active) {
        setWallet(result)
        setError('')
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu ví.')
    })
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 20_000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [reloadKey])

  const loadTopupData = useCallback(async () => {
    setTopupLoading(true)
    setTopupError('')
    try {
      const [options, result] = await Promise.all([api.topupOptions(), api.walletDeposits()])
      setTopupPackages(options.packages)
      setPaymentAvailable(options.paymentMethods.length > 0)
      setDeposits(result.deposits)
      if (options.packages[0]) setSelectedPackageId((current) => current || options.packages[0].id)
    } catch (cause) {
      setTopupError(cause instanceof Error ? cause.message : 'Không thể tải thông tin nạp xu.')
    } finally {
      setTopupLoading(false)
    }
  }, [])

  useEffect(() => {
    if (topupView !== 'packages' && topupView !== 'history') return
    const timer = window.setTimeout(() => { void loadTopupData() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadTopupData, topupView])

  useEffect(() => {
    if (topupView !== 'payment' || activeDeposit?.status !== 'awaiting_payment') return
    let active = true
    let refreshing = false
    let lastRefreshAt = 0
    const updateCountdown = () => {
      const expiresAt = Date.parse(activeDeposit.expiresAt)
      const remaining = Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0
      setDepositSecondsRemaining(remaining)
    }
    const refreshExpiredDeposit = async () => {
      const now = Date.now()
      if (refreshing || now - lastRefreshAt < 5000 || Date.parse(activeDeposit.expiresAt) > now) return
      refreshing = true
      lastRefreshAt = now
      try {
        const result = await api.walletDeposit(activeDeposit.id)
        if (active) {
          setActiveDeposit(result.deposit)
          if (result.deposit.status === 'cancelled') {
            setReceiptDraft('')
            setReceiptUploaded(false)
            const depositsResult = await api.walletDeposits()
            if (active) setDeposits(depositsResult.deposits)
          }
        }
      } catch (cause) {
        if (active) setTopupError(cause instanceof Error ? cause.message : 'Không thể kiểm tra hạn mã nạp.')
      } finally {
        refreshing = false
      }
    }
    updateCountdown()
    const timer = window.setInterval(() => {
      updateCountdown()
      void refreshExpiredDeposit()
    }, 1000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [activeDeposit?.expiresAt, activeDeposit?.id, activeDeposit?.status, topupView])

  const formatCoins = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount)
  const formatVnd = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount)
  const formatDate = (value: string) => value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—'
  const formatCountdown = (totalSeconds: number) =>
    `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
  const depositQrImage = activeDeposit?.paymentMethod
    ? createVietQrImageUrl({
      bankBin: activeDeposit.paymentMethod.bankBin,
      accountNumber: activeDeposit.paymentMethod.accountNumber,
      accountHolder: activeDeposit.paymentMethod.accountHolder,
      amount: activeDeposit.package.priceVnd,
      transferContent: activeDeposit.paymentMethod.transferContent,
    })
    : ''
  const paymentWindowExpired = activeDeposit?.status === 'awaiting_payment' && depositSecondsRemaining === 0

  const openTopup = () => {
    setTopupError('')
    setTopupNotice('')
    setTopupView('packages')
  }
  const backToWallet = () => {
    setTopupView('none')
    setActiveDeposit(null)
    setReceiptDraft('')
    setReceiptUploaded(false)
    setTopupError('')
    setTopupNotice('')
  }
  const openDeposit = async (deposit: ApiDeposit) => {
    setTopupBusy(true)
    setTopupError('')
    try {
      const result = await api.walletDeposit(deposit.id)
      setActiveDeposit(result.deposit)
      setReceiptDraft(result.deposit.paymentProofImage ?? '')
      setReceiptUploaded(Boolean(result.deposit.paymentProofUploadedAt))
      setTopupView(result.deposit.status === 'awaiting_payment' || result.deposit.status === 'info_requested' ? 'payment' : 'history')
    } catch (cause) {
      setTopupError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết yêu cầu nạp.')
    } finally {
      setTopupBusy(false)
    }
  }
  const createDeposit = async () => {
    if (!selectedPackageId || !paymentAvailable) return
    setTopupBusy(true)
    setTopupError('')
    setTopupNotice('')
    try {
      const { deposit } = await api.createDeposit(selectedPackageId)
      const fullDeposit = await api.walletDeposit(deposit.id)
      setActiveDeposit(fullDeposit.deposit)
      setReceiptDraft(fullDeposit.deposit.paymentProofImage ?? '')
      setReceiptUploaded(Boolean(fullDeposit.deposit.paymentProofUploadedAt))
      setDeposits((current) => [deposit, ...current.filter((item) => item.id !== deposit.id)])
      setTopupView(fullDeposit.deposit.status === 'awaiting_payment' || fullDeposit.deposit.status === 'info_requested' ? 'payment' : 'history')
    } catch (cause) {
      setTopupError(cause instanceof Error ? cause.message : 'Không thể tạo yêu cầu nạp.')
    } finally {
      setTopupBusy(false)
    }
  }

  const chooseReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setTopupBusy(true)
    setTopupError('')
    setTopupNotice('Đang kiểm tra và tải ảnh chứng từ lên…')
    try {
      const optimizedImage = await optimizePaymentImage(file)
      if (!activeDeposit) throw new Error('Không tìm thấy yêu cầu nạp để tải chứng từ.')
      const result = await api.uploadDepositReceipt(activeDeposit.id, optimizedImage)
      const storedImage = result.paymentProofImage || optimizedImage
      setReceiptDraft(storedImage)
      setReceiptUploaded(true)
      setActiveDeposit((current) => current
        ? { ...current, paymentProofImage: storedImage, paymentProofUploadedAt: result.paymentProofUploadedAt }
        : current)
      setTopupNotice('Đã tải ảnh chứng từ lên. Nhấn “Tôi đã chuyển khoản” để gửi yêu cầu kiểm tra.')
    } catch (cause) {
      setTopupError(cause instanceof Error ? cause.message : 'Không thể đọc ảnh chứng từ.')
    } finally {
      setTopupBusy(false)
    }
  }

  const removeReceipt = async () => {
    if (!activeDeposit) return
    if (receiptUploaded) {
      setTopupBusy(true)
      setTopupError('')
      try {
        await api.removeDepositReceipt(activeDeposit.id)
      } catch (cause) {
        setTopupError(cause instanceof Error ? cause.message : 'Không thể xóa chứng từ.')
        setTopupBusy(false)
        return
      }
      setTopupBusy(false)
    }
    setReceiptDraft('')
    setReceiptUploaded(false)
    setActiveDeposit((current) => current ? { ...current, paymentProofImage: '', paymentProofUploadedAt: '' } : current)
    setTopupNotice('Đã xóa chứng từ.')
  }

  const refreshDeposits = async () => {
    const result = await api.walletDeposits()
    setDeposits(result.deposits)
    return result.deposits
  }

  const submitConfirmation = async () => {
    if (!activeDeposit || !receiptUploaded || topupBusy) return
    setTopupBusy(true)
    setTopupError('')
    setTopupNotice('')
    try {
      const { deposit } = await api.confirmDeposit(activeDeposit.id)
      setActiveDeposit((current) => current ? { ...current, ...deposit, paymentMethod: current.paymentMethod } : deposit)
      await refreshDeposits()
      setTopupView('success')
      setReloadKey((key) => key + 1)
    } catch (cause) {
      setTopupError(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu xác nhận.')
    } finally {
      setTopupBusy(false)
    }
  }

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyNotice(`Đã sao chép ${label}.`)
      window.setTimeout(() => setCopyNotice(''), 2500)
    } catch {
      setTopupError('Không thể sao chép. Vui lòng chọn và sao chép nội dung thủ công.')
    }
  }

  const actions: QuickActionItem[] = [
    { label: 'Nạp xu', icon: Plus, accent: 'pink' },
    { label: 'Đổi quà', icon: Gift, accent: 'rose' },
    { label: 'Lịch sử', icon: BadgeDollarSign, accent: 'peach' },
    { label: 'Rút tiền', icon: Wallet2, accent: 'lavender' },
  ]

  return (
    <section className="wallet-page">
      {topupView === 'bank-accounts' ? <WalletBankAccountPage onBack={() => setTopupView('none')} />
        : topupView === 'none' ? <>
        <header className="wallet-header"><div className="wallet-title-wrap"><h1>Ví</h1></div></header>
        <div className="wallet-hero">
          <div className="wallet-hero-copy">
            <div className="wallet-label-row"><span>Số dư hiện tại</span><span className="wallet-info-badge"><Heart size={12} fill="currentColor" /></span></div>
            <div className="wallet-balance-row"><span className="wallet-balance-icon"><PiggyBank size={27} /></span><strong>{wallet ? formatCoins(wallet.balance) : '—'}</strong><span className="wallet-chevron"><ArrowRight size={16} /></span></div>
            <small>{wallet ? `≈ ${formatVnd(wallet.balance * wallet.coinPriceVnd)}đ` : 'Đang tải quy đổi...'}</small>
          </div>
        </div>
        <div className="wallet-actions">
          {actions.map(({ label, icon: Icon, accent }) => <button type="button" key={label} className={`wallet-action ${accent}`}
            onClick={label === 'Nạp xu' ? openTopup : label === 'Đổi quà' ? () => onNavigate('gifts') : label === 'Lịch sử' ? () => onNavigate('wallet-history') : label === 'Rút tiền' ? () => setTopupView('bank-accounts') : undefined}>
            <span className="wallet-action-icon"><Icon size={18} /></span><span>{label}</span>
          </button>)}
        </div>
        <div className="wallet-summary">
          <div className="wallet-summary-card"><span>Xu đã dùng</span><strong className="is-negative">{wallet ? `-${formatCoins(wallet.totalSpent)}` : '—'}</strong></div>
          <div className="wallet-summary-card"><span>Xu tích lũy</span><strong className="is-positive">{wallet ? `+${formatCoins(wallet.totalEarned)}` : '—'}</strong></div>
        </div>
        <div className="wallet-transaction-panel">
          <div className="wallet-panel-header"><h2>Lịch sử giao dịch</h2><button type="button" onClick={() => onNavigate('wallet-history')}>Xem tất cả <ChevronRight size={14} /></button></div>
          {error ? <div className="wallet-data-message" role="alert"><span>{error}</span><button type="button" onClick={() => { setError(''); setReloadKey((key) => key + 1) }}>Thử lại</button></div>
            : !wallet ? <p className="wallet-data-message" aria-live="polite">Đang tải dữ liệu ví...</p>
              : wallet.transactions.length ? wallet.transactions.map(({ id, code, item, amount, createdAt }) => {
                const isCredit = amount >= 0
                return <div key={id} className="wallet-transaction-row">
                  <span className={`wallet-transaction-icon ${isCredit ? 'is-credit' : 'is-debit'}`}>{isCredit ? <Gift size={15} /> : <Heart size={15} fill="currentColor" />}</span>
                  <div className="wallet-transaction-copy"><strong>{item}</strong><time dateTime={createdAt}>{formatDate(createdAt)}</time>{code && <small>{code}</small>}</div>
                  <strong className={`wallet-amount ${isCredit ? 'is-credit' : 'is-debit'}`}>{amount > 0 ? '+' : ''}{formatCoins(amount)}</strong>
                </div>
              }) : <p className="wallet-data-message">Chưa có giao dịch nào.</p>}
        </div>
      </> : <div className="wallet-topup-flow">
        <header className="wallet-flow-header">
          <button type="button" className="wallet-flow-back" onClick={() => {
            if (topupView === 'payment') setTopupView('packages')
            else if (topupView === 'history' || topupView === 'success') setTopupView('packages')
            else backToWallet()
          }} aria-label="Quay lại"><ArrowLeft size={20} /></button>
          <h1>{topupView === 'packages' ? 'Chọn gói nạp' : topupView === 'payment' ? 'Thanh toán QR' : topupView === 'success' ? 'Đã gửi yêu cầu' : 'Lịch sử nạp tiền'}</h1>
          <button type="button" className="wallet-flow-close" onClick={backToWallet} aria-label="Về Ví"><X size={20} /></button>
        </header>

        {topupError && <p className="wallet-data-message error" role="alert">{topupError}</p>}
        {topupNotice && <p className="wallet-data-message success" role="status">{topupNotice}</p>}
        {copyNotice && <p className="wallet-data-message success" role="status">{copyNotice}</p>}
        {topupLoading && <p className="wallet-data-message">Đang tải dữ liệu từ máy chủ…</p>}

        {!topupLoading && topupView === 'packages' && <>
          <div className="wallet-topup-banner"><strong>Nạp xu ngay</strong><span>Chọn gói phù hợp, chuyển khoản bằng QR và nhận xu sau khi giao dịch được xác minh.</span></div>
          {!paymentAvailable && <p className="wallet-data-message error" role="alert">Chưa có phương thức thanh toán QR đang hoạt động. Vui lòng thử lại sau.</p>}
          {deposits.some((deposit) => ['awaiting_payment', 'awaiting_review', 'info_requested'].includes(deposit.status)) && <div className="wallet-open-history">
            <span>Bạn có yêu cầu nạp chưa hoàn tất. Tránh tạo thêm yêu cầu mới.</span>
            <button type="button" onClick={() => setTopupView('history')}>Xem yêu cầu hiện có</button>
          </div>}
          <h2 className="wallet-flow-section-title">Chọn gói nạp</h2>
          <div className="wallet-topup-packages">
            {topupPackages.map((item) => <button type="button" key={item.id} className={`wallet-topup-package ${selectedPackageId === item.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedPackageId(item.id)} aria-pressed={selectedPackageId === item.id}>
              <span className="wallet-package-coin"><Gift size={20} /></span>
              <span className="wallet-package-copy"><strong>{item.name}</strong><small>{formatCoins(item.coins)} xu + {formatCoins(item.bonusCoins)} xu thưởng</small><b>Tổng nhận {formatCoins(item.coins + item.bonusCoins)} xu</b></span>
              <span className="wallet-package-price">{formatVnd(item.priceVnd)}đ</span>
              <span className="wallet-package-radio">{selectedPackageId === item.id && <Check size={13} />}</span>
            </button>)}
            {topupPackages.length === 0 && <p className="wallet-data-message">Hiện chưa có gói nạp đang hoạt động.</p>}
          </div>
          <button type="button" className="wallet-flow-primary" disabled={!paymentAvailable || !selectedPackageId || topupBusy || deposits.some((deposit) => ['awaiting_payment', 'awaiting_review', 'info_requested'].includes(deposit.status))} onClick={() => void createDeposit()}>{topupBusy ? 'Đang tạo yêu cầu…' : 'Tiếp tục'}</button>
          <button type="button" className="wallet-flow-text-button" onClick={() => setTopupView('history')}>Xem lịch sử nạp</button>
        </>}

        {!topupLoading && topupView === 'payment' && activeDeposit?.status === 'cancelled' && <section className="wallet-deposit-success">
          <span><X size={30} /></span><h2>Mã nạp đã hết hạn</h2>
          <p>{activeDeposit.cancellationReason || 'Mã QR đã hết hạn sau 15 phút. Hãy tạo mã mới để tiếp tục nạp.'}</p>
          <button type="button" className="wallet-flow-primary" onClick={() => { setTopupView('packages'); void loadTopupData() }}>Tạo mã nạp mới</button>
          <button type="button" className="wallet-flow-secondary" onClick={() => setTopupView('history')}>Xem lịch sử nạp</button>
        </section>}

        {!topupLoading && topupView === 'payment' && activeDeposit && activeDeposit.status !== 'cancelled' && <div className="wallet-payment-screen">
          <section className="wallet-payment-card">
            <h2>{activeDeposit.package.name}</h2>
            {activeDeposit.status === 'awaiting_payment' && <p className="wallet-payment-expiry" role="timer" aria-live="off">
              Thời gian thanh toán còn lại <strong>{formatCountdown(depositSecondsRemaining)}</strong>
            </p>}
            {activeDeposit.status === 'awaiting_payment' && <div
              className="wallet-payment-progress"
              role="progressbar"
              aria-label="Thời gian thanh toán còn lại"
              aria-valuemin={0}
              aria-valuemax={900}
              aria-valuenow={depositSecondsRemaining}
            >
              <span style={{ width: `${depositTimeRemainingPercent}%` }} />
            </div>}
            <div className="wallet-payment-value"><span>Số tiền cần chuyển</span><strong>{formatVnd(activeDeposit.package.priceVnd)} VND</strong></div>
            <div className="wallet-payment-coins"><span>Xu cơ bản <b>{formatCoins(activeDeposit.package.coins)}</b></span><span>Xu thưởng <b>{formatCoins(activeDeposit.package.bonusCoins)}</b></span><span>Tổng xu dự kiến <b>{formatCoins(activeDeposit.package.coins + activeDeposit.package.bonusCoins)}</b></span></div>
            <dl className="wallet-payment-details">
              <div><dt>Mã yêu cầu</dt><dd>{activeDeposit.code}</dd></div>
              <div><dt>Thời gian tạo</dt><dd>{formatDate(activeDeposit.createdAt)}</dd></div>
              <div><dt>Trạng thái</dt><dd>{depositStatuses[activeDeposit.status]}</dd></div>
              {activeDeposit.paymentMethod && <>
                <div><dt>Ngân hàng</dt><dd>{activeDeposit.paymentMethod.bankName}</dd></div>
                <div><dt>Số tài khoản</dt><dd>{activeDeposit.paymentMethod.accountNumber}<button type="button" aria-label="Sao chép số tài khoản" onClick={() => void copyText(activeDeposit.paymentMethod?.accountNumber ?? '', 'số tài khoản')}><Copy size={15} /></button></dd></div>
                <div><dt>Chủ tài khoản</dt><dd>{activeDeposit.paymentMethod.accountHolder}</dd></div>
                <div><dt>Nội dung chuyển khoản</dt><dd>{activeDeposit.paymentMethod.transferContent}<button type="button" aria-label="Sao chép nội dung chuyển khoản" onClick={() => void copyText(activeDeposit.paymentMethod?.transferContent ?? '', 'nội dung chuyển khoản')}><Copy size={15} /></button></dd></div>
              </>}
            </dl>
            {activeDeposit.status === 'awaiting_payment' && paymentWindowExpired && <p className="wallet-data-message error" role="status">Đã hết thời gian thanh toán. Mã nạp đang được hủy, vui lòng chờ trong giây lát.</p>}
            {activeDeposit.paymentMethod && depositQrImage && !paymentWindowExpired && <div className="wallet-qr-card">
              <img src={depositQrImage} alt={`Mã QR VietQR thanh toán cho ${activeDeposit.code}`} />
              <a href={depositQrImage} download={`LoveForYou-${activeDeposit.code}-QR.svg`} className="wallet-flow-secondary"><Download size={16} /> Tải ảnh QR</a>
              <small>QR đã điền sẵn số tiền và nội dung chuyển khoản cho yêu cầu này.</small>
            </div>}
            {activeDeposit.paymentMethod && !depositQrImage && <p className="wallet-data-message error" role="alert">Không thể tạo QR chuyển khoản: thông tin ngân hàng thiếu hoặc không hợp lệ. Vui lòng liên hệ Admin.</p>}
            <div className="wallet-payment-instructions"><strong>Hướng dẫn thanh toán</strong><p>{activeDeposit.paymentMethod?.instructions}</p></div>
          </section>

          <section className="wallet-payment-card">
            <h2>Tải ảnh chứng từ</h2>
            <p>Ảnh chứng từ chỉ giúp Admin đối chiếu; không tự động xác nhận đã nhận tiền.</p>
            {activeDeposit.reviewMessage && <p className="wallet-data-message error">{activeDeposit.reviewMessage}</p>}
            {receiptDraft ? <div className="wallet-receipt-preview">
              <img src={receiptDraft} alt="Xem trước ảnh chứng từ chuyển khoản" />
              <div><span>{receiptUploaded ? 'Chứng từ đã tải lên' : 'Ảnh chưa tải lên'}</span>
                <button type="button" className="wallet-flow-secondary" disabled={topupBusy || paymentWindowExpired} onClick={() => document.getElementById('wallet-receipt-input')?.click()}>Thay ảnh</button>
                <button type="button" className="wallet-flow-danger" disabled={topupBusy || paymentWindowExpired} onClick={() => void removeReceipt()}>Xóa ảnh</button></div>
            </div> : <label className="wallet-receipt-picker"><Gift size={22} /><strong>Chọn ảnh chứng từ</strong><span>JPG, PNG hoặc WebP · Tối đa 600 KB sau tối ưu</span>
              <input id="wallet-receipt-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={topupBusy || paymentWindowExpired} onChange={(event) => void chooseReceipt(event)} /></label>}
            <button type="button" className="wallet-flow-primary" disabled={topupBusy || !receiptUploaded || paymentWindowExpired} onClick={() => void submitConfirmation()}>{topupBusy ? 'Đang xử lý…' : 'Tôi đã chuyển khoản'}</button>
            {!receiptUploaded && <small className="wallet-flow-hint">{topupBusy ? 'Đang tải chứng từ lên…' : 'Nút được bật sau khi ảnh chứng từ tải lên thành công.'}</small>}
          </section>
          <button type="button" className="wallet-flow-text-button" onClick={() => setTopupView('history')}>Lịch sử nạp của tôi</button>
        </div>}

        {!topupLoading && topupView === 'success' && activeDeposit && <section className="wallet-deposit-success">
          <span><Check size={30} /></span><h2>Hệ thống đang kiểm tra</h2>
          <p>Yêu cầu <strong>{activeDeposit.code}</strong> đã được gửi. Giao dịch đang được kiểm tra và xác nhận.</p>
          <div><strong>Mã yêu cầu</strong><b>{activeDeposit.code}</b><strong>Gói nạp</strong><b>{activeDeposit.package.name}</b><strong>Số tiền</strong><b>{formatVnd(activeDeposit.package.priceVnd)} VND</b><strong>Xu dự kiến</strong><b>{formatCoins(activeDeposit.package.coins + activeDeposit.package.bonusCoins)} xu</b><strong>Trạng thái</strong><b>Hệ thống đang kiểm tra</b></div>
          <button type="button" className="wallet-flow-primary" onClick={() => setTopupView('history')}>Xem lịch sử nạp</button>
          <button type="button" className="wallet-flow-secondary" onClick={backToWallet}>Quay về Ví</button>
        </section>}

        {!topupLoading && topupView === 'history' && <>
          <div className="wallet-history-toolbar"><p>Chỉ hiển thị yêu cầu thuộc tài khoản của bạn.</p><button type="button" className="wallet-flow-secondary" onClick={() => void loadTopupData()}>Làm mới</button></div>
          {deposits.length === 0 ? <p className="wallet-data-message">Bạn chưa có yêu cầu nạp nào.</p>
            : <div className="wallet-deposit-history">{deposits.map((deposit) => <button type="button" key={deposit.id} onClick={() => void openDeposit(deposit)} disabled={topupBusy}>
              <span className="wallet-history-item-main"><b>{deposit.code}</b><small>{deposit.package.name} · {formatVnd(deposit.package.priceVnd)} VND · {formatCoins(deposit.package.coins + deposit.package.bonusCoins)} xu</small><small>{formatDate(deposit.createdAt)}{deposit.reviewedAt ? ` · Duyệt ${formatDate(deposit.reviewedAt)}` : ''}</small>
                {deposit.reviewMessage && <small className="wallet-history-reason">Bổ sung: {deposit.reviewMessage}</small>}
                {deposit.rejectionReason && <small className="wallet-history-reason">Từ chối: {deposit.rejectionReason}</small>}</span>
              <strong className={`wallet-status-pill ${deposit.status}`}>{depositStatuses[deposit.status]}</strong>
            </button>)}</div>}
          <button type="button" className="wallet-flow-primary" onClick={() => setTopupView('packages')}>Nạp gói khác</button>
        </>}
      </div>}
    </section>
  )
}
