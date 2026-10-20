import { api } from '@/lib/api'

// Generic helpers for the admin CRUD endpoints (see the BE contract, Phase 2
// section (c)). Lists are paginated under result.<plural>; a few lookups
// (e.g. GET /roles) return a bare array instead.

export interface AdminRow {
  id: number
  status?: boolean
  [key: string]: unknown
}

export interface Paginator<T> {
  current_page: number
  last_page: number
  total: number
  per_page: number
  data: T[]
}

export const ADMIN_PER_PAGE = 15

export function toPaginator<T>(value: unknown, perPage = ADMIN_PER_PAGE): Paginator<T> {
  if (Array.isArray(value)) {
    return { current_page: 1, last_page: 1, total: value.length, per_page: perPage, data: value as T[] }
  }
  const v = (value ?? {}) as Partial<Paginator<T>>
  return {
    current_page: v.current_page ?? 1,
    last_page: v.last_page ?? 1,
    total: v.total ?? v.data?.length ?? 0,
    per_page: v.per_page ?? perPage,
    data: v.data ?? [],
  }
}

type Query = Record<string, string | number | undefined | null>

export function buildQuery(query: Query): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listAdmin<T = AdminRow>(
  endpoint: string,
  listKey: string,
  query: Query,
  signal?: AbortSignal
): Promise<Paginator<T>> {
  const res = await api.get<{ result: Record<string, unknown> }>(
    `${endpoint}${buildQuery(query)}`,
    { signal }
  )
  return toPaginator<T>(res.result?.[listKey])
}

export function createAdmin(endpoint: string, body: Record<string, unknown>) {
  return api.post(endpoint, body)
}

export function updateAdmin(endpoint: string, id: number, body: Record<string, unknown>) {
  return api.patch(`${endpoint}/${id}`, body)
}

export function deactivateAdmin(endpoint: string, id: number) {
  return api.delete(`${endpoint}/${id}`)
}

export function reactivateAdmin(endpoint: string, id: number) {
  return updateAdmin(endpoint, id, { status: true })
}
