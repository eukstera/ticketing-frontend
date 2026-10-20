'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type AdminStatus = 'all' | 'active' | 'inactive'

export interface AdminListParams {
  page: number
  search: string
  status: AdminStatus
  filters: Record<string, string>
}

const STATUSES: AdminStatus[] = ['all', 'active', 'inactive']

// Admin list state (page, search, status, extra filters) lives in the query
// string, like the ticket lists. Defaults are omitted from the URL. Must render
// inside a <Suspense> boundary (useSearchParams).
export function useAdminListParams(filterKeys: readonly string[]) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const keysId = filterKeys.join(',')

  const params = useMemo<AdminListParams>(() => {
    const sp = new URLSearchParams(queryString)
    const page = Number(sp.get('page'))
    const status = sp.get('status') as AdminStatus
    const filters: Record<string, string> = {}
    for (const key of keysId ? keysId.split(',') : []) {
      const v = sp.get(key)
      if (v) filters[key] = v
    }
    return {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      search: sp.get('search') ?? '',
      status: STATUSES.includes(status) ? status : 'all',
      filters,
    }
  }, [queryString, keysId])

  /** Patch the params; anything other than `page` goes back to page 1. */
  const update = useCallback(
    (patch: Partial<AdminListParams>, mode: 'push' | 'replace' = 'push') => {
      const next = { ...params, ...patch, ...('page' in patch ? {} : { page: 1 }) }
      const sp = new URLSearchParams()
      if (next.page > 1) sp.set('page', String(next.page))
      if (next.search) sp.set('search', next.search)
      if (next.status !== 'all') sp.set('status', next.status)
      for (const [k, v] of Object.entries(next.filters)) if (v) sp.set(k, v)
      const qs = sp.toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      if (mode === 'push') router.push(url)
      else router.replace(url)
    },
    [params, pathname, router]
  )

  return { params, update }
}
