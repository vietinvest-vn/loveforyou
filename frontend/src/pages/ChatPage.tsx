import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowUp, Check, CheckCheck, ChevronRight, Heart, LockKeyhole, MessageCircle, Star } from 'lucide-react'
import type { ApiChatMessage, ApiConnection } from '../apiClient'
import type { Page } from '../routing'

type ChatPageProps = {
  connection: ApiConnection
  messages: ApiChatMessage[]
  partnerTyping: boolean
  loading: boolean
  sending: boolean
  onExit: () => void
  onMarkRead: () => void
  onNavigate: (page: Page) => void
  onSend: (text: string) => Promise<boolean>
  onTypingStatus: (typing: boolean) => void
}

export default function ChatPage({ connection, messages, partnerTyping, loading, sending, onExit, onMarkRead, onNavigate, onSend, onTypingStatus }: ChatPageProps) {
  const [draft, setDraft] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favorites'>('all')
  const [threadState, setThreadState] = useState<{ relationshipId: string | null; open: boolean }>({ relationshipId: null, open: false })
  const [favoriteState, setFavoriteState] = useState<{ relationshipId: string | null; value: boolean }>({ relationshipId: null, value: false })
  const [todayDate] = useState(() => new Date().toDateString())
  const chatThread = useRef<HTMLElement>(null)
  const typingTimer = useRef<number | null>(null)
  const lastTypingSentAt = useRef(0)
  const partner = connection.relationship
  const showConversation = Boolean(partner && threadState.relationshipId === partner.id && threadState.open)
  const favorite = Boolean(partner && (favoriteState.relationshipId === partner.id
    ? favoriteState.value
    : window.localStorage.getItem(`lfy-chat-favorite-${partner.id}`) === 'true'))
  const latestMessage = messages[messages.length - 1]
  const unreadCount = messages.filter((message) => message.sender === 'partner' && !message.readAt).length
  const unreadIncomingIds = messages.filter((message) => message.sender === 'partner' && !message.readAt).map((message) => message.id).join(',')
  const partnerInitials = partner?.displayName.trim().split(/\s+/).slice(-2).map((name) => name[0]).join('').toLocaleUpperCase('vi') ?? '?'
  const filteredPartner = partner
    && (activeFilter === 'all'
      || activeFilter === 'unread' && unreadCount > 0
      || activeFilter === 'favorites' && favorite)

  useEffect(() => {
    const thread = chatThread.current
    if (showConversation && thread) thread.scrollTop = thread.scrollHeight
  }, [messages.length, partnerTyping, showConversation])

  const markMessagesRead = useEffectEvent(() => onMarkRead())

  useEffect(() => {
    if (showConversation && unreadIncomingIds) markMessagesRead()
  }, [showConversation, unreadIncomingIds])

  useEffect(() => () => {
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending || !partner) return
    if (await onSend(text)) {
      setDraft('')
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
      onTypingStatus(false)
    }
  }

  function updateDraft(value: string) {
    setDraft(value)
    if (!value.trim()) {
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
      onTypingStatus(false)
      return
    }
    if (Date.now() - lastTypingSentAt.current > 2_500) {
      lastTypingSentAt.current = Date.now()
      onTypingStatus(true)
    }
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => onTypingStatus(false), 1_800)
  }

  function toggleFavorite() {
    if (!partner) return
    const next = !favorite
    window.localStorage.setItem(`lfy-chat-favorite-${partner.id}`, String(next))
    setFavoriteState({ relationshipId: partner.id, value: next })
  }

  function openThread() {
    if (partner) setThreadState({ relationshipId: partner.id, open: true })
  }

  function closeThread() {
    setThreadState({ relationshipId: partner?.id ?? null, open: false })
  }

  function formatTime(value?: string) {
    if (!value) return ''
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  }

  function formatDay(value: string) {
    const date = new Date(value)
    if (date.toDateString() === todayDate) return 'Hôm nay'
    return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  }

  return <div className={`chat-page ${showConversation && partner ? 'is-thread-open' : 'is-inbox-open'}`}>
    {!showConversation || !partner ? <>
      <header className="chat-inbox-heading">
        <button type="button" className="chat-back-button" onClick={onExit} aria-label="Thoát khỏi tin nhắn" title="Thoát khỏi tin nhắn"><ArrowLeft size={20} /></button>
        <span className="chat-heading-icon"><MessageCircle size={20} fill="currentColor" /></span>
        <h1>Tin nhắn</h1>
      </header>
      {partner ? <>
        <div className="chat-filter-tabs" role="tablist" aria-label="Lọc tin nhắn">
          {([['all', 'Tất cả'], ['unread', 'Chưa đọc'], ['favorites', 'Yêu thích']] as const).map(([filter, label]) => <button key={filter} type="button" role="tab" aria-selected={activeFilter === filter} onClick={() => setActiveFilter(filter)}>{label}{filter === 'unread' && unreadCount > 0 ? ` ${unreadCount}` : ''}</button>)}
        </div>
        <section className="chat-inbox-list" aria-label="Danh sách cuộc trò chuyện">
          {filteredPartner ? <article className="chat-inbox-row">
            <button type="button" className="chat-inbox-open" onClick={openThread}>
              <span className="chat-avatar chat-avatar-partner">{partnerInitials}</span>
              <span className="chat-inbox-copy"><strong>{partner.displayName}</strong><small>{loading ? 'Đang tải tin nhắn...' : latestMessage ? `${latestMessage.sender === 'me' ? 'Bạn: ' : ''}${latestMessage.text}` : 'Bắt đầu câu chuyện của hai bạn'}</small></span>
              <span className="chat-inbox-meta"><time>{formatTime(latestMessage?.createdAt)}</time>{unreadCount > 0 && <span className="chat-unread-count">{unreadCount}</span>}<ChevronRight size={18} /></span>
            </button>
          </article> : <p className="chat-empty">{activeFilter === 'favorites' ? 'Chưa có cuộc trò chuyện yêu thích.' : activeFilter === 'unread' ? 'Bạn đã đọc hết tin nhắn.' : 'Không tìm thấy cuộc trò chuyện.'}</p>}
        </section>
      </> : <section className="chat-locked">
        <span><LockKeyhole size={27} /></span>
        <h2>Chat dành cho hai bạn đã kết nối</h2>
        <p>Kết nối với người thương trước để bắt đầu nhắn tin riêng tư.</p>
        <button type="button" onClick={() => onNavigate('connections')}>Đi tới Kết nối</button>
      </section>}
    </> : <>
      <header className="chat-thread-heading">
        <button type="button" className="chat-back-button" onClick={closeThread} aria-label="Quay lại hộp thư"><ArrowLeft size={21} /></button>
        <span className="chat-avatar chat-avatar-partner chat-thread-avatar">{partnerInitials}</span>
        <div className="chat-thread-person">
          <strong>{partner.displayName}</strong>
          <span className={`chat-thread-status ${partner.online ? 'is-online' : 'is-offline'}`}>
            <span className={`chat-presence ${partner.online ? 'is-online' : 'is-offline'}`} aria-hidden="true"><span className="chat-presence-dot" /></span>
            {partner.online ? 'Đang hoạt động' : 'Đã offline'}
          </span>
        </div>
        <button type="button" className={`chat-heading-action ${favorite ? 'is-favorite' : ''}`} onClick={toggleFavorite} aria-label={favorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'} aria-pressed={favorite} title={favorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}><Star size={19} fill={favorite ? 'currentColor' : 'none'} /></button>
      </header>
      <section className="chat-thread" ref={chatThread} aria-label="Tin nhắn">
        <span className="chat-heart-decoration chat-heart-one"><Heart size={30} /></span><span className="chat-heart-decoration chat-heart-two"><Heart size={24} /></span><span className="chat-heart-decoration chat-heart-three"><Heart size={40} /></span>
        {loading ? <p className="chat-empty">Đang tải tin nhắn...</p> : messages.length ? <div className="chat-message-list" role="log" aria-live="polite">
          {messages.map((message, index) => {
            const previousMessage = messages[index - 1]
            const startsNewDay = !previousMessage || new Date(previousMessage.createdAt).toDateString() !== new Date(message.createdAt).toDateString()
            return <div className="chat-message-group" key={message.id}>
              {startsNewDay && <div className="chat-day-divider"><span>{formatDay(message.createdAt)}</span></div>}
              <article className={`chat-message ${message.sender === 'me' ? 'is-mine' : 'is-partner'}`}>
                {message.sender === 'partner' && <span className="chat-avatar chat-message-avatar">{partnerInitials}</span>}
                <div className="chat-message-bubble"><p>{message.text}</p><div className="chat-message-meta"><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>{message.sender === 'me' && <span className={`chat-message-status ${message.readAt ? 'is-read' : ''}`}>{message.readAt ? <CheckCheck size={14} /> : <Check size={14} />}{message.readAt ? 'Đã xem' : 'Đã gửi'}</span>}</div></div>
              </article>
            </div>
          })}
          {partnerTyping && <div className="chat-typing-indicator" role="status" aria-label={`${partner.displayName} đang nhập`}><span><i /><i /><i /></span></div>}
        </div> : <p className="chat-empty">Chưa có tin nhắn. Hãy gửi lời chào đầu tiên.</p>}
      </section>
      <form className="chat-composer" onSubmit={submit}>
        <textarea value={draft} onChange={(event) => updateDraft(event.target.value)} maxLength={2000} rows={1} aria-label="Tin nhắn" placeholder={`Nhắn tin cho ${partner.displayName}...`} />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Gửi tin nhắn">{sending ? '…' : <ArrowUp size={20} />}</button>
      </form>
    </>}
  </div>
}