import { describe, expect, it } from 'vitest'
import { barWidth, commentsLabel, monthLabel, optionalSlaLabel, slaLabel, percentOf, safeCount, formatDateTime, formatDateTimeText } from './format'

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
