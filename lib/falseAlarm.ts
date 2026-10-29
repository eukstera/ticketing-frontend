import { isAdmin, isEncoder, type AuthUser } from '@/lib/auth'
import { formatElapsed } from '@/lib/format'
import type { DateActivity, DepartmentTicket, FalseAlarmActivity } from '@/types'

export const FALSE_ALARM_STATUS = 'False Alarm'
/** Matches the "Reopened Date" category. */
export const REOPENED_MATCH = 'Reopened'
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
 * Who sees the "False alarm" button: the assignee, staff of the ticket's
 * handling department and Department Heads, on an Open, Blank, In-progress or Overdue
 * ticket, taken or not. (The API decides; this only avoids offering a button
 * that would 403/409.) Encoders are read-only and never see it.
 */
export function canMarkFalseAlarm(ticket: RejectableTicket, user: AuthUser | null | undefined): boolean {
  if (!user || isEncoder(user)) return false
  if (ticket.status !== 'Open' && ticket.status !== 'Blank' && ticket.status !== 'In-progress' && ticket.status !== 'Overdue') return false
  const isOwner = ticket.assigned_activity?.user_id === user.id
  // A Blank ticket belongs to whoever printed it: only the owner or a head may reject it.
  if (ticket.status === 'Blank') return isOwner || isAdmin(user)
  return (
    user.department_id === ticket.department_id ||
    isAdmin(user) ||
    isOwner
  )
}

/**
 * Rejections and reopens can repeat (reject, reopen, reject again), so every
 * lookup here means "the latest entry of that category"; ties go to the one
 * later in the list.
 */
export function latestActivity(activities: DateActivity[] | undefined, match: string): DateActivity | undefined {
  let best: DateActivity | undefined
  for (const a of activities ?? []) {
    if (!a.date_category.category.includes(match)) continue
    if (!best || !(Date.parse(a.created_at) < Date.parse(best.created_at))) best = a
  }
  return best
}

export function findFalseAlarmActivity(activities: DateActivity[] | undefined): DateActivity | undefined {
  return latestActivity(activities, FALSE_ALARM_STATUS)
}

export function findReopenedActivity(activities: DateActivity[] | undefined): DateActivity | undefined {
  return latestActivity(activities, REOPENED_MATCH)
}

type RowActivities = Pick<DepartmentTicket, 'date_activities'> & {
  false_alarm_activity?: FalseAlarmActivity | null
  reopened_activity?: FalseAlarmActivity | null
}

type Entry = { user: string | null; created_at: string; remarks: string | null }

function toEntry(a: DateActivity): Entry {
  return { user: a.user, created_at: a.created_at, remarks: a.remarks ?? null }
}

/**
 * The latest rejection of a list row: the newest "False Alarm Date" entry in
 * date_activities, or the row's own false_alarm_activity when that is missing.
 */
export function falseAlarmEntry(ticket: RowActivities): Entry | null {
  const entry = findFalseAlarmActivity(ticket.date_activities)
  return entry ? toEntry(entry) : (ticket.false_alarm_activity ?? null)
}

/** The latest reopen of a list row (date_activities first, then reopened_activity), or null. */
export function reopenedEntry(ticket: RowActivities): Entry | null {
  const entry = findReopenedActivity(ticket.date_activities)
  return entry ? toEntry(entry) : (ticket.reopened_activity ?? null)
}

/** True while the newest event is a rejection, i.e. the ticket is a false alarm right now. */
export function isRejectedNow(activities: DateActivity[] | undefined): boolean {
  const rejected = findFalseAlarmActivity(activities)
  if (!rejected) return false
  const reopened = findReopenedActivity(activities)
  return !reopened || Date.parse(reopened.created_at) < Date.parse(rejected.created_at)
}

/** Only Department Heads reopen, and only a rejected ticket (the API enforces both). */
export function canReopen(ticket: Pick<DepartmentTicket, 'status'>, user: AuthUser | null | undefined): boolean {
  return ticket.status === FALSE_ALARM_STATUS && isAdmin(user) && !isEncoder(user)
}

/** The reopen reason is optional; when given it follows the same 3..500 rule as a rejection. */
export function validateReopenReason(reason: string): string | null {
  return reason.trim().length === 0 ? null : validateReason(reason)
}

/**
 * When the elapsed/SLA clock started: the latest reopen, else the request. The
 * time a ticket spent as a false alarm is not counted. `before` limits it to
 * reopens that happened before a given moment (for a ticket rejected again).
 */
export function clockStart(ticket: RowActivities, before?: string): string | null {
  const reopenedAll = (ticket.date_activities ?? []).filter(a => a.date_category.category.includes(REOPENED_MATCH))
  const cutoff = before ? Date.parse(before) : Infinity
  const reopened = latestActivity(
    reopenedAll.filter(a => !(Date.parse(a.created_at) > cutoff)),
    REOPENED_MATCH
  )
  if (reopened) return reopened.created_at
  if (!before && ticket.reopened_activity) return ticket.reopened_activity.created_at
  return latestActivity(ticket.date_activities, 'Requested')?.created_at ?? null
}

/**
 * The elapsed time of a rejected request, frozen at the moment it was
 * rejected (the API runs no timer), counted from when its clock last started.
 * null when it isn't a false alarm or the dates are missing.
 */
export function frozenElapsed(ticket: Pick<DepartmentTicket, 'status'> & RowActivities): string | null {
  if (ticket.status !== FALSE_ALARM_STATUS) return null
  const rejected = falseAlarmEntry(ticket)
  if (!rejected) return null
  const start = clockStart(ticket, rejected.created_at)
  if (!start) return null
  const ms = new Date(rejected.created_at).getTime() - new Date(start).getTime()
  return Number.isFinite(ms) ? formatElapsed(ms / 1000) : null
}
