// Pure number helpers for the dashboard bars/percentages.

/** part/total as a whole percent in [0, 100]; 0 for an empty or invalid total. */
export function percentOf(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)))
}

/** Width (0-100, not rounded) of a bar for `count` relative to `max`; 0 when max is empty. */
export function barWidth(count: number, max: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(100, Math.max(0, (count / max) * 100))
}

/** 'SLA 3 working days' / 'SLA 1 working day' / 'No SLA' (sla_days of 0 means the priority has no SLA). */
export function slaLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'No SLA'
  return `SLA ${days} working ${days === 1 ? 'day' : 'days'}`
}

/** slaLabel for data that may not carry an SLA at all (undefined/null -> null, so callers can skip the row). */
export function optionalSlaLabel(days: number | null | undefined): string | null {
  return typeof days === 'number' ? slaLabel(days) : null
}

/** Accessible name for a ticket's comments button: "Comments for 10-001-2026, 3 comments". */
export function commentsLabel(ticketNumber: string, count?: number | null): string {
  const base = `Comments for ${ticketNumber}`
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return base
  return `${base}, ${count} ${count === 1 ? 'comment' : 'comments'}`
}

/** 'YYYY-MM' -> 'October 2026'; falls back to the raw value when it isn't a valid month. */
export function monthLabel(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth)
  if (!match) return yearMonth
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) return yearMonth
  return new Date(Number(match[1]), monthIndex, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** A count that may arrive as null/undefined/NaN from the API, shown as a whole number. */
export function safeCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Split an ISO timestamp into a long date ("20 October 2026") and a lowercase 12-hour time ("3:05 pm"). */
export function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase()
  return { date, time }
}

/** Elapsed whole seconds as "3d 4h 5m", "2h 5m 10s" or "5m 10s" (the tickets table's elapsed-time format). */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

/** "just now", "2m ago", "3h ago", "5d ago"; older than 30 days falls back to the date. '' for an invalid date. */
export function relativeTime(dateStr: string, now: number = Date.now()): string {
  const then = new Date(dateStr).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.floor((now - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDateTime(dateStr).date
}

/** formatDateTime as one string: "20 October 2026 3:05 pm". */
export function formatDateTimeText(dateStr: string): string {
  const { date, time } = formatDateTime(dateStr)
  return `${date} ${time}`
}

/**
 * A duration given in minutes as "2d 4h", "5h 30m", "45m" or "<1m"; "—" when
 * unknown (null/undefined/negative/not finite). Used by the Consolidation page.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return '—'
  if (minutes < 1) return '<1m'
  const total = Math.round(minutes)
  if (total < 60) return `${total}m`
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest ? `${days}d ${rest}h` : `${days}d`
}
