import { ArrowRight, CalendarDays, Camera, Gift, Grid2x2, Heart, Image as ImageIcon, Gamepad2, House, Mountain, Sun } from 'lucide-react'
import type { ApiConnection, ApiEntry, ApiUser } from '../apiClient'
import type { Page } from '../routing'

type QuickActionId = 'love-letter' | 'memory' | 'gift' | 'countdown' | 'private-room' | 'daily-question'
type QuickAction = { id: QuickActionId; label: string; page: Page; icon: typeof House; entryType?: 'journal' | 'memory' | 'letter'; development?: boolean }
type Celebration = { kind: 'birthday' | 'anniversary'; title: string; date: Date; days: number }

type HomePageProps = {
  today: Date
  user: ApiUser
  connection: ApiConnection
  daysTogether: number | null
  connectedSince: string
  upcomingCelebration: Celebration | null
  pinnedQuickActions: QuickActionId[]
  chatUnreadCount: number
  quickActions: QuickAction[]
  recentMemories: ApiEntry[]
  initials: (name: string) => string
  greeting: (date: Date) => string
  onNavigate: (page: Page) => void
  onManageShortcuts: () => void
  onOpenQuickAction: (action: QuickAction) => void
  onCreateMemory: () => void
}

export default function HomePage({ today, user, connection, daysTogether, connectedSince, upcomingCelebration, pinnedQuickActions, chatUnreadCount, quickActions, recentMemories, initials, greeting, onNavigate, onManageShortcuts, onOpenQuickAction, onCreateMemory }: HomePageProps) {
  return <>
    <section className="home-greeting">
      <span className="greeting-icon" aria-hidden="true"><Sun size={28} fill="currentColor" /></span>
      <div><h1>{greeting(today)}, {user.displayName}!</h1><p>Mỗi ngày đều là một cơ hội để yêu thương nhiều hơn <Heart size={13} fill="currentColor" /></p></div>
    </section>

    <section className={`relationship-hero ${connection.relationship ? 'is-connected' : 'is-single'}`}>
      <div className="hero-decoration" aria-hidden="true">Together<br />Always ♡</div>
      {connection.relationship ? <>
        <div className="couple-profiles">
          <div className="couple-person"><span className="couple-avatar">{initials(user.displayName)}</span><strong>{user.displayName}</strong><small className={`presence-tag ${user.online ? 'is-online' : 'is-offline'}`}><span className="presence-dot" />{user.online ? 'Online' : 'Offline'}</small></div>
          <span className="couple-heart"><Heart size={17} fill="currentColor" /></span>
          <div className="couple-person"><span className="couple-avatar partner-avatar">{initials(connection.relationship.displayName)}</span><strong>{connection.relationship.displayName}</strong><small className={`presence-tag ${connection.relationship.online ? 'is-online' : 'is-offline'}`}><span className="presence-dot" />{connection.relationship.online ? 'Online' : 'Offline'}</small></div>
        </div>
        <div className="relationship-summary">
          {daysTogether !== null
            ? <div className="together-count"><span className="summary-icon"><Heart size={18} fill="currentColor" /></span><div><strong>{daysTogether} ngày</strong><small>Bên nhau từ {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${connectedSince}T00:00:00Z`))}</small></div></div>
            : <div className="together-count"><span className="summary-icon"><Heart size={18} fill="currentColor" /></span><div><strong>Hành trình của hai bạn</strong><small>Thêm ngày bắt đầu trong hồ sơ</small></div></div>}
          {upcomingCelebration && <div className="next-date"><CalendarDays size={19} /><div><small>{upcomingCelebration.kind === 'birthday' ? 'Sắp tới' : 'Kỷ niệm tiếp theo'}</small><strong>{upcomingCelebration.title}</strong><small>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(upcomingCelebration.date)} · Còn {upcomingCelebration.days} ngày</small></div></div>}
        </div>
        <button className="hero-action" onClick={() => onNavigate('journey')}>Xem hành trình tình yêu <ArrowRight size={16} /></button>
      </> : <>
        <div className="single-hero-copy"><span className="single-heart"><Heart size={26} fill="currentColor" /></span><p className="hero-kicker">MỘT GÓC RIÊNG CỦA BẠN</p><h2>Mọi câu chuyện đẹp đều bắt đầu từ một điều nhỏ bé.</h2><p>Kết nối với người thương để cùng lưu giữ hành trình của hai bạn.</p></div>
        <button className="hero-action" onClick={() => onNavigate('connections')}>Tìm người thương <ArrowRight size={16} /></button>
      </>}
    </section>

    <section className="home-section quick-section">
      <div className="section-heading"><h2><Grid2x2 size={19} /> Lối tắt nhanh</h2><button className="section-link" onClick={onManageShortcuts}>Xem tất cả <ArrowRight size={14} /></button></div>
      <div className="quick-links">
        {pinnedQuickActions.map((id) => quickActions.find((action) => action.id === id)).filter((action): action is QuickAction => Boolean(action)).map((action) => {
          const Icon = action.icon
          return <button key={action.id} onClick={() => onOpenQuickAction(action)}><span className="quick-icon"><Icon size={23} fill={action.id === 'daily-question' ? 'currentColor' : 'none'} /></span><span>{action.label}</span>{action.id === 'private-room' && chatUnreadCount > 0 && <small className="quick-unread-count">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</small>}{action.development && <small className="development-tag">Đang phát triển</small>}</button>
        })}
      </div>
    </section>

    <section className="home-section upcoming-section">
      <div className="section-heading"><h2><CalendarDays size={19} /> Sự kiện sắp tới</h2><button className="section-link" onClick={() => onNavigate('events')}>Xem tất cả <ArrowRight size={14} /></button></div>
      {upcomingCelebration ? <button className="upcoming-card" onClick={() => onNavigate('events')}>
        <span className="upcoming-icon">{upcomingCelebration.kind === 'birthday' ? <Gift size={22} /> : <Heart size={23} fill="currentColor" />}</span>
        <span className="upcoming-copy"><strong>{upcomingCelebration.title}</strong><small>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(upcomingCelebration.date)} · Còn {upcomingCelebration.days} ngày</small></span>
        <span className="upcoming-arrow"><ArrowRight size={18} /></span>
      </button> : <button className="upcoming-empty" onClick={() => onNavigate(connection.relationship ? 'profile' : 'connections')}>
        <span className="upcoming-icon"><Heart size={22} /></span>
        <span className="upcoming-copy"><strong>{connection.relationship ? 'Ngày đặc biệt của hai bạn' : 'Kết nối với người thương'}</strong><small>{connection.relationship ? 'Thêm ngày sinh trong hồ sơ để xem dịp gần nhất.' : 'Gửi lời mời kết nối khi bạn sẵn sàng.'}</small></span>
        <ArrowRight size={18} />
      </button>}
    </section>

    <section className="home-section memories-section">
      <div className="section-heading"><h2><ImageIcon size={19} /> Khoảnh khắc của chúng ta</h2><button className="section-link" onClick={() => onNavigate('memory')}>Xem tất cả <ArrowRight size={14} /></button></div>
      {recentMemories.length ? <div className="memory-strip">{recentMemories.map((entry, index) => (
        <button className="memory-card" key={entry.id} onClick={() => onNavigate('memory')}>
          {entry.image ? <img src={entry.image} alt="" /> : <span className={`memory-placeholder memory-placeholder-${index % 4}`}><Heart size={25} fill="currentColor" /></span>}
          <span className="memory-card-copy"><small>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${entry.date}T00:00:00Z`))}</small><strong>{entry.title}</strong></span>
        </button>
      ))}</div> : <button className="memories-empty" onClick={onCreateMemory}>
        <span className="empty-camera"><Camera size={22} /></span><span><strong>Chưa có kỷ niệm nào</strong><small>Hãy lưu khoảnh khắc đầu tiên của bạn.</small></span><ArrowRight size={17} />
      </button>}
    </section>

    <section className="home-section together-section">
      <div className="section-heading"><h2><Heart size={19} fill="currentColor" /> Dành cho hai người</h2><button className="section-link" onClick={() => onNavigate('activities')}>Xem thêm <ArrowRight size={14} /></button></div>
      <div className="together-links">
        <button onClick={() => onNavigate('questions')}><span className="together-icon"><Gamepad2 size={22} /></span><span><strong>Câu hỏi mỗi ngày</strong><small>Cùng trả lời để hiểu nhau hơn</small><small className="development-label">Đang phát triển</small></span><ArrowRight size={16} /></button>
        <button disabled><span className="together-icon"><Mountain size={22} /></span><span><strong>Thử thách tình yêu</strong><small>Hoàn thành thử thách tình yêu</small><small className="development-label">Đang phát triển</small></span><ArrowRight size={16} /></button>
      </div>
    </section>
  </>
}