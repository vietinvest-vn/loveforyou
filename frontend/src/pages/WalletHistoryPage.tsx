import { useEffect, useState } from 'react'
import { Copy, Gift, Heart } from 'lucide-react'
import { api, type ApiWalletTransaction } from '../apiClient'

export default function WalletHistoryPage() {
  const [transactions, setTransactions] = useState<ApiWalletTransaction[] | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    api.walletTransactions().then((result) => {
      if (active) setTransactions(result)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử giao dịch.')
    })
    return () => { active = false }
  }, [reloadKey])

  const formatCoins = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount)

  return <section className="wallet-transaction-panel wallet-history-page" aria-label="Lịch sử giao dịch">
    {error ? <div className="wallet-data-message" role="alert">
      <span>{error}</span>
      <button type="button" onClick={() => { setError(''); setReloadKey((key) => key + 1) }}>Thử lại</button>
    </div> : !transactions ? <p className="wallet-data-message" aria-live="polite">Đang tải lịch sử giao dịch...</p> : transactions.length ? transactions.map(({ id, code, item, amount, createdAt }) => {
      const isCredit = amount >= 0
      return <div key={id} className="wallet-transaction-row">
        <span className={`wallet-transaction-icon ${isCredit ? 'is-credit' : 'is-debit'}`}>
          {isCredit ? <Gift size={15} /> : <Heart size={15} fill="currentColor" />}
        </span>
        <div className="wallet-transaction-copy">
          <strong>{item}</strong>
          <time dateTime={createdAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(createdAt))}</time>
          {code && <button type="button" className="wallet-flow-text-button" onClick={() => void navigator.clipboard.writeText(code).catch(() => setError('Không thể sao chép mã giao dịch.'))}><Copy size={13} /> {code}</button>}
        </div>
        <strong className={`wallet-amount ${isCredit ? 'is-credit' : 'is-debit'}`}>{amount > 0 ? '+' : ''}{formatCoins(amount)} xu</strong>
      </div>
    }) : <p className="wallet-data-message">Chưa có giao dịch nào.</p>}
  </section>
}