import { Clock3, Gift, Heart, Plus } from 'lucide-react'
import type { ApiInvitation } from '../apiClient'

type ActivityItem = {
  id: string
  type: 'couple_invitation'
  createdAt: string
  readAt: string
  actorName: string
  invitation: ApiInvitation
} | {
  id: string
  type: 'gift_received'
  createdAt: string
  readAt: string
  actorName: string
  giftName: string
  message: string
} | {
  id: string
  type: 'chat_message'
  createdAt: string
  readAt: string
  actorName: string
  message: string
}

type ActivityFeedPageProps = {
  items: ActivityItem[]
  today: Date
  unreadCount: number
  initials: (name: string) => string
  relativeTime: (value: string, now: Date) => string
  onMarkAllRead: () => void
  onRespondToInvitation: (id: string, action: 'accept' | 'reject') => void
  onOpenChat: () => void
}

export default function ActivityFeedPage({ items, today, unreadCount, initials, relativeTime, onMarkAllRead, onRespondToInvitation, onOpenChat }: ActivityFeedPageProps) {
  return (
    <section className="activity-feed-page" aria-labelledby="activity-feed-title">
      <header className="activity-feed-heading">
        <h1 id="activity-feed-title"><Heart size={27} fill="currentColor" /> <span className="activity-heading-title">Hoạt động</span><span className="activity-heading-decoration" aria-hidden="true">♥</span></h1>
        {unreadCount > 0 && <button type="button" onClick={onMarkAllRead}>Đọc tất cả</button>}
      </header>
      <div className="activity-feed-list">
        {items.length ? items.map((item) => (
          <article className={`activity-card ${item.readAt ? '' : 'is-unread'}`} key={item.id}>
            <div className="activity-avatar" aria-hidden="true">
              {initials(item.actorName || 'LoveForYou')}
              <span>{item.type === 'chat_message' ? <Heart size={13} fill="currentColor" /> : item.type === 'gift_received' ? <Gift size={13} /> : <Plus size={13} />}</span>
            </div>
            <div className="activity-card-content">
              {item.type === 'chat_message' ? <>
                <p><strong>{item.actorName || 'Người thương'}</strong> đã gửi cho bạn tin nhắn</p>
                <p className="activity-message-preview">{item.message}</p>
              </> : item.type === 'gift_received' ? <>
                <p><strong>{item.actorName || 'Người thương'}</strong> đã gửi tặng bạn {item.giftName}</p>
                {item.message && <p className="activity-message-preview">{item.message}</p>}
              </> : <p><strong>{item.actorName || 'LoveForYou'}</strong> đã gửi cho bạn lời mời kết nối</p>}
              <time dateTime={item.createdAt}><Clock3 size={14} />{relativeTime(item.createdAt, today)}</time>
              {item.type === 'chat_message' ? <div className="activity-invitation-actions"><button type="button" className="activity-accept-button" onClick={onOpenChat}>Mở tin nhắn</button></div> : item.type === 'couple_invitation' ? <div className="activity-invitation-actions">
                <button type="button" className="activity-reject-button" onClick={() => onRespondToInvitation(item.invitation.id, 'reject')}>Từ chối</button>
                <button type="button" className="activity-accept-button" onClick={() => onRespondToInvitation(item.invitation.id, 'accept')}>Chấp nhận</button>
              </div> : null}
            </div>
          </article>
        )) : <p className="activity-feed-empty">Chưa có hoạt động mới.</p>}
      </div>
    </section>
  )
}