// lib/consolidation.ts
// The Consolidation report (/reports/consolidated): filter model, URL and query
// building, the access rule, display helpers, and the API calls.
import { api } from './api'
import { isAdmin, isEncoder, type AuthUser } from './auth'
import { saveBlob } from './download'
import type { ConsolidationOptions, ConsolidationReport } from '@/types/consolidation'

export const PER_PAGE = 15
export const DEFAULT_RANGE_DAYS = 30
export const FORBIDDEN_TOAST = "You don't have access to Consolidation."
export const BLOCKED_MESSAGE = 'Your browser blocked the download. Click Export again.'
export const EXPORT_FAILED_MESSAGE = "Couldn't generate the report. Please try again."
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export type DateBasis = 'requested' | 'completed'

export interface ConsolidationFilters {
  basis: DateBasis
  from: string // Y-m-d
  to: string // Y-m-d
  /** Requesting department / section names (free text). */
  area: string[]
  status: number[]
  priority: number[]
  type: number[]
  staff: number[]
  page: number
}

/** Encoders and Department Heads only (the API enforces it; this only hides the page). */
export function canViewConsolidation(user: AuthUser | null | undefined): boolean {
  return isEncoder(user) || isAdmin(user)
}

// ---- Dates ------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Local Y-m-d (toISOString is UTC and can be a day off). */
export function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** The last 30 days including today, matching the API default. */
export function defaultRange(today: Date = new Date()): { from: string; to: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DEFAULT_RANGE_DAYS - 1))
  return { from: toYmd(start), to: toYmd(today) }
}

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/** Y-m-d strings compare lexically. Null when usable. */
export function rangeError(from: string, to: string): string | null {
  if (from && to && from > to) return 'From date must be on or before To date.'
  return null
}

// ---- Filters <-> URL --------------------------------------------------------

export function defaultFilters(today: Date = new Date()): ConsolidationFilters {
  return { basis: 'requested', ...defaultRange(today), area: [], status: [], priority: [], type: [], staff: [], page: 1 }
}

function ids(value: string | null): number[] {
  if (!value) return []
  const parsed = value.split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0)
  return [...new Set(parsed)]
}

function names(value: string | null): string[] {
  if (!value) return []
  const out: string[] = []
  for (const part of value.split(',')) {
    let name = part
    try {
      name = decodeURIComponent(part)
    } catch {
      // junk escape: keep the raw text
    }
    name = name.trim()
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/** Parses the page URL defensively: anything unusable falls back to the default. */
export function parseFilters(sp: URLSearchParams, today: Date = new Date()): ConsolidationFilters {
  const base = defaultFilters(today)
  const from = sp.get('from') ?? ''
  const to = sp.get('to') ?? ''
  const rangeOk = isRealDate(from) && isRealDate(to) && from <= to
  const page = Number(sp.get('page'))
  return {
    basis: sp.get('basis') === 'completed' ? 'completed' : 'requested',
    from: rangeOk ? from : base.from,
    to: rangeOk ? to : base.to,
    area: names(sp.get('area')),
    status: ids(sp.get('status')),
    priority: ids(sp.get('priority')),
    type: ids(sp.get('type')),
    staff: ids(sp.get('staff')),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** The page URL's query string: defaults omitted, comma lists, area names encoded one by one. */
export function serializeFilters(f: ConsolidationFilters, today: Date = new Date()): string {
  const base = defaultFilters(today)
  const sp = new URLSearchParams()
  if (f.basis !== 'requested') sp.set('basis', f.basis)
  if (f.from !== base.from || f.to !== base.to) {
    sp.set('from', f.from)
    sp.set('to', f.to)
  }
  if (f.area.length) sp.set('area', f.area.map(encodeURIComponent).join(','))
  if (f.status.length) sp.set('status', f.status.join(','))
  if (f.priority.length) sp.set('priority', f.priority.join(','))
  if (f.type.length) sp.set('type', f.type.join(','))
  if (f.staff.length) sp.set('staff', f.staff.join(','))
  if (f.page > 1) sp.set('page', String(f.page))
  return sp.toString()
}

/** The API query string. `withPage: false` is the export (same filters, no paging). */
export function buildQuery(f: ConsolidationFilters, { withPage = true } = {}): string {
  const sp = new URLSearchParams()
  sp.set('from', f.from)
  sp.set('to', f.to)
  sp.set('date_field', f.basis)
  f.area.forEach(v => sp.append('requesting_area[]', v))
  f.status.forEach(v => sp.append('status_id[]', String(v)))
  f.priority.forEach(v => sp.append('priority_id[]', String(v)))
  f.type.forEach(v => sp.append('concern_type_id[]', String(v)))
  f.staff.forEach(v => sp.append('staff_id[]', String(v)))
  if (withPage) {
    sp.set('page', String(f.page))
    sp.set('per_page', String(PER_PAGE))
  }
  return sp.toString()
}

export function filtersEqual(a: ConsolidationFilters, b: ConsolidationFilters): boolean {
  return serializeFilters(a) === serializeFilters(b)
}

export function activeFilterCount(f: ConsolidationFilters): number {
  return f.area.length + f.status.length + f.priority.length + f.type.length + f.staff.length
}

// ---- Display ----------------------------------------------------------------

export const DASH = '—'

/** 0–100 with one decimal, or "—". */
export function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : DASH
}

/** A 1–5 satisfaction score such as "4.3 / 5", or "—". */
export function formatScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} / 5` : DASH
}

/** A whole count with thousands separators. */
export function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : DASH
}

/** A ticket's survey score as "4/5", or "—". */
export function formatSurvey(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}/5` : DASH
}

// ---- API --------------------------------------------------------------------

export function getConsolidationOptions(signal?: AbortSignal) {
  return api
    .get<{ result: ConsolidationOptions }>('/reports/consolidated/options', { signal })
    .then(res => res.result)
}

export function getConsolidation(filters: ConsolidationFilters, signal?: AbortSignal) {
  return api
    .get<{ result: ConsolidationReport }>(`/reports/consolidated?${buildQuery(filters)}`, { signal })
    .then(res => res.result)
}

export function exportFilename(f: Pick<ConsolidationFilters, 'from' | 'to'>): string {
  return `consolidation_${f.from}_${f.to}.xlsx`
}

export interface ExportDeps {
  fetchFile: typeof api.getBlob
  save: typeof saveBlob
}

const realDeps: ExportDeps = { fetchFile: api.getBlob, save: saveBlob }

/** Downloads the Excel for the APPLIED filters. Throws ApiError on failure; `saved` is false if the browser blocked it. */
export async function exportConsolidation(
  filters: ConsolidationFilters,
  signal?: AbortSignal,
  deps: ExportDeps = realDeps
): Promise<{ saved: boolean; filename: string }> {
  const { blob, filename } = await deps.fetchFile(
    `/reports/consolidated/export?${buildQuery(filters, { withPage: false })}`,
    XLSX_MIME,
    { signal }
  )
  const name = filename ?? exportFilename(filters)
  return { saved: deps.save(blob, name), filename: name }
}
