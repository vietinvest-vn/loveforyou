import type { FormEventHandler } from 'react'
import { Search } from 'lucide-react'
import type { ApiConnection, ApiUser } from '../apiClient'

type ConnectionsPageProps = {
  connection: ApiConnection
  refreshing: boolean
  query: string
  setQuery: (query: string) => void
  foundAccount: Pick<ApiUser, 'publicId' | 'displayName'> | null
  relationshipStart: string
  setRelationshipStart: (value: string) => void
  maxRelationshipStart: string
  busy: boolean
  onRefresh: () => void
  onSearch: FormEventHandler<HTMLFormElement>
  onSendInvitation: FormEventHandler<HTMLFormElement>
  onRespondToInvitation: (id: string, action: 'accept' | 'reject' | 'cancel') => void
}

export default function ConnectionsPage({ connection, refreshing, query, setQuery, foundAccount, relationshipStart, setRelationshipStart, maxRelationshipStart, busy, onRefresh, onSearch, onSendInvitation, onRespondToInvitation }: ConnectionsPageProps) {
  return (
    <div className="core-panel core-stack">
      <button className="core-secondary" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? 'Đang kiểm tra...' : 'Làm mới lời mời'}
      </button>
      {connection.relationship
        ? <section><h2>Đang kết nối với {connection.relationship.displayName}</h2><p>ID {connection.relationship.publicId}</p></section>
        : <form className="core-search" onSubmit={onSearch}><label>Tìm bằng ID sáu chữ số<input value={query} onChange={(event) => setQuery(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} required /></label><button className="core-primary" disabled={query.length !== 6}><Search size={17} /> Tìm tài khoản</button></form>}
      {foundAccount && <form className="connection-invitation core-form" onSubmit={onSendInvitation}>
        <strong>{foundAccount.displayName} · ID {foundAccount.publicId}</strong>
        <label>Ngày bắt đầu bên nhau<input name="relationshipStart" type="date" value={relationshipStart} max={maxRelationshipStart} onChange={(event) => setRelationshipStart(event.target.value)} required /></label>
        <button className="core-primary" disabled={busy || !relationshipStart}>{busy ? 'Đang gửi...' : 'Gửi lời mời'}</button>
      </form>}
      <section><h2>Lời mời đã nhận</h2>{connection.received.length > 0 ? connection.received.map((item) => <article className="core-row" key={item.id}><div><strong>{item.displayName}</strong><p>{item.message || 'Muốn kết nối với bạn.'}</p><p>Ngày bắt đầu bên nhau: {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.relationshipStart}T00:00:00Z`))}</p></div><button onClick={() => onRespondToInvitation(item.id, 'accept')}>Chấp nhận</button><button onClick={() => onRespondToInvitation(item.id, 'reject')}>Từ chối</button></article>) : <p className="core-empty">Chưa có lời mời nào đang chờ.</p>}</section>
      {connection.sent.length > 0 && <section><h2>Lời mời đã gửi</h2>{connection.sent.map((item) => <article className="core-row" key={item.id}><div><strong>{item.displayName}</strong><p>Đang chờ phản hồi</p><p>Ngày bắt đầu bên nhau: {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.relationshipStart}T00:00:00Z`))}</p></div><button onClick={() => onRespondToInvitation(item.id, 'cancel')}>Hủy lời mời</button></article>)}</section>}
    </div>
  )
}