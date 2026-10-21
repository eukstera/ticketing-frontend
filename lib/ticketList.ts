// Shared model for the ticket list screens (/tickets and /my-tickets): the
// URL-facing params, the id-vs-label filter mapping, and the normalized counts.
import type { PaginatedResponse, DepartmentTicket } from '@/types'

export const SORT_KEYS = ['requested_at', 'ticket_number', 'priority', 'status'] as const
export type SortKey = (typeof SORT_KEYS)[number]
export type SortDir = 'asc' | 'desc'

export const SORT_LABELS: Record<SortKey, string> = {
  requested_at: 'Requested date',
  ticket_number: 'Ticket number',
  priority: 'Priority',
  status: 'Status',
}

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const
export const DEFAULT_PER_PAGE = 10
export const DEFAULT_SORT: SortKey = 'requested_at'
export const DEFAULT_DIR: SortDir = 'desc'

export interface TicketListParams {
  page: number
  per_page: number
  search: string
  status_id: number | null
  priority_id: number | null
  /** Legacy label filters; only set by the old dashboard deep-link until resolved to ids. */
  status: string | null
  priority: string | null
  date_from: string | null // Y-m-d
  date_to: string | null // Y-m-d
  sort: SortKey
  dir: SortDir
}

export const EMPTY_LIST_PARAMS: TicketListParams = {
  page: 1,
  per_page: DEFAULT_PER_PAGE,
  search: '',
  status_id: null,
  priority_id: null,
  status: null,
  priority: null,
  date_from: null,
  date_to: null,
  sort: DEFAULT_SORT,
  dir: DEFAULT_DIR,
}

// ---- URL <-> params ---------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function intParam(value: string | null): number | null {
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

export function parseListParams(sp: URLSearchParams): TicketListParams {
  const page = intParam(sp.get('page'))
  const perPage = intParam(sp.get('per_page'))
  const sort = sp.get('sort')
  const dir = sp.get('dir')
  const dateFrom = sp.get('date_from')
  const dateTo = sp.get('date_to')

  return {
    page: page && page > 0 ? page : 1,
    per_page: perPage && perPage >= 1 && perPage <= 100 ? perPage : DEFAULT_PER_PAGE,
    search: sp.get('search') ?? '',
    status_id: intParam(sp.get('status_id')),
    priority_id: intParam(sp.get('priority_id')),
    status: sp.get('status') || null,
    priority: sp.get('priority') || null,
    date_from: dateFrom && DATE_RE.test(dateFrom) ? dateFrom : null,
    date_to: dateTo && DATE_RE.test(dateTo) ? dateTo : null,
    sort: (SORT_KEYS as readonly string[]).includes(sort ?? '') ? (sort as SortKey) : DEFAULT_SORT,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_DIR,
  }
}

/** Query string for the page URL; defaults are omitted to keep links short. */
export function serializeListParams(p: TicketListParams): string {
  const sp = new URLSearchParams()
  if (p.page > 1) sp.set('page', String(p.page))
  if (p.per_page !== DEFAULT_PER_PAGE) sp.set('per_page', String(p.per_page))
  if (p.search) sp.set('search', p.search)
  if (p.status_id !== null) sp.set('status_id', String(p.status_id))
  if (p.priority_id !== null) sp.set('priority_id', String(p.priority_id))
  if (p.status && p.status_id === null) sp.set('status', p.status)
  if (p.priority && p.priority_id === null) sp.set('priority', p.priority)
  if (p.date_from) sp.set('date_from', p.date_from)
  if (p.date_to) sp.set('date_to', p.date_to)
  if (p.sort !== DEFAULT_SORT) sp.set('sort', p.sort)
  if (p.dir !== DEFAULT_DIR) sp.set('dir', p.dir)
  return sp.toString()
}

export function hasActiveFilters(p: TicketListParams): boolean {
  return !!(
    p.search ||
    p.status_id !== null ||
    p.priority_id !== null ||
    p.status ||
    p.priority ||
    p.date_from ||
    p.date_to
  )
}

// ---- Counts -----------------------------------------------------------------

export interface StatusCount {
  /** null is the "All" entry. */
  id: number | null
  label: string
  count: number
  /** Synthesized from the old Record response; filter by label, not id. */
  legacy?: boolean
}

export interface PriorityCount {
  id: number
  level: string
  sla_days: number
  count: number
  legacy?: boolean
}

type RawStatusCounts = StatusCount[] | Record<string, number>
type RawPriorityCounts = PriorityCount[] | Record<string, number>

export interface RawTicketListResponse {
  message: string
  result: {
    ticket: PaginatedResponse<DepartmentTicket>
    status_counts: RawStatusCounts
    priority_counts: RawPriorityCounts
    priority_sla?: Record<string, number>
  }
}

export interface TicketListResult {
  tickets: PaginatedResponse<DepartmentTicket>
  statusCounts: StatusCount[]
  priorityCounts: PriorityCount[]
}

// TODO(BE-phase2): drop the Record branches once the BE ships the array form.
export function normalizeStatusCounts(raw: RawStatusCounts): StatusCount[] {
  if (Array.isArray(raw)) return raw
  return Object.entries(raw ?? {}).map(([label, count], i) =>
    label === 'All'
      ? { id: null, label, count }
      : { id: -(i + 1), label, count, legacy: true }
  )
}

export function normalizePriorityCounts(
  raw: RawPriorityCounts,
  slaByLevel: Record<string, number> = {}
): PriorityCount[] {
  if (Array.isArray(raw)) return raw
  return Object.entries(raw ?? {}).map(([level, count], i) => ({
    id: -(i + 1),
    level,
    sla_days: coerceSla(slaByLevel[level]) ?? 0,
    count,
    legacy: true,
  }))
}

/**
 * List rows have returned `priority_sla` as a string ("10") while the other
 * endpoints return numbers. null/undefined pass through; anything that is not
 * a finite number becomes null.
 */
export function coerceSla(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeListResponse(res: RawTicketListResponse): TicketListResult {
  const page = res.result.ticket
  return {
    tickets: {
      ...page,
      data: (page.data ?? []).map(row => ({ ...row, priority_sla: coerceSla(row.priority_sla) })),
    },
    statusCounts: normalizeStatusCounts(res.result.status_counts),
    priorityCounts: normalizePriorityCounts(res.result.priority_counts, res.result.priority_sla),
  }
}

// ---- Filter param mapping ---------------------------------------------------
// The single place that decides how a selected status/priority reaches the
// API. Ids are preferred (`status_id` / `priority_id`); the old BE (and the
// dashboard deep-link) only understand labels, so entries flagged `legacy`
// are sent by label instead.

export function buildListQuery(
  p: TicketListParams,
  counts?: { statusCounts?: StatusCount[]; priorityCounts?: PriorityCount[] }
): URLSearchParams {
  const q = new URLSearchParams({ page: String(p.page), per_page: String(p.per_page) })
  if (p.search) q.set('search', p.search)

  const status = counts?.statusCounts?.find(s => s.id === p.status_id)
  if (p.status_id !== null && !status?.legacy) q.set('status_id', String(p.status_id))
  else if (status?.legacy) q.set('status', status.label)
  else if (p.status) q.set('status', p.status)

  const priority = counts?.priorityCounts?.find(c => c.id === p.priority_id)
  if (p.priority_id !== null && !priority?.legacy) q.set('priority_id', String(p.priority_id))
  else if (priority?.legacy) q.set('priority', priority.level)
  else if (p.priority) q.set('priority', p.priority)

  if (p.date_from) q.set('date_from', p.date_from)
  if (p.date_to) q.set('date_to', p.date_to)
  q.set('sort', p.sort)
  q.set('dir', p.dir)
  return q
}

/** Resolve legacy label filters (deep-link) to ids once counts are known. */
export function resolveLegacyFilters(
  p: TicketListParams,
  counts: { statusCounts: StatusCount[]; priorityCounts: PriorityCount[] }
): TicketListParams | null {
  let changed = false
  const next = { ...p }

  if (p.status && p.status_id === null) {
    const hit = counts.statusCounts.find(s => s.label === p.status)
    if (hit?.id != null) {
      next.status_id = hit.id
      next.status = null
      changed = true
    }
  }
  if (p.priority && p.priority_id === null) {
    const hit = counts.priorityCounts.find(c => c.level === p.priority)
    if (hit) {
      next.priority_id = hit.id
      next.priority = null
      changed = true
    }
  }
  return changed ? next : null
}
