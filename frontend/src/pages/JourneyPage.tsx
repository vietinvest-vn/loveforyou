import { useState } from 'react'
import { ArrowLeft, CalendarDays, Camera, ChevronRight, Crown, Heart, Image as ImageIcon, ListFilter, Plus, Settings } from 'lucide-react'
import type { ApiConnection, ApiEntry, ApiLoveLevel, ApiProfile } from '../apiClient'
import type { Page } from '../routing'

type JourneyItem = {
  id: string
  date: string
  title: string
  text: string
  kind: 'relationship' | 'memory' | 'journal' | 'letter' | 'milestone'
  image?: string | null
  badge?: string
}

type JourneyPageProps = {
  profile: ApiProfile
  connection: ApiConnection
  entries: ApiEntry[]
  loveLevel: ApiLoveLevel | null
  connectedSince: string
  daysTogether: number | null
  initials: (name: string) => string
  onBack: () => void
  onNavigate: (page: Page) => void
  onCreateMemory: () => void
}

export default function JourneyPage({ profile, connection, entries, loveLevel, connectedSince, daysTogether, initials, onBack, onNavigate, onCreateMemory }: JourneyPageProps) {
  const [favorite, setFavorite] = useState(false)
  const [newestFirst, setNewestFirst] = useState(true)
  const partner = connection.relationship
  const heroImage = entries.find((entry) => entry.type === 'memory' && entry.image)?.image || '/memories-sunset.svg'
  const timeline: JourneyItem[] = [
    ...(connectedSince ? [{ id: 'relationship-start', date: connectedSince, title: 'Ngày đầu bên nhau', text: 'Khoảnh khắc bắt đầu hành trình của hai bạn.', kind: 'relationship' as const, badge: 'Kỷ niệm đầu tiên' }] : []),
    ...entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: entry.title,
      text: entry.text,
      kind: entry.type,
      image: entry.image,
      badge: entry.type === 'memory' ? 'Kỷ niệm' : entry.type === 'letter' ? 'Lá thư' : 'Nhật ký',
    })),
    ...(loveLevel?.milestones.map((milestone) => ({
      id: milestone.id,
      date: milestone.date,
      title: milestone.title,
      text: milestone.message,
      kind: 'milestone' as const,
      badge: milestone.level ? `LV.${milestone.level}` : 'Cột mốc',
    })) ?? []),
  ].sort((left, right) => right.date.localeCompare(left.date))
  const visibleTimeline = newestFirst ? timeline : [...timeline].reverse()

  return <div className="journey-page">
    <header className="journey-page-header">
      <button type="button" onClick={onBack} aria-label="Quay lại"><ArrowLeft size={19} /></button>
      <h1><Heart size={15} fill="currentColor" />Hành trình tình yêu<Heart size={15} fill="currentColor" /></h1>
      <button type="button" className={favorite ? 'is-favorite' : ''} onClick={() => setFavorite((value) => !value)} aria-label={favorite ? 'Bỏ yêu thích' : 'Yêu thích'} aria-pressed={favorite}><Heart size={19} fill={favorite ? 'currentColor' : 'none'} /></button>
    </header>
    <section className="journey-hero">
      <div className="journey-hero-scene">
        <img src={heroImage} alt="" className="journey-hero-image" />
        <div className="journey-hero-shade" />
        <div className="journey-hero-copy"><span>HÀNH TRÌNH CỦA HAI BẠN</span><h2>Together,<br />Always</h2><p>Mỗi ngày bên nhau là một kỷ niệm đáng giữ.</p></div>
      </div>
      <div className="journey-couple-summary">
        <div className="journey-couple-avatars">
          <span className="journey-avatar">{initials(profile.displayName)}</span><Heart size={17} fill="currentColor" />
          {partner ? <span className="journey-avatar">{initials(partner.displayName)}</span> : <button type="button" className="journey-avatar journey-avatar-add" onClick={() => onNavigate('connections')} aria-label="Kết nối với người thương"><Plus size={19} /></button>}
        </div>
        <strong>{daysTogether !== null ? `${daysTogether} ngày` : 'Bắt đầu hành trình'}</strong>
        <small>{connectedSince ? `Bên nhau từ ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${connectedSince}T00:00:00Z`))}` : 'Kết nối để ghi lại hành trình chung'}</small>
        {partner && <span className="journey-partner-name">{profile.displayName} & {partner.displayName}</span>}
      </div>
    </section>

    <nav className="journey-tabs" aria-label="Nội dung hành trình">
      <button type="button" className="is-active"><CalendarDays size={17} />Dòng thời gian</button>
      <button type="button" onClick={() => onNavigate('memory')}><Camera size={17} />Khoảnh khắc</button>
      <button type="button" onClick={() => onNavigate('love-level')}><Heart size={17} />Cột mốc</button>
      <button type="button" onClick={() => onNavigate('settings')}><Settings size={17} />Cài đặt</button>
    </nav>

    <section className="journey-timeline-section">
      <header className="journey-timeline-heading"><div><Heart size={20} fill="currentColor" /><h2>Dòng thời gian của chúng ta</h2></div><button type="button" onClick={() => setNewestFirst((value) => !value)} aria-label={newestFirst ? 'Sắp xếp cũ nhất trước' : 'Sắp xếp mới nhất trước'}><span>{newestFirst ? 'Mới nhất' : 'Cũ nhất'}</span><ListFilter size={15} /></button></header>
      {visibleTimeline.length ? <div className="journey-timeline">
        {visibleTimeline.map((item) => {
          const Icon = item.kind === 'milestone' ? Crown : item.kind === 'relationship' ? Heart : item.kind === 'memory' ? Camera : item.kind === 'letter' ? ImageIcon : CalendarDays
          return <article className="journey-timeline-item" key={`${item.kind}-${item.id}`}>
            <span className="journey-timeline-marker"><Icon size={15} fill={item.kind === 'relationship' ? 'currentColor' : 'none'} /></span>
            <div className="journey-timeline-card">
              {item.image && <img src={item.image} alt="" />}
              <div className="journey-timeline-copy">
                <time dateTime={item.date}><CalendarDays size={13} />{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.date}T00:00:00Z`))}</time>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                {item.badge && <span className="journey-timeline-badge"><Heart size={11} fill="currentColor" />{item.badge}</span>}
              </div>
              {item.image && <span className="journey-timeline-media"><ImageIcon size={13} />1 ảnh</span>}
              <ChevronRight size={17} className="journey-timeline-arrow" />
            </div>
          </article>
        })}
      </div> : <p className="journey-empty">Chưa có nội dung trong hành trình. Hãy lưu kỷ niệm đầu tiên của hai bạn.</p>}
      <button type="button" className="journey-create-button" onClick={onCreateMemory}><Plus size={19} />Tạo kỷ niệm mới <Heart size={14} fill="currentColor" /></button>
      <p className="journey-closing">Cùng nhau viết tiếp những chương tiếp theo...</p>
    </section>
  </div>
}