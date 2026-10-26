import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateLoveLevel, getMilestoneMessage } from '../src/love-level.js'

test('Love Level starts at LV.1 and counts the relationship start day inclusively', () => {
  const result = calculateLoveLevel('2026-10-21', new Date('2026-10-21T18:00:00.000Z'))
  assert.equal(result.daysTogether, 1)
  assert.deepEqual(result.duration, { years: 0, months: 0, days: 0 })
  assert.equal(result.currentLevel.number, 1)
  assert.equal(result.levels[0].title, 'Khởi đầu yêu thương')
  assert.match(result.levels[0].description, /bắt đầu/i)
  assert.equal(result.levels[0].achieved, true)
  assert.equal(result.nextLevel.number, 2)
  assert.equal(result.levels[1].date, '2026-10-27')
  assert.equal(result.levels[1].achieved, false)
  assert.equal(result.daysToNextLevel, 6)
  assert.equal(result.milestones.find((item) => item.id === 'days-7').date, '2026-10-27')
})

test('progression is not reset by reload and grows without a low-level cap', () => {
  const first = calculateLoveLevel('2000-01-01', new Date('2015-01-01T12:00:00.000Z'))
  const again = calculateLoveLevel('2000-01-01', new Date('2015-01-01T12:00:00.000Z'))
  assert.equal(first.currentLevel.number, 11)
  assert.deepEqual(first, again)
  assert.equal(first.nextLevel.number, 12)
  assert.equal(first.nextLevel.date, '2020-01-01')
  assert.equal(first.levels.find((level) => level.number === 11).achieved, true)
  assert.equal(first.levels.find((level) => level.number === 12).achieved, false)
  assert.ok(first.levels.every((level) => level.title && level.icon && level.description && level.date))
  assert.deepEqual(
    ['days-7', 'days-30', 'days-100', 'months-6', 'years-1', 'years-2', 'years-3', 'years-5', 'years-10', 'years-15']
      .map((id) => first.milestones.some((item) => item.id === id)),
    Array(10).fill(true),
  )
  assert.ok(first.progressPercent >= 0 && first.progressPercent <= 100)
})

test('anniversaries clamp leap days and month ends to the last valid calendar day', () => {
  const leapStart = calculateLoveLevel('2024-02-29', new Date('2025-02-28T12:00:00.000Z'))
  assert.equal(leapStart.daysTogether, 366)
  assert.equal(leapStart.milestones.find((item) => item.id === 'years-1').date, '2025-02-28')
  assert.equal(leapStart.milestones.find((item) => item.id === 'years-4').date, '2028-02-29')
  assert.equal(leapStart.milestones.find((item) => item.id === 'months-6').date, '2024-08-29')

  const monthEnd = calculateLoveLevel('2026-01-31', new Date('2026-02-28T12:00:00.000Z'))
  assert.equal(monthEnd.milestones.find((item) => item.id === 'months-1'), undefined)
  assert.equal(monthEnd.duration.months, 1)
  assert.equal(monthEnd.duration.days, 0)
})

test('future or invalid relationship start dates do not produce a level', () => {
  assert.equal(calculateLoveLevel('2026-02-30', new Date('2026-10-21T00:00:00.000Z')), null)
  assert.equal(calculateLoveLevel('2026-10-22', new Date('2026-10-21T00:00:00.000Z')), null)
})

test('milestone messages match the exact milestone instead of claiming a wrong duration', () => {
  assert.match(getMilestoneMessage({ id: 'days-7', title: 'Bên nhau 7 ngày' }), /7 ngày/)
  assert.match(getMilestoneMessage({ id: 'years-2', title: 'Kỷ niệm 2 năm' }), /2 năm bên nhau/)
})
