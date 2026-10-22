import { ticketSubject, type NewTicket } from '@/lib/newTickets'

// Client-side list behind the NavBar bell. A module singleton (every page mounts
// its own NavBar), mirrored in sessionStorage so a navigation or reload keeps
// the unread state; cleared on logout. The list is replaced, never mutated, so
// it can be a useSyncExternalStore snapshot.

export interface TicketNotification {
  /** The ticket id (also the detail page route). */
  id: number
  ticket_number: string
  subject: string
  requester: string | null
  /** When the ticket was created (ISO 8601); shown as relative time. */
  created_at: string
  read: boolean
}

export const MAX_NOTIFICATIONS = 30
const STORAGE_KEY = 'ticket-notifications'

const EMPTY: readonly TicketNotification[] = []
const listeners = new Set<() => void>()
let items: readonly TicketNotification[] | null = null

function isNotification(v: unknown): v is TicketNotification {
  const n = v as Partial<TicketNotification> | null
  return (
    !!n &&
    typeof n.id === 'number' &&
    typeof n.ticket_number === 'string' &&
    typeof n.subject === 'string' &&
    typeof n.created_at === 'string' &&
    typeof n.read === 'boolean'
  )
}

// sessionStorage can throw or hold junk (private mode, blocked data, old format).
function load(): readonly TicketNotification[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isNotification).slice(0, MAX_NOTIFICATIONS) : []
  } catch {
    return []
  }
}

function set(next: readonly TicketNotification[]) {
  items = next
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Not mirrored; the list still holds for this page load.
  }
  listeners.forEach(l => l())
}

/** Newest first. The same array is returned until something changes. */
export function getNotifications(): readonly TicketNotification[] {
  if (items === null) items = load()
  return items
}

export function getServerNotifications(): readonly TicketNotification[] {
  return EMPTY
}

export function unreadCount(list: readonly TicketNotification[]): number {
  return list.reduce((n, item) => n + (item.read ? 0 : 1), 0)
}

export function subscribeNotifications(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Adds unread notifications for tickets the list doesn't have yet. `tickets` is oldest first, as the API sends it. */
export function addNotifications(tickets: NewTicket[]) {
  const current = getNotifications()
  const known = new Set(current.map(n => n.id))
  const fresh: TicketNotification[] = []
  for (const t of tickets) {
    if (known.has(t.id)) continue
    known.add(t.id)
    fresh.unshift({
      id: t.id,
      ticket_number: t.ticket_number,
      subject: ticketSubject(t.subject),
      requester: t.requester,
      created_at: t.created_at,
      read: false,
    })
  }
  if (fresh.length === 0) return
  set([...fresh, ...current].slice(0, MAX_NOTIFICATIONS))
}

export function markRead(id: number) {
  const current = getNotifications()
  if (!current.some(n => n.id === id && !n.read)) return
  set(current.map(n => (n.id === id ? { ...n, read: true } : n)))
}

export function markAllRead() {
  const current = getNotifications()
  if (unreadCount(current) === 0) return
  set(current.map(n => (n.read ? n : { ...n, read: true })))
}

export function clearNotifications() {
  if (getNotifications().length === 0) return
  set(EMPTY)
}
