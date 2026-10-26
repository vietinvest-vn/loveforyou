import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { api, type ApiBank, type ApiBankAccount } from '../apiClient'

export default function WalletBankAccountPage({ onBack }: { onBack: () => void }) {
  const [banks, setBanks] = useState<ApiBank[]>([])
  const [accounts, setAccounts] = useState<ApiBankAccount[]>([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [withdrawalCoins, setWithdrawalCoins] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [bankSearch, setBankSearch] = useState('')
  const [selectedBin, setSelectedBin] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showAccountForm, setShowAccountForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bankResult, accountResult, walletResult] = await Promise.all([
        api.banks(), api.bankAccounts(), api.wallet(),
      ])
      setBanks(bankResult.banks)
      setAccounts(accountResult.accounts)
      setWalletBalance(walletResult.balance)
      setSelectedAccountId((current) => current || accountResult.accounts.find((account) => account.isDefault)?.id || accountResult.accounts[0]?.id || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách ngân hàng.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!loading && accounts.length === 0) setShowAccountForm(true)
    if (!loading && accounts.length > 0) setShowAccountForm(false)
  }, [accounts.length, loading])

  const supportedBanks = useMemo(() => banks.filter((bank) => bank.lookupSupported === 1), [banks])
  const filteredBanks = supportedBanks.filter((bank) =>
    `${bank.name} ${bank.shortName} ${bank.code}`.toLocaleLowerCase('vi').includes(bankSearch.trim().toLocaleLowerCase('vi')))

  const saveAccount = async () => {
    if (!selectedBin || !/^[A-Za-z0-9]{4,25}$/.test(accountNumber.trim())) {
      setError('Hãy chọn ngân hàng và nhập số tài khoản hợp lệ.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const verification = await api.verifyBankAccount(selectedBin, accountNumber.trim())
      if (verification.status !== 'verified' || !verification.verificationId || !verification.accountName) {
        setError(verification.message ?? 'Chưa thể xác minh tài khoản. Vui lòng thử lại.')
        return
      }
      const result = await api.continueWithVerifiedBankAccount(verification.verificationId, selectedBin, accountNumber.trim())
      setAccounts((current) => [result.account, ...current.filter((item) => item.id !== result.account.id)])
      setSelectedAccountId(result.account.id)
      setShowAccountForm(false)
      setNotice(`Đã lưu tài khoản ${result.account.bankShortName} ${result.account.maskedAccountNumber} an toàn.`)
      setAccountNumber('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu tài khoản ngân hàng.')
    } finally {
      setBusy(false)
    }
  }

  const deleteAccount = async (account: ApiBankAccount) => {
    if (!window.confirm(`Xóa tài khoản ${account.bankShortName} ${account.maskedAccountNumber}?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.deleteBankAccount(account.id)
      setAccounts((current) => current.filter((item) => item.id !== account.id))
      if (selectedAccountId === account.id) setSelectedAccountId('')
      setNotice('Đã xóa tài khoản ngân hàng.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xóa tài khoản ngân hàng.')
    } finally {
      setBusy(false)
    }
  }

  const requestWithdrawal = async () => {
    const coins = Number(withdrawalCoins)
    if (!Number.isSafeInteger(coins) || coins < 100 || coins > walletBalance || !selectedAccountId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.createWithdrawal(selectedAccountId, coins)
      setWalletBalance((current) => current - coins)
      setWithdrawalCoins('')
      setNotice(`Đã gửi yêu cầu ${result.withdrawal.code}. Xu đang được giữ chờ Admin xử lý.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tạo yêu cầu rút tiền.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wallet-bank-page">
      <header className="wallet-flow-header">
        <button type="button" className="wallet-flow-back" onClick={onBack} aria-label="Quay lại Ví"><ArrowLeft size={20} /></button>
        <h1>Rút tiền</h1>
        <span aria-hidden="true" />
      </header>

      <div className="wallet-bank-card wallet-withdrawal-card">
        <h2>Tạo yêu cầu rút tiền</h2>
        {error && <div className="wallet-data-message error" role="alert">{error}<button type="button" onClick={() => selectedBin ? void saveAccount() : void load()}><RefreshCw size={15} /> {selectedBin ? 'Thử lưu lại' : 'Thử tải lại'}</button></div>}
        {notice && <p className="wallet-data-message success" role="status">{notice}</p>}
        {loading ? <p className="wallet-data-message">Đang tải dữ liệu ngân hàng…</p> : <>
          {accounts.length > 0 && <label>Tài khoản nhận tiền
            <select value={selectedAccountId} disabled={busy} onChange={(event) => setSelectedAccountId(event.target.value)}>
              {accounts.map((account) => <option value={account.id} key={account.id}>{account.bankShortName} · {account.maskedAccountNumber}{account.isDefault ? ' · Mặc định' : ''}</option>)}
            </select>
          </label>}
          <label>Số xu muốn rút
            <input type="number" min={100} max={walletBalance} step={1} value={withdrawalCoins} disabled={busy} onChange={(event) => setWithdrawalCoins(event.target.value)} placeholder={`Từ 100 đến ${walletBalance}`} />
          </label>
          <p className="wallet-bank-note">Số dư khả dụng: {new Intl.NumberFormat('vi-VN').format(walletBalance)} xu. Dự kiến nhận: {new Intl.NumberFormat('vi-VN').format((Number(withdrawalCoins) || 0) * 304)} VND.</p>
          <button type="button" className="wallet-flow-primary" disabled={busy || !selectedAccountId || !Number.isSafeInteger(Number(withdrawalCoins)) || Number(withdrawalCoins) < 100 || Number(withdrawalCoins) > walletBalance} onClick={() => void requestWithdrawal()}>
            {busy ? 'Đang gửi…' : 'Gửi yêu cầu rút tiền'}
          </button>
        </>}
      </div>

      <div className="wallet-bank-card">
        <h2><ShieldCheck size={19} /> Tài khoản ngân hàng</h2>
        {accounts.length > 0 && <div className="wallet-bank-saved-list">
          {accounts.map((account) => <article key={account.id}>
            <div><strong>{account.bankShortName} · {account.maskedAccountNumber}</strong>
              <span>{account.accountName}{account.isDefault ? ' · Mặc định' : ''}</span></div>
            <button type="button" disabled={busy} onClick={() => void deleteAccount(account)}>Xóa</button>
          </article>)}
        </div>}

        {!showAccountForm && !loading && accounts.length > 0 && <button type="button" className="wallet-flow-text-button" onClick={() => setShowAccountForm(true)}>+ Thêm tài khoản ngân hàng</button>}

        {showAccountForm && <>
          <label className="wallet-bank-search"><span>Tìm ngân hàng</span><span className="wallet-bank-search-input"><Search size={17} /><input value={bankSearch} onChange={(event) => setBankSearch(event.target.value)} placeholder="Tên ngân hàng hoặc tên viết tắt" /></span></label>
          <div className="wallet-bank-options" role="listbox" aria-label="Chọn ngân hàng hỗ trợ xác minh">
            {filteredBanks.map((bank) => <button type="button" disabled={busy} role="option" aria-selected={selectedBin === bank.bin} className={selectedBin === bank.bin ? 'is-selected' : ''} key={bank.bin} onClick={() => {
              setSelectedBin(bank.bin)
              setNotice('')
              setError('')
            }}>
              <img src={bank.logo} alt="" /><span><strong>{bank.shortName}</strong><small>{bank.name}</small></span>
              {selectedBin === bank.bin && <Check size={18} />}
            </button>)}
            {supportedBanks.length === 0 && <p className="wallet-data-message">Danh sách ngân hàng chưa khả dụng. Không thể xác minh khi thiếu dữ liệu tin cậy.</p>}
            {supportedBanks.length > 0 && filteredBanks.length === 0 && <p className="wallet-data-message">Không tìm thấy ngân hàng có hỗ trợ xác minh.</p>}
          </div>
          <label className="wallet-bank-account-number">Số tài khoản
            <input autoComplete="off" inputMode="text" maxLength={25} disabled={busy} value={accountNumber} onChange={(event) => {
              setAccountNumber(event.target.value.replace(/\s/g, '').slice(0, 25))
              setNotice('')
              setError('')
            }} placeholder="Nhập số tài khoản ngân hàng" />
          </label>
          <button type="button" className="wallet-flow-primary" disabled={busy || !selectedBin || !/^[A-Za-z0-9]{4,25}$/.test(accountNumber.trim()) || supportedBanks.length === 0} onClick={() => void saveAccount()}>
            {busy ? 'Đang lưu…' : 'Lưu tài khoản'}
          </button>
        </>}
      </div>
    </div>
  )
}
