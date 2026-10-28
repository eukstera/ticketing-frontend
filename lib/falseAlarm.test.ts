import { describe, expect, it } from 'vitest'
import type { AuthUser } from '@/lib/auth'
import {
  FALSE_ALARM_STATUS,
  REASON_MAX,
  REASON_MIN,
  canMarkFalseAlarm,
  falseAlarmEntry,
  findFalseAlarmActivity,
  frozenElapsed,
  validateReason,
} from '@/lib/falseAlarm'
import type { ActivityInfo, DateActivity } from '@/types'

const user = (over: Partial<AuthUser> = {}) => ({ id: 7, department_id: 1, ...over }) as AuthUser
const head = (departmentId = 2) => user({ department_id: departmentId, role: { id: 1, name: 'Department Head' } })
const assigned: ActivityInfo = { id: 1, created_at: '2026-10-22T08:00:00Z', user: 'Ana', user_id: 3 }

const ticket = (over: Partial<Parameters<typeof canMarkFalseAlarm>[0]> = {}) => ({
  status: 'Open',
  department_id: 1,
  assigned_activity: null,
  ...over,
})

const activity = (category: string, created_at: string, remarks?: string): DateActivity => ({
  id: 1,
  ticket_id: 1,
  date_category_id: 1,
  user_id: 1,
  status: 1,
  created_at,
  date_category: { id: 1, category },
  user: 'Ben',
  remarks,
})

describe('validateReason', () => {
  it('requires a reason', () => {
    expect(validateReason('')).toBe('Enter a reason.')
    expect(validateReason('    ')).toBe('Enter a reason.')
  })

  it('counts trimmed characters against the 3..500 limits', () => {
    expect(validateReason('ab')).toMatch(/at least 3/)
    expect(validateReason('  ab  ')).toMatch(/at least 3/)
    expect(validateReason('a'.repeat(REASON_MIN))).toBeNull()
    expect(validateReason('a'.repeat(REASON_MAX))).toBeNull()
    expect(validateReason('a'.repeat(REASON_MAX + 1))).toMatch(/at most 500/)
  })
})

describe('canMarkFalseAlarm', () => {
  it('is offered to handling-department staff on an untaken Open ticket', () => {
    expect(canMarkFalseAlarm(ticket(), user())).toBe(true)
  })

  it('is offered on an untaken Overdue ticket too', () => {
    expect(canMarkFalseAlarm(ticket({ status: 'Overdue' }), user())).toBe(true)
  })

  it('is offered to a Department Head of another department', () => {
    expect(canMarkFalseAlarm(ticket({ department_id: 1 }), head(2))).toBe(true)
  })

  it('is not offered to staff of another department', () => {
    expect(canMarkFalseAlarm(ticket({ department_id: 1 }), user({ department_id: 2 }))).toBe(false)
  })

  it.each(['Open', 'In-progress', 'Overdue'])('is still offered once a %s ticket is taken', status => {
    const taken = ticket({ status, assigned_activity: assigned })
    expect(canMarkFalseAlarm(taken, user())).toBe(true)
    expect(canMarkFalseAlarm(taken, head())).toBe(true)
  })

  it('is offered to the assignee even from another department', () => {
    const taken = ticket({ status: 'In-progress', assigned_activity: assigned })
    expect(canMarkFalseAlarm(taken, user({ id: 3, department_id: 2 }))).toBe(true)
    expect(canMarkFalseAlarm(taken, user({ id: 4, department_id: 2 }))).toBe(false)
  })

  it.each(['Completed', 'Pending Confirmation', FALSE_ALARM_STATUS])('is not offered for a %s ticket', status => {
    expect(canMarkFalseAlarm(ticket({ status }), user())).toBe(false)
    expect(canMarkFalseAlarm(ticket({ status }), head())).toBe(false)
  })

  it('is not offered without a user', () => {
    expect(canMarkFalseAlarm(ticket(), null)).toBe(false)
    expect(canMarkFalseAlarm(ticket(), undefined)).toBe(false)
  })
})

describe('false alarm activity and frozen elapsed time', () => {
  const requested = activity('Requested Date', '2026-10-22T08:00:00Z')
  const rejected = activity('False Alarm Date', '2026-10-22T09:05:10Z', 'Duplicate of 10-001-2026')

  it('finds the False Alarm Date entry and its reason', () => {
    expect(findFalseAlarmActivity([requested, rejected])?.remarks).toBe('Duplicate of 10-001-2026')
    expect(findFalseAlarmActivity([requested])).toBeUndefined()
    expect(findFalseAlarmActivity(undefined)).toBeUndefined()
  })

  it('freezes the elapsed time at the moment it was rejected', () => {
    expect(frozenElapsed({ status: FALSE_ALARM_STATUS, date_activities: [requested, rejected] })).toBe('1h 5m 10s')
  })

  it('has no frozen value for other statuses or missing dates', () => {
    expect(frozenElapsed({ status: 'Open', date_activities: [requested, rejected] })).toBeNull()
    expect(frozenElapsed({ status: FALSE_ALARM_STATUS, date_activities: [requested] })).toBeNull()
    expect(frozenElapsed({ status: FALSE_ALARM_STATUS, date_activities: [] })).toBeNull()
  })
})

describe('falseAlarmEntry (list rows)', () => {
  const requested = activity('Requested Date', '2026-10-22T08:00:00Z')
  const rowActivity = { created_at: '2026-10-22T08:30:00Z', user: 'Cy Lim', remarks: 'Wrong department' }

  it('prefers the False Alarm Date entry in date_activities', () => {
    const rejected = activity('False Alarm Date', '2026-10-22T09:00:00Z', 'Duplicate')
    expect(falseAlarmEntry({ date_activities: [requested, rejected], false_alarm_activity: rowActivity })).toEqual({
      user: 'Ben',
      created_at: '2026-10-22T09:00:00Z',
      remarks: 'Duplicate',
    })
  })

  it("falls back to the row's own false_alarm_activity", () => {
    expect(falseAlarmEntry({ date_activities: [requested], false_alarm_activity: rowActivity })).toEqual(rowActivity)
    expect(
      frozenElapsed({ status: FALSE_ALARM_STATUS, date_activities: [requested], false_alarm_activity: rowActivity })
    ).toBe('30m 0s')
  })

  it('is null for a row that was never rejected', () => {
    expect(falseAlarmEntry({ date_activities: [requested], false_alarm_activity: null })).toBeNull()
    expect(falseAlarmEntry({ date_activities: [requested] })).toBeNull()
  })
})
