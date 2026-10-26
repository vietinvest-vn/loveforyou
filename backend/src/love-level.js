const DAY_MS = 86_400_000
const LEVEL_YEAR_THRESHOLDS = new Set([1, 2, 3, 5, 10])

function dateFromIso(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS)
}

function addMonths(date, count) {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + count
  const year = Math.floor(totalMonths / 12)
  const month = totalMonths % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)))
}

function addYears(date, count) {
  const year = date.getUTCFullYear() + count
  const month = date.getUTCMonth()
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)))
}

function dateDiffDays(start, end) {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS)
}

function durationBetween(start, end) {
  let years = Math.max(0, end.getUTCFullYear() - start.getUTCFullYear())
  while (years > 0 && addYears(start, years) > end) years -= 1
  let anchor = addYears(start, years)
  let months = Math.max(0, (end.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + end.getUTCMonth() - anchor.getUTCMonth())
  while (months > 0 && addMonths(anchor, months) > end) months -= 1
  anchor = addMonths(anchor, months)
  return { years, months, days: dateDiffDays(anchor, end) }
}

function milestoneCatalog(start, today) {
  const milestones = [
    { id: 'level-1', label: 'Bắt đầu hành trình yêu thương', date: start, levelThreshold: 1 },
    { id: 'days-7', label: 'Bên nhau 7 ngày', date: addDays(start, 6), levelThreshold: 2 },
    { id: 'days-30', label: 'Bên nhau 30 ngày', date: addDays(start, 29), levelThreshold: 3 },
    { id: 'days-100', label: 'Bên nhau 100 ngày', date: addDays(start, 99), levelThreshold: 4 },
    { id: 'months-6', label: 'Bên nhau 6 tháng', date: addMonths(start, 6), levelThreshold: 5 },
  ]
  const maxYear = Math.max(15, today.getUTCFullYear() - start.getUTCFullYear() + 5)
  for (let years = 1; years <= maxYear; years += 1) {
    const isLevel = LEVEL_YEAR_THRESHOLDS.has(years) || years > 10 && years % 5 === 0
    milestones.push({
      id: `years-${years}`,
      label: years === 1 ? 'Kỷ niệm 1 năm' : `Kỷ niệm ${years} năm`,
      date: addYears(start, years),
      levelThreshold: isLevel ? years <= 10 ? 6 + [1, 2, 3, 5, 10].indexOf(years) : 10 + (years - 10) / 5 : null,
    })
  }
  return milestones.sort((left, right) => left.date - right.date || left.id.localeCompare(right.id))
}

function buildLevels(start, milestones) {
  const levels = [{ number: 1, title: 'Khởi đầu yêu thương', icon: 'heart', description: 'Hai bạn đã bắt đầu hành trình bên nhau.', date: start }]
  const thresholds = milestones.filter((item) => item.levelThreshold !== null && item.levelThreshold > 1)
  for (const milestone of thresholds) {
    levels.push({
      number: milestone.levelThreshold,
      title: milestone.label,
      icon: milestone.id.startsWith('days-') ? 'sparkles' : milestone.id.startsWith('months-') ? 'flower' : 'crown',
      description: `Đạt khi hai bạn ${milestone.label.toLocaleLowerCase('vi')}.`,
      date: milestone.date,
    })
  }
  return levels.sort((left, right) => left.number - right.number)
}

export function calculateLoveLevel(relationshipStart, now = new Date()) {
  const start = dateFromIso(relationshipStart)
  if (!start) return null
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (start > today) return null

  const milestones = milestoneCatalog(start, today)
  const levelDefinitions = buildLevels(start, milestones)
  const achievedMilestones = milestones.filter((item) => item.date <= today)
  const reachedLevels = levelDefinitions.filter((item) => item.date <= today)
  const currentLevel = reachedLevels.at(-1) ?? levelDefinitions[0]
  const nextLevel = levelDefinitions.find((item) => item.number > currentLevel.number)
  const levelStart = currentLevel.date ?? start
  const daysToNextLevel = nextLevel ? dateDiffDays(today, nextLevel.date) : null
  const progressPercent = nextLevel
    ? Math.min(100, Math.max(0, Math.floor(dateDiffDays(levelStart, today) / dateDiffDays(levelStart, nextLevel.date) * 100)))
    : 100

  return {
    relationshipStart,
    daysTogether: dateDiffDays(start, today) + 1,
    duration: durationBetween(start, today),
    currentLevel: {
      number: currentLevel.number,
      title: currentLevel.title,
      icon: currentLevel.icon,
      description: currentLevel.description,
    },
    levels: levelDefinitions.map((item) => ({
      number: item.number,
      title: item.title,
      icon: item.icon,
      description: item.description,
      date: isoDate(item.date),
      achieved: item.date <= today,
    })),
    nextLevel: nextLevel ? {
      number: nextLevel.number,
      title: nextLevel.title,
      icon: nextLevel.icon,
      description: nextLevel.description,
      date: isoDate(nextLevel.date),
      daysRemaining: daysToNextLevel,
    } : null,
    progressPercent,
    daysToNextLevel,
    milestones: milestones.map((item) => ({
      id: item.id,
      title: item.label,
      date: isoDate(item.date),
      achieved: item.date <= today,
      level: item.levelThreshold,
      icon: item.id.startsWith('years-') ? 'crown' : item.id.startsWith('months-') ? 'flower' : item.id.startsWith('days-') ? 'sparkles' : 'heart',
    })),
    achievedMilestoneIds: achievedMilestones.map((item) => item.id),
  }
}

export function getMilestoneMessage(milestone) {
  if (milestone.id === 'level-1') return 'Chúc mừng hai bạn đã bắt đầu hành trình yêu thương!'
  if (milestone.id === 'days-7') return 'Chúc mừng hai bạn đã bên nhau trọn vẹn 7 ngày đầu tiên!'
  if (milestone.id === 'days-30') return 'Chúc mừng cột mốc 30 ngày yêu thương của hai bạn!'
  if (milestone.id === 'days-100') return '100 ngày cùng nhau tạo nên thật nhiều điều đáng nhớ!'
  if (milestone.id === 'months-6') return 'Chúc mừng hai bạn đã cùng nhau đi qua nửa năm yêu thương!'
  if (milestone.id === 'years-1') return 'Chúc mừng kỷ niệm 1 năm bên nhau của hai bạn!'
  return `Chúc mừng kỷ niệm ${milestone.title.replace('Kỷ niệm ', '').replace(' năm', ' năm bên nhau!')}`
}
