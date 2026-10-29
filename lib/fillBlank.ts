// lib/fillBlank.ts
// Filling in a blank job order (PATCH /tickets/{id}/fill-blank): the
// payload, and the date helpers for the "Date & time requested" field.
import { api } from './api'
import type { CreateTicketDevice } from './tickets'

export const ALREADY_FILLED_MESSAGE = 'This ticket has already been filled in.'
export const FUTURE_DATE_MESSAGE = "The requested date can't be in the future."

export interface FillBlankPayload {
  /** "YYYY-MM-DD HH:mm", now or earlier. */
  requested_at: string
  /** The name written on the paper form. */
  requestor: string
  requestor_email?: string
  area_supervisor: string
  type_of_concern: string
  name_of_area: string
  remarks: string
  /** Id of an active priority of the department. */
  priority: number
  /** A Head may pass any department member; staff only their own id. */
  assigned_user?: number
  /** Required when type_of_concern is "Hardware". */
  devices?: CreateTicketDevice[]
}

export function fillBlankTicket(ticketId: number, payload: FillBlankPayload) {
  return api.patch<{ message: string; result: { ticket: { id: number; ticket_number: string } } }>(
    `/tickets/${ticketId}/fill-blank`,
    payload
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** A Date as the value/max of an <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", local time). */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "2026-10-28T14:30" to the API's "2026-10-28 14:30". */
export function toApiDateTime(localValue: string): string {
  return localValue.replace('T', ' ').slice(0, 16)
}

/** Message for an empty or future "Date & time requested", else null. */
export function requestedAtError(localValue: string, now: Date = new Date()): string | null {
  if (!localValue) return 'Enter the date and time requested.'
  const parsed = new Date(localValue)
  if (Number.isNaN(parsed.getTime())) return 'Enter a valid date and time.'
  return parsed.getTime() > now.getTime() ? FUTURE_DATE_MESSAGE : null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}
