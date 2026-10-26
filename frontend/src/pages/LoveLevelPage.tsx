import { CalendarDays, Crown, Heart, Sparkles, type LucideIcon } from 'lucide-react'
import type { ApiLoveLevel, ApiProfile } from '../apiClient'

type LoveLevelPageProps = {
  profile: ApiProfile
  loveLevel: ApiLoveLevel | null
  LevelIcon: LucideIcon
}

export default function LoveLevelPage({ profile, loveLevel, LevelIcon }: LoveLevelPageProps) {
  return <div className="love-level-page">
    {loveLevel ? <>
      <section className="love-level-hero">
        <span className="love-level-hero-icon"><LevelIcon size={30} fill="currentColor" /><Sparkles size={13} className="love-level-hero-sparkle" /></span>
        <div className="love-level-hero-copy">
          <span className="love-level-eyebrow">HÀNH TRÌNH CỦA HAI BẠN</span>
          <h2>LV.{loveLevel.currentLevel.number} · {loveLevel.currentLevel.title}</h2>
          <p>{loveLevel.currentLevel.description}</p>
          <div className="love-level-progress" role="progressbar" aria-label="Tiến trình đến cấp độ tiếp theo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loveLevel.progressPercent}><span style={{ width: `${loveLevel.progressPercent}%` }} /></div>
          <small>{loveLevel.nextLevel
            ? `${loveLevel.progressPercent}% · Còn ${loveLevel.daysToNextLevel} ngày đến LV.${loveLevel.nextLevel.number} ${loveLevel.nextLevel.title}`
            : `${loveLevel.progressPercent}% · Đã đạt cấp độ cao nhất hiện có`}</small>
        </div>
        <Crown size={48} className="love-level-hero-crown" />
        <div className="love-level-days"><Heart size={16} fill="currentColor" /><strong>{loveLevel.daysTogether} ngày</strong><span>bên nhau</span></div>
      </section>
      <p className="love-level-wish"><Heart size={18} fill="currentColor" /> Chúc {profile.displayName} và {loveLevel.partnerName || 'người thương'} luôn yêu thương, thấu hiểu và đồng hành bên nhau thật hạnh phúc!</p>
      <section className="love-level-milestones">
        <header className="love-level-section-heading"><span><Heart size={18} fill="currentColor" /></span><div><h2>Cột mốc đã đạt</h2><p>{loveLevel.milestones.length} dấu mốc đáng nhớ của hai bạn</p></div></header>
        {loveLevel.milestones.length ? <div className="love-level-timeline">
          {loveLevel.milestones.map((milestone) => <article className="profile-milestone-item" key={milestone.id}>
            <span className="profile-milestone-icon">{milestone.level ? <Crown size={16} /> : <Heart size={15} fill="currentColor" />}</span>
            <span className="profile-milestone-copy"><strong>{milestone.title}{milestone.level ? ` · LV.${milestone.level}` : ''}</strong><small>{milestone.message}</small><time dateTime={milestone.date}><CalendarDays size={12} />{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${milestone.date}T00:00:00Z`))}</time></span>
          </article>)}
        </div> : <p className="love-level-empty">Hai bạn chưa có cột mốc nào được ghi nhận. Mỗi ngày bên nhau sẽ viết thêm một kỷ niệm mới.</p>}
      </section>
    </> : <p className="core-empty">Kết nối với người thương để xem cấp độ và những cột mốc của hai bạn.</p>}
  </div>
}