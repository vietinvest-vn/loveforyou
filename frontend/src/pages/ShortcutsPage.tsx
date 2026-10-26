import { House, Pin, PinOff } from 'lucide-react'
import type { Page } from '../routing'

type QuickActionId = 'love-letter' | 'memory' | 'gift' | 'countdown' | 'private-room' | 'daily-question'
type QuickAction = { id: QuickActionId; label: string; page: Page; icon: typeof House; entryType?: 'journal' | 'memory' | 'letter'; development?: boolean }

type ShortcutsPageProps = {
  actions: QuickAction[]
  pinDraft: QuickActionId[]
  saving: boolean
  onOpen: (action: QuickAction) => void
  onToggle: (id: QuickActionId) => void
  onSave: () => void
}

export default function ShortcutsPage({ actions, pinDraft, saving, onOpen, onToggle, onSave }: ShortcutsPageProps) {
  return <section className="shortcut-manager core-panel">
    <div className="shortcut-manager-heading"><div><h2>Chọn lối tắt yêu thích</h2><p>Ghim tối đa 4 mục; số cột tự điều chỉnh theo màn hình.</p></div><span>{pinDraft.length}/4</span></div>
    <div className="shortcut-manager-list">{actions.map((action) => {
      const Icon = action.icon
      const pinned = pinDraft.includes(action.id)
      return <article className={`shortcut-option ${pinned ? 'is-pinned' : ''}`} key={action.id}>
        <button className="shortcut-option-open" onClick={() => onOpen(action)}>
          <span className="quick-icon"><Icon size={23} fill={action.id === 'daily-question' ? 'currentColor' : 'none'} /></span>
          <span><strong>{action.label}</strong>{action.development && <small>Đang phát triển</small>}</span>
        </button>
        <button className="shortcut-pin-toggle" aria-pressed={pinned} aria-label={`${pinned ? 'Bỏ ghim' : 'Ghim'} ${action.label}`} disabled={saving || (!pinned && pinDraft.length >= 4)} onClick={() => onToggle(action.id)}>
          {pinned ? <PinOff size={17} /> : <Pin size={17} />}
          {pinned ? 'Đã ghim' : 'Ghim'}
        </button>
      </article>
    })}</div>
    <button className="core-primary" disabled={saving || pinDraft.length < 1} onClick={onSave}>
      {saving ? 'Đang lưu...' : 'Lưu lối tắt đã ghim'}
    </button>
  </section>
}