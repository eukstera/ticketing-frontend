import { describe, expect, it } from 'vitest'
import { barWidth, commentsLabel, monthLabel, optionalSlaLabel, slaLabel, percentOf, safeCount, formatDateTime, formatDateTimeText, formatElapsed, relativeTime, formatDuration } from './format'

describe('percentOf', () => {
  it('returns 0 when the total is zero (no NaN/Infinity)', () => {
    expect(percentOf(0, 0)).toBe(0)
    expect(percentOf(5, 0)).toBe(0)
  })
  it('rounds and clamps', () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(7, 5)).toBe(100)
    expect(percentOf(-1, 5)).toBe(0)
  })
  it('ignores non-finite input', () => {
    expect(percentOf(NaN, 10)).toBe(0)
    expect(percentOf(1, Infinity)).toBe(0)
  })
})

describe('barWidth', () => {
  it('is 0 for an empty max', () => {
    expect(barWidth(0, 0)).toBe(0)
    expect(barWidth(3, 0)).toBe(0)
  })
  it('scales against the max', () => {
    expect(barWidth(5, 10)).toBe(50)
    expect(barWidth(10, 10)).toBe(100)
  })
})

describe('slaLabel', () => {
  it('pluralizes and handles no SLA', () => {
    expect(slaLabel(1)).toBe('SLA 1 day')
    expect(slaLabel(3)).toBe('SLA 3 days')
    expect(slaLabel(0)).toBe('No SLA')
    expect(slaLabel(NaN)).toBe('No SLA')
  })
})

describe('optionalSlaLabel', () => {
  it('returns null when the row has no SLA data', () => {
    expect(optionalSlaLabel(undefined)).toBeNull()
    expect(optionalSlaLabel(null)).toBeNull()
  })
  it('delegates to slaLabel otherwise', () => {
    expect(optionalSlaLabel(2)).toBe('SLA 2 days')
    expect(optionalSlaLabel(0)).toBe('No SLA')
  })
})

describe('commentsLabel', () => {
  it('names the ticket and pluralizes the count', () => {
    expect(commentsLabel('10-001-2026')).toBe('Comments for 10-001-2026')
    expect(commentsLabel('10-001-2026', 0)).toBe('Comments for 10-001-2026')
    expect(commentsLabel('10-001-2026', 1)).toBe('Comments for 10-001-2026, 1 comment')
    expect(commentsLabel('10-001-2026', 3)).toBe('Comments for 10-001-2026, 3 comments')
  })
})

describe('monthLabel', () => {
  it('formats a valid month', () => {
    expect(monthLabel('2026-10')).toBe('October 2026')
    expect(monthLabel('2026-01')).toBe('January 2026')
  })
  it('returns the input when invalid', () => {
    expect(monthLabel('2026-13')).toBe('2026-13')
    expect(monthLabel('nope')).toBe('nope')
  })
})

describe('safeCount', () => {
  it('passes finite numbers through and zeroes everything else', () => {
    expect(safeCount(4)).toBe(4)
    expect(safeCount(0)).toBe(0)
    expect(safeCount(null)).toBe(0)
    expect(safeCount(undefined)).toBe(0)
    expect(safeCount(NaN)).toBe(0)
  })
})

describe('formatDateTime', () => {
  it('splits an ISO timestamp into a long date and a lowercase 12-hour time', () => {
    const { date, time } = formatDateTime('2026-10-20T15:05:00')
    expect(date).toBe('20 October 2026')
    expect(time).toMatch(/^0?3:05 pm$/)
  })
})

describe('formatDateTimeText', () => {
  it('joins the date and time with a single space', () => {
    expect(formatDateTimeText('2026-10-20T15:05:00')).toMatch(/^20 October 2026 0?3:05 pm$/)
  })
  it('matches formatDateTime piece by piece', () => {
    const { date, time } = formatDateTime('2026-01-02T08:30:00')
    expect(formatDateTimeText('2026-01-02T08:30:00')).toBe(`${date} ${time}`)
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-10-22T12:00:00Z').getTime()
  const ago = (ms: number) => new Date(now - ms).toISOString()
  const MIN = 60_000

  it('says "just now" under a minute, including a clock-skewed future time', () => {
    expect(relativeTime(ago(5_000), now)).toBe('just now')
    expect(relativeTime(ago(-30_000), now)).toBe('just now')
  })

  it('counts minutes, hours and days', () => {
    expect(relativeTime(ago(2 * MIN), now)).toBe('2m ago')
    expect(relativeTime(ago(59 * MIN), now)).toBe('59m ago')
    expect(relativeTime(ago(60 * MIN), now)).toBe('1h ago')
    expect(relativeTime(ago(23 * 60 * MIN), now)).toBe('23h ago')
    expect(relativeTime(ago(3 * 24 * 60 * MIN), now)).toBe('3d ago')
  })

  it('falls back to the date after 30 days, and to empty for an invalid date', () => {
    expect(relativeTime(ago(40 * 24 * 60 * MIN), now)).toMatch(/September 2026$/)
    expect(relativeTime('not a date', now)).toBe('')
  })
})

describe('formatElapsed', () => {
  it('formats minutes, hours and days like the live timer', () => {
    expect(formatElapsed(0)).toBe('0m 0s')
    expect(formatElapsed(75)).toBe('1m 15s')
    expect(formatElapsed(3600 + 5 * 60 + 10)).toBe('1h 5m 10s')
    expect(formatElapsed(2 * 86400 + 3 * 3600 + 4 * 60 + 59)).toBe('2d 3h 4m')
  })

  it('floors fractions and never goes negative (clock skew)', () => {
    expect(formatElapsed(59.9)).toBe('0m 59s')
    expect(formatElapsed(-30)).toBe('0m 0s')
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '<1m'],
    [0.4, '<1m'],
    [1, '1m'],
    [45, '45m'],
    [60, '1h'],
    [330, '5h 30m'],
    [1440, '1d'],
    [3120, '2d 4h'],
  ])('%s minutes gives %s', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text)
  })

  it('is a dash when unknown', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
  })
})
