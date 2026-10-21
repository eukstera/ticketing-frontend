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

/** 'SLA 3 days' / 'SLA 1 day' / 'No SLA' (sla_days of 0 means the priority has no SLA). */
export function slaLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'No SLA'
  return `SLA ${days} ${days === 1 ? 'day' : 'days'}`
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

/** formatDateTime as one string: "20 October 2026 3:05 pm". */
export function formatDateTimeText(dateStr: string): string {
  const { date, time } = formatDateTime(dateStr)
  return `${date} ${time}`
}
