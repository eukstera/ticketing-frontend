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

/** A count that may arrive as null/undefined/NaN from the API, shown as a whole number. */
export function safeCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
