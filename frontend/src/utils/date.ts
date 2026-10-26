export function formatDate(date: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date + 'T12:00:00'))
}

export function dayCount(startDate: string, today: Date) {
  const start = new Date(startDate + 'T00:00:00')
  const current = new Date(today)
  current.setHours(0, 0, 0, 0)
  return Math.max(1, Math.floor((current.getTime() - start.getTime()) / 86400000) + 1)
}

export function daysUntil(date: string, today: Date) {
  const target = new Date(date + 'T00:00:00')
  const current = new Date(today)
  current.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((target.getTime() - current.getTime()) / 86400000))
}

export function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}
