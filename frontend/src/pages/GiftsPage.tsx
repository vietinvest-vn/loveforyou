import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ChevronRight, Coins, Gift, Heart, MessageSquareText } from 'lucide-react'
import { api, type ApiConnection, type ApiReceivedGift, type ApiWallet } from '../apiClient'
import type { Page } from '../routing'
import { giftItems, type GiftCategory, type GiftItem } from '../utils/gifts'

type CategoryFilter = 'all' | GiftCategory

const categoryOptions: { id: CategoryFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'Tất cả', icon: '🎁' },
  { id: 'rose', label: 'Hoa & Gấu', icon: '🧸' },
  { id: 'special', label: 'Đặc biệt', icon: '☆' },
  { id: 'sweet', label: 'Đồ ngọt', icon: '🍰' },
  { id: 'vip', label: 'VIP', icon: '♕' },
]

export default function GiftsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [wallet, setWallet] = useState<ApiWallet | null>(null)
  const [connection, setConnection] = useState<ApiConnection | null>(null)
  const [receivedGifts, setReceivedGifts] = useState<ApiReceivedGift[]>([])
  const [view, setView] = useState<'send' | 'received'>('send')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [selectedGiftId, setSelectedGiftId] = useState(giftItems[0].id)
  const [composeOpen, setComposeOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [inboxRefreshError, setInboxRefreshError] = useState('')
  const [sentGift, setSentGift] = useState<{ gift: GiftItem; recipient: string; message: string } | null>(null)
  const [openingGiftId, setOpeningGiftId] = useState('')
  const [redeemingGiftId, setRedeemingGiftId] = useState('')
  const [revealedGift, setRevealedGift] = useState<ApiReceivedGift | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([api.wallet(), api.connections(), api.receivedGifts()]).then(([nextWallet, nextConnection, nextGifts]) => {
      if (!active) return
      setWallet(nextWallet)
      setConnection(nextConnection)
      setReceivedGifts(nextGifts)
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!active) return
      setError(cause instanceof Error ? cause.message : 'Không thể tải cửa hàng quà.')
      setLoading(false)
    })
    return () => { active = false }
  }, [reloadKey])

  useEffect(() => {
    if (loading) return
    let active = true
    let refreshing = false

    async function refreshInbox() {
      if (refreshing || document.visibilityState !== 'visible') return
      refreshing = true
      try {
        const latestGifts = await api.receivedGifts()
        if (!active) return
        setReceivedGifts(latestGifts)
        setInboxRefreshError('')
      } catch (cause) {
        if (active) setInboxRefreshError(cause instanceof Error ? cause.message : 'Không thể cập nhật quà mới.')
      } finally {
        refreshing = false
      }
    }

    const timer = window.setInterval(() => { void refreshInbox() }, 5000)
    document.addEventListener('visibilitychange', refreshInbox)
    window.addEventListener('focus', refreshInbox)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshInbox)
      window.removeEventListener('focus', refreshInbox)
    }
  }, [loading])

  const partner = connection?.relationship
  const selectedGift = giftItems.find((item) => item.id === selectedGiftId) ?? giftItems[0]
  const visibleGifts = category === 'all' ? giftItems : giftItems.filter((item) => item.category === category)
  const formatCoins = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount)
  const initials = partner?.displayName.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi')).join('') ?? '?'
  const unopenedCount = receivedGifts.filter((gift) => !gift.openedAt).length

  function giftItemFor(id: string) {
    return giftItems.find((item) => item.id === id) ?? { id, name: 'Món quà', price: 0, art: '🎁', category: 'special' as const }
  }

  async function openGift(giftId: string) {
    setOpeningGiftId(giftId)
    setError('')
    try {
      const result = await api.openReceivedGift(giftId)
      setReceivedGifts((items) => items.map((gift) => gift.id === giftId ? result.gift : gift))
      setRevealedGift(result.gift)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể mở quà.')
    } finally {
      setOpeningGiftId('')
    }
  }

  async function redeemGift(gift: ApiReceivedGift) {
    if (redeemingGiftId) return
    setRedeemingGiftId(gift.id)
    setError('')
    try {
      const result = await api.redeemReceivedGift(gift.id)
      const updatedGift = { ...gift, redeemedAt: result.redeemedAt, redeemedCoins: result.redeemedCoins }
      setReceivedGifts((items) => items.map((item) => item.id === gift.id ? updatedGift : item))
      setRevealedGift((current) => current?.id === gift.id ? updatedGift : current)
      setWallet((current) => current ? {
        ...current,
        balance: result.balance,
        totalEarned: current.totalEarned + result.redeemedCoins,
      } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đổi quà thành xu.')
    } finally {
      setRedeemingGiftId('')
    }
  }

  async function sendGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!partner || !wallet || wallet.balance < selectedGift.price || sending) return
    setSending(true)
    setError('')
    try {
      const result = await api.sendGift(selectedGift.id, message)
      setWallet({ ...wallet, balance: result.balance })
      setSentGift({ gift: selectedGift, recipient: partner.displayName, message: message.trim() })
      setMessage('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi quà.')
    } finally {
      setSending(false)
    }
  }

  return <section className="gifts-page">
    <header className="gifts-heading">
      <span><Gift size={27} /></span>
      <div><h1>{view === 'send' ? 'Gửi quà' : 'Quà của tôi'}</h1><p><Heart size={13} fill="currentColor" /> Một món quà nhỏ, gửi trọn yêu thương <Heart size={13} fill="currentColor" /></p></div>
    </header>

    {loading ? <p className="gift-state-message" aria-live="polite">Đang tải cửa hàng quà...</p> : error && !wallet ? <div className="gift-state-message" role="alert"><span>{error}</span><button type="button" onClick={() => { setError(''); setLoading(true); setReloadKey((key) => key + 1) }}>Thử lại</button></div> : <>
      <section className="gift-recipient-bar">
        {partner ? <>
          <span className="gift-recipient-avatar">{initials}<span><Heart size={12} fill="currentColor" /></span></span>
          <div className="gift-recipient-copy"><strong>{partner.displayName}</strong><small className={partner.online ? 'is-online' : 'is-offline'}><span />{partner.online ? 'Đang online' : 'Đang offline'}</small><em>“Cảm ơn bạn đã luôn ở đây” <Heart size={12} fill="currentColor" /></em></div>
        </> : <div className="gift-no-recipient"><strong>Chưa có người nhận</strong><small>Kết nối tài khoản để gửi quà yêu thương.</small><button type="button" onClick={() => onNavigate('connections')}>Đi tới Kết nối <ChevronRight size={14} /></button></div>}
        <button type="button" className="gift-balance" onClick={() => onNavigate('wallet')} aria-label={`Số dư ${formatCoins(wallet?.balance ?? 0)} xu, mở Ví`}>
          <span><Coins size={21} /></span><small>Số xu của bạn</small><strong>{formatCoins(wallet?.balance ?? 0)} <ChevronRight size={17} /></strong>
        </button>
      </section>

      <nav className="gift-view-tabs" aria-label="Quà tặng">
        <button type="button" className={view === 'send' ? 'is-active' : ''} aria-pressed={view === 'send'} onClick={() => setView('send')}><Gift size={16} /> Gửi quà</button>
        <button type="button" className={view === 'received' ? 'is-active' : ''} aria-pressed={view === 'received'} onClick={() => setView('received')}><Heart size={16} /> Quà đã nhận{unopenedCount > 0 && <small>{unopenedCount}</small>}</button>
      </nav>

      {view === 'received' ? <section className="gift-inbox" aria-label="Quà đã nhận">
        {inboxRefreshError && <p className="gift-form-error" role="alert">{inboxRefreshError}</p>}
        {error && <p className="gift-form-error" role="alert">{error}</p>}
        {receivedGifts.length ? receivedGifts.map((gift) => {
          const item = giftItemFor(gift.giftId)
          return <article className={`gift-received-card ${gift.openedAt ? 'is-opened' : 'is-unopened'}`} key={gift.id}>
            <span className={gift.openedAt ? `gift-art gift-art-${item.category}` : 'gift-box-art'}>{gift.openedAt ? item.art : <Gift size={29} />}</span>
            <div className="gift-received-copy"><strong>{gift.giftName}</strong><small>Từ {gift.senderName}</small>{gift.message && <p>“{gift.message}”</p>}<time dateTime={gift.createdAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(gift.createdAt))}</time>{gift.redeemedAt && <small className="gift-redeemed-label">Đã đổi thành {formatCoins(gift.redeemedCoins)} xu</small>}</div>
            {!gift.openedAt ? <button type="button" disabled={Boolean(openingGiftId)} onClick={() => void openGift(gift.id)}>{openingGiftId === gift.id ? 'Đang mở...' : 'Mở quà'}</button> : gift.redeemedAt ? <button type="button" disabled>Đã đổi quà</button> : <button type="button" disabled={redeemingGiftId === gift.id} onClick={() => void redeemGift(gift)}>{redeemingGiftId === gift.id ? 'Đang đổi...' : `Đổi thành ${formatCoins(gift.coinValue)} xu`}</button>}
          </article>
        }) : <div className="gift-inbox-empty"><span><Gift size={26} /></span><strong>Bạn chưa nhận được quà</strong><small>Những món quà người thương gửi sẽ xuất hiện ở đây.</small></div>}
      </section> : <>
      {!composeOpen ? <>
      <nav className="gift-category-tabs" aria-label="Danh mục quà">
        {categoryOptions.map((option) => <button type="button" key={option.id} className={category === option.id ? 'is-active' : ''} aria-pressed={category === option.id} onClick={() => setCategory(option.id)}>
          <span aria-hidden="true">{option.icon}</span>{option.label}
        </button>)}
      </nav>

      <div className="gift-catalog">
        {visibleGifts.map((item) => <article className="gift-card" key={item.id}>
          {item.popular && <span className="gift-popular-tag">Phổ biến</span>}
          <button type="button" className="gift-select" onClick={() => { setSelectedGiftId(item.id); setError(''); setComposeOpen(true) }} aria-label={`Gửi ${item.name}`}>
            <span className={`gift-art gift-art-${item.category}`}>{item.art}</span>
            <strong>{item.name}</strong>
            <span className="gift-price"><Coins size={17} />{formatCoins(item.price)}</span>
            <span className="gift-card-action">Gửi quà</span>
          </button>
        </article>)}
      </div>
      </> : <>
      <button type="button" className="gift-compose-back" onClick={() => setComposeOpen(false)}><ArrowLeft size={17} /> Chọn quà khác</button>
      <div className="gift-compose-selected">
        <span className={`gift-art gift-art-${selectedGift.category}`}>{selectedGift.art}</span>
        <span><strong>{selectedGift.name}</strong><small><Coins size={15} /> {formatCoins(selectedGift.price)} xu</small></span>
      </div>

      <form className="gift-send-form" onSubmit={sendGift}>
        <label className="gift-message-label" htmlFor="gift-message"><MessageSquareText size={19} /><span>Lời nhắn <small>(tùy chọn)</small></span></label>
        <div className="gift-message-input-wrap"><textarea id="gift-message" value={message} onChange={(event) => setMessage(event.target.value.slice(0, 100))} maxLength={100} rows={2} placeholder="Gửi kèm lời nhắn dễ thương nhé..." /><small>{message.length}/100</small></div>
        {error && <p className="gift-form-error" role="alert">{error}</p>}
        {!partner && <p className="gift-form-hint">Bạn cần kết nối tài khoản trước khi gửi quà.</p>}
        {partner && wallet && wallet.balance < selectedGift.price && <p className="gift-form-hint">Bạn cần thêm {formatCoins(selectedGift.price - wallet.balance)} xu để gửi món quà này.</p>}
        <button className="gift-send-button" type="submit" disabled={!partner || !wallet || wallet.balance < selectedGift.price || sending}>
          <Gift size={21} />{sending ? 'Đang gửi quà...' : `Gửi ${selectedGift.name} · ${formatCoins(selectedGift.price)} xu`}
        </button>
        <p className="gift-footer-note"><Heart size={13} fill="currentColor" /> Món quà của bạn sẽ giúp tình cảm thêm gắn kết <Heart size={13} fill="currentColor" /></p>
      </form>
      </>}
      </>}
    </>}
    {revealedGift && <div className="gift-reveal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRevealedGift(null) }}>
      <section className="gift-reveal-dialog" role="dialog" aria-modal="true" aria-labelledby="gift-reveal-title">
        <button type="button" className="gift-reveal-close" onClick={() => setRevealedGift(null)} aria-label="Đóng">×</button>
        <span className="gift-reveal-spark gift-reveal-spark-one">♥</span><span className="gift-reveal-spark gift-reveal-spark-two">✦</span><span className="gift-reveal-spark gift-reveal-spark-three">♥</span>
        <div className="gift-reveal-stage">
          <span className="gift-reveal-burst" aria-hidden="true"><i>♥</i><i>✦</i><i>♥</i><i>✧</i><i>·</i><i>♥</i><i>✦</i><i>·</i></span>
          <span className={`gift-reveal-art gift-art-${giftItemFor(revealedGift.giftId).category}`}>{giftItemFor(revealedGift.giftId).art}</span>
        </div>
        <p>{revealedGift.senderName} gửi tặng bạn</p>
        <h2 id="gift-reveal-title">{revealedGift.giftName}</h2>
        {revealedGift.message && <blockquote>“{revealedGift.message}”</blockquote>}
        {revealedGift.redeemedAt ? <p className="gift-redeemed-label">Đã đổi {formatCoins(revealedGift.redeemedCoins)} xu vào Ví</p> : <button type="button" className="gift-reveal-redeem" disabled={redeemingGiftId === revealedGift.id} onClick={() => void redeemGift(revealedGift)}>{redeemingGiftId === revealedGift.id ? 'Đang đổi...' : `Đổi thành ${formatCoins(revealedGift.coinValue)} xu`}</button>}
        <button type="button" className="gift-reveal-confirm" onClick={() => setRevealedGift(null)}>Cảm ơn nhé <Heart size={15} fill="currentColor" /></button>
      </section>
    </div>}
    {sentGift && <div className="gift-reveal-backdrop gift-sent-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSentGift(null) }}>
      <section className="gift-reveal-dialog gift-sent-dialog" role="dialog" aria-modal="true" aria-labelledby="gift-sent-title">
        <span className="gift-reveal-spark gift-reveal-spark-one">♥</span><span className="gift-reveal-spark gift-reveal-spark-two">✦</span><span className="gift-reveal-spark gift-reveal-spark-three">♥</span>
        <div className="gift-reveal-stage">
          <span className="gift-reveal-burst" aria-hidden="true"><i>♥</i><i>✦</i><i>♥</i><i>✧</i><i>·</i><i>♥</i><i>✦</i><i>·</i></span>
          <span className={`gift-reveal-art gift-art-${sentGift.gift.category}`}>{sentGift.gift.art}</span>
        </div>
        <p>Một món quà nhỏ đã được gửi đến</p>
        <h2 id="gift-sent-title">{sentGift.recipient}</h2>
        <strong className="gift-sent-item">{sentGift.gift.name}</strong>
        {sentGift.message && <blockquote>“{sentGift.message}”</blockquote>}
        <span className="gift-sent-note">Trao gửi yêu thương <Heart size={14} fill="currentColor" /></span>
        <button type="button" className="gift-reveal-confirm" onClick={() => { setSentGift(null); setComposeOpen(false) }}>Dễ thương quá <Heart size={15} fill="currentColor" /></button>
      </section>
    </div>}
  </section>
}