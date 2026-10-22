import { isAdmin, type AuthUser } from '@/lib/auth'
import { formatElapsed } from '@/lib/format'
import type { DateActivity, DepartmentTicket, FalseAlarmActivity } from '@/types'

export const FALSE_ALARM_STATUS = 'False Alarm'
export const REASON_MIN = 3
export const REASON_MAX = 500

/** Client-side check before sending; the API enforces the same 3..500 (422 errors.reason). */
export function validateReason(reason: string): string | null {
  const length = reason.trim().length
  if (length === 0) return 'Enter a reason.'
  if (length < REASON_MIN) return `The reason must be at least ${REASON_MIN} characters.`
  if (length > REASON_MAX) return `The reason must be at most ${REASON_MAX} characters.`
  return null
}

type RejectableTicket = Pick<DepartmentTicket, 'status' | 'department_id' | 'assigned_activity'>

/**
 * Who sees the "False alarm" button: staff of the ticket's handling department
 * and Department Heads, on an untaken Open or Overdue ticket. (The API decides;
 * this only avoids offering a button that would 403/409.)
 */
export function canMarkFalseAlarm(ticket: RejectableTicket, user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (ticket.status !== 'Open' && ticket.status !== 'Overdue') return false
  if (ticket.assigned_activity) return false
  return user.department_id === ticket.department_id || isAdmin(user)
}

export function findFalseAlarmActivity(activities: DateActivity[] | undefined): DateActivity | undefined {
  return activities?.find(a => a.date_category.category.includes(FALSE_ALARM_STATUS))
}

/**
 * The rejection of a list row: the "False Alarm Date" entry in date_activities,
 * or the row's own false_alarm_activity when that entry is missing.
 */
export function falseAlarmEntry(
  ticket: Pick<DepartmentTicket, 'date_activities'> & { false_alarm_activity?: FalseAlarmActivity | null }
): { user: string | null; created_at: string; remarks: string | null } | null {
  const entry = findFalseAlarmActivity(ticket.date_activities)
  if (entry) return { user: entry.user, created_at: entry.created_at, remarks: entry.remarks ?? null }
  return ticket.false_alarm_activity ?? null
}

/**
 * The elapsed time of a rejected request, frozen at the moment it was
 * rejected (the API runs no timer). null when it isn't a false alarm or the
 * dates are missing.
 */
export function frozenElapsed(
  ticket: Pick<DepartmentTicket, 'status' | 'date_activities'> & { false_alarm_activity?: FalseAlarmActivity | null }
): string | null {
  if (ticket.status !== FALSE_ALARM_STATUS) return null
  const requested = ticket.date_activities?.find(a => a.date_category.category.includes('Requested'))
  const rejected = falseAlarmEntry(ticket)
  if (!requested || !rejected) return null
  const ms = new Date(rejected.created_at).getTime() - new Date(requested.created_at).getTime()
  return Number.isFinite(ms) ? formatElapsed(ms / 1000) : null
}
