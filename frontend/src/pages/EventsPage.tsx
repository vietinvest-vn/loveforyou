import { Gift, Heart } from 'lucide-react'

type Celebration = {
  kind: 'birthday' | 'anniversary'
  title: string
  date: Date
  days: number
}

export default function EventsPage({ celebrations }: { celebrations: Celebration[] }) {
  return (
    <section className="core-panel core-stack" aria-label="Danh sách sự kiện sắp tới">
      <h2>Ngày đặc biệt sắp tới</h2>
      {celebrations.length ? celebrations.map((item) => (
        <article className="upcoming-card" key={`${item.kind}-${item.title}`}>
          <span className="upcoming-icon">{item.kind === 'birthday' ? <Gift size={22} /> : <Heart size={23} fill="currentColor" />}</span>
          <span className="upcoming-copy"><strong>{item.title}</strong><small>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(item.date)} · Còn {item.days} ngày</small></span>
        </article>
      )) : <p className="core-empty">Chưa có ngày đặc biệt để hiển thị. Hãy thêm ngày sinh trong hồ sơ hoặc ngày bắt đầu bên nhau.</p>}
    </section>
  )
}