import { isAdmin, isEncoder, type AuthUser } from '@/lib/auth'
import { IT_DEPARTMENT_ID } from '@/lib/constants'
import type { DepartmentTicket } from '@/types'

export const BLANK_STATUS = 'Blank'
export const VOID_STATUS = 'Void'

export const VOID_REASON_MIN = 5
export const VOID_REASON_MAX = 255

/** Shown where a Blank ticket has no value yet (area, concern type). */
export const NOT_FILLED_IN_TEXT = 'Not filled in yet'

/**
 * The owner is whoever printed the blank job order: `owner_id` (from a detail's
 * assignee) or, on a list row, `assigned_activity.user_id`.
 */
type BlankTicket = Pick<DepartmentTicket, 'status' | 'department_id'> &
  Partial<Pick<DepartmentTicket, 'assigned_activity'>> & { owner_id?: number | null }

function ownerId(ticket: BlankTicket): number | null {
  return ticket.owner_id ?? ticket.assigned_activity?.user_id ?? null
}

/**
 * Who sees "Print blank job order": IT department staff and IT Department
 * Heads, never Encoders. (The API 403s everyone else.)
 */
export function canPrintBlank(user: AuthUser | null | undefined): boolean {
  return !!user && !isEncoder(user) && user.department_id === IT_DEPARTMENT_ID
}

/** Member of the ticket's department or a Department Head, and not an Encoder. */
function isBlankStaff(ticket: BlankTicket, user: AuthUser | null | undefined): user is AuthUser {
  if (!user || isEncoder(user) || ticket.status !== BLANK_STATUS) return false
  return user.department_id === ticket.department_id || isAdmin(user)
}

/**
 * Whoever printed a blank job order owns the ticket. Only the owner or a
 * Department Head works on it (fill in, void, reject); other staff get a 403.
 */
export function canWorkOnBlank(ticket: BlankTicket, user: AuthUser | null | undefined): boolean {
  if (!isBlankStaff(ticket, user)) return false
  return isAdmin(user) || ownerId(ticket) === user.id
}

/** "Fill in": open the fill-in page for a Blank ticket. */
export function canFillBlank(ticket: BlankTicket, user: AuthUser | null | undefined): boolean {
  return canWorkOnBlank(ticket, user)
}

/** "Reprint JO": the blank PDF again (any staff of the department, and heads; the API only serves PDF while Blank). */
export function canReprintBlank(ticket: BlankTicket, user: AuthUser | null | undefined): boolean {
  return isBlankStaff(ticket, user)
}

/** "Void": cancel a Blank ticket that will never be filled in (owner or head). */
export function canVoid(ticket: BlankTicket, user: AuthUser | null | undefined): boolean {
  return canWorkOnBlank(ticket, user)
}

/** Client-side check before sending; the API enforces the same 5..255 (422 errors.reason). */
export function validateVoidReason(reason: string): string | null {
  const length = reason.trim().length
  if (length === 0) return 'Enter a reason.'
  if (length < VOID_REASON_MIN) return `The reason must be at least ${VOID_REASON_MIN} characters.`
  if (length > VOID_REASON_MAX) return `The reason must be at most ${VOID_REASON_MAX} characters.`
  return null
}

export interface BlankTicketRef {
  id: number
  ticket_number: string
}

export type PrintBlankResult =
  | { reserved: false; error: unknown }
  /** The number is reserved. `saved` is false when the PDF didn't download; use Reprint. */
  | { reserved: true; ticket: BlankTicketRef; saved: true }
  | { reserved: true; ticket: BlankTicketRef; saved: false; message: string }

/**
 * Reserve a blank ticket number, then download its PDF. The download is only
 * attempted after the reserve succeeded, and whatever happens to it can never
 * hide that a number was used (it is reprintable from the list).
 */
export async function printBlankJobOrder(deps: {
  reserve: () => Promise<BlankTicketRef>
  download: (ticket: BlankTicketRef) => Promise<{ ok: true } | { ok: false; message: string }>
}): Promise<PrintBlankResult> {
  let ticket: BlankTicketRef
  try {
    ticket = await deps.reserve()
  } catch (error) {
    return { reserved: false, error }
  }
  try {
    const res = await deps.download(ticket)
    if (res.ok) return { reserved: true, ticket, saved: true }
    return { reserved: true, ticket, saved: false, message: res.message }
  } catch (err) {
    console.error(err)
    return { reserved: true, ticket, saved: false, message: "Couldn't download the job order." }
  }
}
