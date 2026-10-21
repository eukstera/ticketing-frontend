export type AdminStatus = 'all' | 'active' | 'inactive'

export interface AdminListParams {
  page: number
  search: string
  status: AdminStatus
  filters: Record<string, string>
}

const STATUSES: AdminStatus[] = ['all', 'active', 'inactive']

export function parseAdminParams(sp: URLSearchParams, filterKeys: readonly string[]): AdminListParams {
  const page = Number(sp.get('page'))
  const status = sp.get('status') as AdminStatus
  const filters: Record<string, string> = {}
  for (const key of filterKeys) {
    const v = sp.get(key)
    if (v) filters[key] = v
  }
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    search: sp.get('search') ?? '',
    status: STATUSES.includes(status) ? status : 'all',
    filters,
  }
}

/** Query string for the page URL; defaults are omitted. */
export function serializeAdminParams(p: AdminListParams): string {
  const sp = new URLSearchParams()
  if (p.page > 1) sp.set('page', String(p.page))
  if (p.search) sp.set('search', p.search)
  if (p.status !== 'all') sp.set('status', p.status)
  for (const [k, v] of Object.entries(p.filters)) if (v) sp.set(k, v)
  return sp.toString()
}
