import type { ApiEntry } from '../apiClient'
import SafeImage from '../components/SafeImage'

type EntriesPageProps = {
  entries: ApiEntry[]
  onEdit: (entry: ApiEntry) => void
  onDelete: (entry: ApiEntry) => void
}

export default function EntriesPage({ entries, onEdit, onDelete }: EntriesPageProps) {
  return <div className="core-entry-list">
    {entries.length ? entries.map((entry) => (
      <article className="core-entry" key={entry.id}>
        <time dateTime={entry.date}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${entry.date}T00:00:00Z`))}</time>
        <h2>{entry.title}</h2><p>{entry.text}</p>
        {entry.image && <SafeImage src={entry.image} variant="display" className="core-entry-image" />}
        <div className="core-entry-actions"><button onClick={() => onEdit(entry)}>Sửa</button><button onClick={() => onDelete(entry)}>Xóa</button></div>
      </article>
    )) : <p className="core-empty">Chưa có nội dung. Hãy viết điều đầu tiên của bạn.</p>}
  </div>
}