import { ArrowRight, Bell, CalendarDays, Camera, ChevronRight, Clock3, Coins, Crown, Gift, Heart, HeartHandshake, Mail, MapPin, Settings, Sparkles, Star, Trophy, type LucideIcon } from 'lucide-react'
import type { ApiConnection, ApiLoveLevel, ApiProfile } from '../apiClient'
import type { Page } from '../routing'

type ProfileActivityItem = {
  id: string
  createdAt: string
  title: string
  description: string
  icon: LucideIcon
  page: Page
}

type ProfilePageProps = {
  profile: ApiProfile
  connection: ApiConnection
  loveLevel: ApiLoveLevel | null
  unreadCount: number
  daysTogether: number | null
  connectedSince: string
  activityItems: ProfileActivityItem[]
  today: Date
  initials: (name: string) => string
  relativeTime: (value: string, now: Date) => string
  onNavigate: (page: Page) => void
}

export default function ProfilePage({ profile, connection, loveLevel, unreadCount, daysTogether, connectedSince, activityItems, today, initials, relativeTime, onNavigate }: ProfilePageProps) {
  return <div className="profile-page">
    <section className="profile-overview">
      <div className="profile-top-actions">
        <button type="button" className="profile-icon-button" onClick={() => onNavigate('settings')} aria-label="Cài đặt"><Settings size={20} /></button>
        <button type="button" className="profile-icon-button notification-button" onClick={() => onNavigate('activities')} aria-label="Thông báo"><Bell size={20} />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
      </div>
      <div className="profile-overview-main">
        <span className="profile-avatar">{initials(profile.displayName)}<span><Camera size={13} /></span></span>
        <div className="profile-identity">
          <h1>{profile.displayName} <Heart size={15} fill="currentColor" /></h1>
          <p>@{profile.publicId}</p>
          <span className={`profile-relationship-badge ${connection.relationship ? 'is-connected' : ''}`}><Heart size={12} fill="currentColor" />{connection.relationship ? 'Đang yêu' : 'Chưa kết nối'}</span>
        </div>
      </div>
      <p className="profile-email"><Mail size={14} />{profile.email}</p>
      {profile.dateOfBirth && <p className="profile-birthday"><CalendarDays size={14} />Sinh nhật {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${profile.dateOfBirth}T00:00:00Z`))}</p>}
      <p className="profile-tagline">{profile.bio || 'Thêm đôi dòng giới thiệu về bạn'}</p>
      <button className="profile-edit-button" type="button" onClick={() => onNavigate('profile-edit')}><Settings size={15} />Chỉnh sửa hồ sơ</button>
    </section>

    <button type="button" className="profile-level-card" onClick={() => onNavigate('love-level')} aria-label="Mở chi tiết cấp độ tình yêu">
      <span className="profile-level-icon"><Heart size={25} fill="currentColor" /><Sparkles size={12} fill="currentColor" /></span>
      <div className="profile-level-copy">
        <strong>Cấp độ hiện tại</strong>
        <span>{loveLevel ? `LV.${loveLevel.currentLevel.number} · ${loveLevel.currentLevel.title}` : 'Kết nối người thương để bắt đầu'}</span>
        {loveLevel && <small className="profile-level-description">{loveLevel.currentLevel.description}</small>}
        <div className="profile-progress-track" role="progressbar" aria-label="Tiến trình đến cấp độ tiếp theo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loveLevel?.progressPercent ?? 0}><span style={{ width: `${loveLevel?.progressPercent ?? 0}%` }} /></div>
        <small>{loveLevel
          ? loveLevel.nextLevel
            ? `${loveLevel.progressPercent}% · Còn ${loveLevel.daysToNextLevel} ngày đến LV.${loveLevel.nextLevel.number} ${loveLevel.nextLevel.title}. ${loveLevel.nextLevel.description}`
            : `${loveLevel.progressPercent}% · Đã đạt cấp độ cao nhất hiện có`
          : 'Love Level đang phát triển'}</small>
      </div>
      <Crown size={43} className="profile-level-decoration" />
      <ChevronRight size={16} className="profile-level-chevron" />
    </button>

    <section className="profile-feature-grid" aria-label="Tính năng cá nhân">
      {[
        { title: 'Quà của tôi', subtitle: 'Gửi món quà yêu thương', icon: Gift, page: 'gifts' as Page, tone: 'gift' },
        { title: 'Xu của tôi', subtitle: 'Số dư và giao dịch', icon: Coins, page: 'wallet' as Page, tone: 'coins' },
        { title: 'Thành tích', subtitle: 'Đang phát triển', icon: Heart, page: 'events' as Page, tone: 'hearts' },
        { title: 'Đặc quyền', subtitle: 'Nâng cấp Premium', icon: Crown, page: 'premium' as Page, tone: 'crown' },
      ].map(({ title, subtitle, icon: Icon, page, tone }) => <button type="button" className="profile-feature-card" key={title} onClick={() => onNavigate(page)}>
        <span className={`profile-feature-icon profile-feature-icon-${tone}`}><Icon size={24} fill={title === 'Thành tích' ? 'currentColor' : 'none'} /></span>
        <strong>{title}</strong><small>{subtitle}</small><ChevronRight size={13} className="profile-feature-arrow" />
      </button>)}
    </section>

    <section className="profile-couple-section">
      <div className="profile-section-heading"><h2><Heart size={16} fill="currentColor" /> Cặp đôi của tôi</h2>{connection.relationship && <button type="button" onClick={() => onNavigate('connections')}>Chi tiết <ArrowRight size={14} /></button>}</div>
      {connection.relationship ? <button type="button" className="profile-couple-card" onClick={() => onNavigate('connections')}>
        <span className="profile-couple-avatar">{initials(connection.relationship.displayName)}</span>
        <span className="profile-couple-name"><strong>{connection.relationship.displayName}</strong><small>ID {connection.relationship.publicId}</small><span className="profile-relationship-badge is-connected"><Heart size={11} fill="currentColor" />Đang yêu</span></span>
        <span className="profile-couple-days"><Heart size={20} fill="currentColor" /><strong>{daysTogether ?? '—'} ngày</strong><small>{connectedSince ? `Từ ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${connectedSince}T00:00:00Z`))}` : 'Đã kết nối'}</small></span>
        <ChevronRight size={18} />
      </button> : <button type="button" className="profile-connect-card" onClick={() => onNavigate('connections')}><HeartHandshake size={22} /><span><strong>Kết nối với người thương</strong><small>Gửi lời mời khi bạn sẵn sàng</small></span><ArrowRight size={16} /></button>}
    </section>

    <section className="profile-recent-section">
      <div className="profile-section-heading"><h2><Clock3 size={16} /> Hoạt động gần đây</h2><button type="button" onClick={() => onNavigate('activities')}>Xem tất cả <ArrowRight size={14} /></button></div>
      {activityItems.length ? <div className="profile-activity-list">{activityItems.map((item) => {
        const Icon = item.icon
        return <button type="button" className="profile-activity-row" key={item.id} onClick={() => onNavigate(item.page)}>
          <span className="profile-activity-icon"><Icon size={17} /></span>
          <span className="profile-activity-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
          <time dateTime={item.createdAt}>{relativeTime(item.createdAt, today)}</time>
          <ChevronRight size={16} />
        </button>
      })}</div> : <p className="profile-empty">Hoạt động và nội dung mới của bạn sẽ hiện tại đây.</p>}
    </section>

    <section className="profile-achievements-section">
      <div className="profile-section-heading"><h2><Trophy size={16} /> Thành tích nổi bật</h2><button type="button" disabled>Xem tất cả <ArrowRight size={14} /></button></div>
      <div className="profile-achievement-grid">
        {[
          { label: 'Tình yêu', icon: Heart, tone: 'love' },
          { label: 'Cặp đôi', icon: Crown, tone: 'couple' },
          { label: 'Quà tặng', icon: Gift, tone: 'gift' },
          { label: 'Khám phá', icon: MapPin, tone: 'explore' },
          { label: 'Hoạt động', icon: Star, tone: 'activity' },
        ].map(({ label, icon: Icon, tone }) => <div className="profile-achievement-item" key={label}>
          <span className={`profile-achievement-icon profile-achievement-icon-${tone}`}><Icon size={19} fill={label === 'Tình yêu' || label === 'Hoạt động' ? 'currentColor' : 'none'} /></span><strong>{label}</strong><small>{label === 'Tình yêu'
            ? daysTogether !== null ? `${daysTogether} ngày yêu nhau` : 'Chưa kết nối'
            : label === 'Cặp đôi'
              ? loveLevel ? loveLevel.coupleRank <= 100 ? `TOP ${loveLevel.coupleRank}` : 'Bạn chưa lên được bảng xếp hạng' : 'Chưa kết nối'
              : 'Đang phát triển'}</small>
        </div>)}
      </div>
    </section>
  </div>
}