import { api } from '@/lib/api'
import { ADMIN_ROLE_NAME, type AuthUser } from '@/lib/auth'
import { IT_DEPARTMENT_ID } from '@/lib/constants'

export interface NewTicket {
  id: number
  ticket_number: string
  department_id: number
  department: string
  subject: string | null
  name_of_area: string | null
  priority: string | null
  requester: string | null
  created_at: string
}

export interface NewTicketsResult {
  tickets: NewTicket[]
  /** Highest existing ticket id; equals the after_id sent when nothing is new. */
  latest_id: number
  /** More than one page (20) was waiting; poll again straight away. */
  has_more: boolean
}

/** Only IT-department users and Department Heads get the alarm (the API 403s everyone else). */
export function canReceiveTicketAlarm(user: AuthUser | null | undefined): boolean {
  return user?.department_id === IT_DEPARTMENT_ID || user?.role?.name === ADMIN_ROLE_NAME
}

export const NO_SUBJECT = '(No subject)'

/** The API may send a null/blank subject. */
export function ticketSubject(subject: string | null | undefined): string {
  return subject?.trim() || NO_SUBJECT
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/**
 * One line per poll, however many tickets arrived: the count plus the first
 * ticket. maxSubject clips long subjects (the API allows 120 characters).
 */
export function describeNewTickets(tickets: NewTicket[], maxSubject = Infinity): string {
  const first = tickets[0]
  const head = `${first.ticket_number}: ${clip(ticketSubject(first.subject), maxSubject)}`
  if (tickets.length === 1) return `New ticket ${head}`
  return `${tickets.length} new tickets, starting with ${head}`
}

/**
 * Omit afterId for the first poll: the API then returns no tickets, only the
 * baseline latest_id. 0 is a valid cursor ("everything after id 0").
 */
export async function getNewTickets(afterId?: number, signal?: AbortSignal): Promise<NewTicketsResult> {
  const query = afterId === undefined ? '' : `?${new URLSearchParams({ after_id: String(afterId) })}`
  const res = await api.get<{ result: Partial<NewTicketsResult> }>(`/tickets/new${query}`, { signal })
  const r = res.result ?? {}
  return {
    tickets: Array.isArray(r.tickets) ? r.tickets : [],
    latest_id: typeof r.latest_id === 'number' ? r.latest_id : (afterId ?? 0),
    has_more: r.has_more === true,
  }
}
