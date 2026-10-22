import { describe, expect, it } from 'vitest'
import type { AuthUser } from '@/lib/auth'
import {
  FALSE_ALARM_STATUS,
  REASON_MAX,
  canReopen,
  clockStart,
  findFalseAlarmActivity,
  findReopenedActivity,
  frozenElapsed,
  isRejectedNow,
  latestActivity,
  reopenedEntry,
  validateReopenReason,
} from '@/lib/falseAlarm'
import type { DateActivity } from '@/types'

const user = (over: Partial<AuthUser> = {}) => ({ id: 7, department_id: 1, ...over }) as AuthUser
const head = (departmentId = 2) => user({ department_id: departmentId, role: { id: 1, name: 'Department Head' } })

const activity = (id: number, category: string, created_at: string, remarks?: string): DateActivity => ({
  id,
  ticket_id: 1,
  date_category_id: 1,
  user_id: 1,
  status: 1,
  created_at,
  date_category: { id: 1, category },
  user: 'Ben',
  remarks,
})

const requested = activity(1, 'Requested Date', '2026-10-22T08:00:00Z')
const rejected1 = activity(2, 'False Alarm Date', '2026-10-22T09:00:00Z', 'Duplicate')
const reopened = activity(3, 'Reopened Date', '2026-10-22T10:00:00Z', 'Real after all')
const rejected2 = activity(4, 'False Alarm Date', '2026-10-22T11:30:00Z', 'Wrong department')

describe('repeated rejections and reopens', () => {
  it('uses the latest entry of each category, whatever order the API lists them in', () => {
    const all = [rejected2, requested, reopened, rejected1]
    expect(findFalseAlarmActivity(all)?.remarks).toBe('Wrong department')
    expect(findReopenedActivity(all)?.remarks).toBe('Real after all')
    expect(latestActivity(all, 'Requested')?.id).toBe(requested.id)
  })

  it('knows whether the ticket is a false alarm right now', () => {
    expect(isRejectedNow([requested])).toBe(false)
    expect(isRejectedNow([requested, rejected1])).toBe(true)
    expect(isRejectedNow([requested, rejected1, reopened])).toBe(false)
    expect(isRejectedNow([requested, rejected1, reopened, rejected2])).toBe(true)
    expect(isRejectedNow(undefined)).toBe(false)
  })

  it('starts the clock at the latest reopen, else at the request', () => {
    expect(clockStart({ date_activities: [requested] })).toBe(requested.created_at)
    expect(clockStart({ date_activities: [requested, rejected1, reopened] })).toBe(reopened.created_at)
    expect(
      clockStart({ date_activities: [requested], reopened_activity: { created_at: 'X', user: null, remarks: null } })
    ).toBe('X')
    expect(clockStart({ date_activities: [] })).toBeNull()
  })

  it('does not count the time spent as a false alarm', () => {
    // rejected again 1h30m after the reopen, not 3h30m after the request
    expect(
      frozenElapsed({ status: FALSE_ALARM_STATUS, date_activities: [requested, rejected1, reopened, rejected2] })
    ).toBe('1h 30m 0s')
    // first rejection: counted from the request
    expect(frozenElapsed({ status: FALSE_ALARM_STATUS, date_activities: [requested, rejected1] })).toBe('1h 0m 0s')
  })

  it('reads the reopen from the row field when date_activities lacks it', () => {
    const rowReopen = { created_at: '2026-10-22T10:00:00Z', user: 'Cy', remarks: 'why' }
    expect(reopenedEntry({ date_activities: [requested], reopened_activity: rowReopen })).toEqual(rowReopen)
    expect(reopenedEntry({ date_activities: [requested, reopened] })?.remarks).toBe('Real after all')
    expect(reopenedEntry({ date_activities: [requested] })).toBeNull()
  })
})

describe('canReopen', () => {
  it('is for Department Heads on a false alarm only', () => {
    expect(canReopen({ status: FALSE_ALARM_STATUS }, head())).toBe(true)
    expect(canReopen({ status: FALSE_ALARM_STATUS }, head(1))).toBe(true)
  })

  it('is not for handling-department staff or other users', () => {
    expect(canReopen({ status: FALSE_ALARM_STATUS }, user({ department_id: 1 }))).toBe(false)
    expect(canReopen({ status: FALSE_ALARM_STATUS }, user({ role: { id: 3, name: 'Normal User' } }))).toBe(false)
    expect(canReopen({ status: FALSE_ALARM_STATUS }, null)).toBe(false)
    expect(canReopen({ status: FALSE_ALARM_STATUS }, undefined)).toBe(false)
  })

  it.each(['Open', 'In-progress', 'Completed', 'Overdue'])('is not offered on a %s ticket, even to a head', status => {
    expect(canReopen({ status }, head())).toBe(false)
  })
})

describe('validateReopenReason', () => {
  it('lets the reason be left blank', () => {
    expect(validateReopenReason('')).toBeNull()
    expect(validateReopenReason('   ')).toBeNull()
  })

  it('holds a written reason to 3..500 characters', () => {
    expect(validateReopenReason('ab')).toMatch(/at least 3/)
    expect(validateReopenReason('abc')).toBeNull()
    expect(validateReopenReason('a'.repeat(REASON_MAX))).toBeNull()
    expect(validateReopenReason('a'.repeat(REASON_MAX + 1))).toMatch(/at most 500/)
  })
})
