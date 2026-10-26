import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronRight, VenusAndMars } from 'lucide-react'

function DateWheelColumn({ values, selected, onSelect }: { values: string[]; selected: string; onSelect: (value: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const previousLength = useRef(-1)
  const rowHeight = 42

  useEffect(() => {
    if (previousLength.current !== values.length) {
      const index = values.indexOf(selected)
      if (scroller.current && index >= 0) scroller.current.scrollTop = index * rowHeight
      previousLength.current = values.length
    }
  }, [selected, values])

  function updateFromScroll() {
    const element = scroller.current
    if (!element) return
    const index = Math.max(0, Math.min(values.length - 1, Math.round(element.scrollTop / rowHeight)))
    onSelect(values[index])
  }

  return (
    <div className="date-wheel-column" ref={scroller} onScroll={updateFromScroll} role="listbox" aria-label="Chọn giá trị">
      {values.map((value) => <button key={value} type="button" role="option" aria-selected={selected === value} className={selected === value ? 'is-selected' : ''} onClick={() => {
        onSelect(value)
        const index = values.indexOf(value)
        scroller.current?.scrollTo({ top: index * rowHeight, behavior: 'smooth' })
      }}>{value}</button>)}
    </div>
  )
}

export function BirthDatePicker({ value, onChange, maxDate, error }: { value: string; onChange: (value: string) => void; maxDate: string; error?: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(maxDate)
  const [maxYear, maxMonth, maxDay] = maxDate.split('-').map(Number)
  const [draftYear, draftMonth, draftDay] = (draft || maxDate).split('-').map(Number)
  const years = Array.from({ length: maxYear - 1899 }, (_, index) => String(maxYear - index))
  const months = Array.from({ length: draftYear === maxYear ? maxMonth : 12 }, (_, index) => index + 1)
  const maxAllowedDay = draftYear === maxYear && draftMonth === maxMonth ? maxDay : new Date(draftYear, draftMonth, 0).getDate()
  const days = Array.from({ length: maxAllowedDay }, (_, index) => String(index + 1).padStart(2, '0'))

  function updateDraft(year: number, month: number, day: number) {
    const boundedMonth = Math.min(month, year === maxYear ? maxMonth : 12)
    const boundedDay = Math.min(day, year === maxYear && boundedMonth === maxMonth ? maxDay : new Date(year, boundedMonth, 0).getDate())
    setDraft(`${year}-${String(boundedMonth).padStart(2, '0')}-${String(boundedDay).padStart(2, '0')}`)
  }

  const displayDate = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Ngày sinh'

  return <>
    <input type="hidden" name="dateOfBirth" value={value} />
    <div className={`auth-field auth-picker-field ${error ? 'has-error' : ''}`} data-field="dateOfBirth">
      <CalendarDays size={21} aria-hidden="true" />
      <button type="button" className={`auth-picker-trigger ${value ? 'has-value' : ''}`} aria-invalid={Boolean(error)} aria-describedby={error ? 'dateOfBirth-error' : undefined} onClick={() => { setDraft(value || maxDate); setOpen(true) }} aria-haspopup="dialog">
        <span>{displayDate}</span><ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
    {error && <small id="dateOfBirth-error" className="auth-field-error" role="alert">{error}</small>}
    {open && <div className="auth-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="auth-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="birth-picker-title">
        <div className="auth-picker-handle" />
        <header className="auth-picker-header"><button type="button" onClick={() => setOpen(false)}>Hủy</button><h2 id="birth-picker-title">Ngày sinh</h2><button type="button" className="auth-picker-confirm" onClick={() => { onChange(draft); setOpen(false) }}>Xong</button></header>
        <p className="auth-picker-description">Cuộn để chọn ngày, tháng và năm</p>
        <div className="date-wheel-labels"><span>Ngày</span><span>Tháng</span><span>Năm</span></div>
        <div className="date-wheel">
          <DateWheelColumn values={days} selected={String(draftDay).padStart(2, '0')} onSelect={(day) => updateDraft(draftYear, draftMonth, Number(day))} />
          <DateWheelColumn values={months.map((month) => `Tháng ${month}`)} selected={`Tháng ${draftMonth}`} onSelect={(month) => updateDraft(draftYear, Number(month.replace('Tháng ', '')), draftDay)} />
          <DateWheelColumn values={years} selected={String(draftYear)} onSelect={(year) => updateDraft(Number(year), draftMonth, draftDay)} />
          <div className="date-wheel-highlight" aria-hidden="true" />
        </div>
      </section>
    </div>}
  </>
}

const genderOptions = [
  { value: 'female', label: 'Nữ' },
  { value: 'male', label: 'Nam' },
  { value: 'other', label: 'Khác' },
  { value: 'prefer_not_to_say', label: 'Không muốn trả lời' },
]

export function GenderPicker({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  const [open, setOpen] = useState(false)
  const label = genderOptions.find((option) => option.value === value)?.label ?? 'Giới tính'
  return <>
    <input type="hidden" name="gender" value={value} />
    <div className={`auth-field auth-picker-field ${error ? 'has-error' : ''}`} data-field="gender">
      <VenusAndMars size={21} aria-hidden="true" />
      <button type="button" className={`auth-picker-trigger ${value ? 'has-value' : ''}`} aria-invalid={Boolean(error)} aria-describedby={error ? 'gender-error' : undefined} onClick={() => setOpen(true)} aria-haspopup="dialog"><span>{label}</span><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
    {error && <small id="gender-error" className="auth-field-error" role="alert">{error}</small>}
    {open && <div className="auth-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="auth-picker-sheet gender-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="gender-picker-title">
        <div className="auth-picker-handle" />
        <header className="auth-picker-header"><button type="button" onClick={() => setOpen(false)}>Đóng</button><h2 id="gender-picker-title">Giới tính</h2><span className="auth-picker-header-spacer" /></header>
        <p className="auth-picker-description">Chọn giới tính của bạn</p>
        <div className="gender-picker-options">{genderOptions.map((option) => <button key={option.value} type="button" className={value === option.value ? 'is-selected' : ''} aria-pressed={value === option.value} onClick={() => { onChange(option.value); setOpen(false) }}><span className="gender-option-icon"><VenusAndMars size={19} /></span><span>{option.label}</span>{value === option.value && <Check size={19} className="gender-option-check" />}</button>)}</div>
      </section>
    </div>}
  </>
}