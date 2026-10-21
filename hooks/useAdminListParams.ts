'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AdminListParams, parseAdminParams, serializeAdminParams } from '@/lib/adminList'

export type { AdminStatus, AdminListParams } from '@/lib/adminList'

// Admin list state (page, search, status, extra filters) lives in the query
// string, like the ticket lists. Defaults are omitted from the URL. Must render
// inside a <Suspense> boundary (useSearchParams).
export function useAdminListParams(filterKeys: readonly string[]) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const keysId = filterKeys.join(',')

  const params = useMemo<AdminListParams>(
    () => parseAdminParams(new URLSearchParams(queryString), keysId ? keysId.split(',') : []),
    [queryString, keysId]
  )

  /** Patch the params; anything other than `page` goes back to page 1. */
  const update = useCallback(
    (patch: Partial<AdminListParams>, mode: 'push' | 'replace' = 'push') => {
      const next = { ...params, ...patch, ...('page' in patch ? {} : { page: 1 }) }
      const qs = serializeAdminParams(next)
      const url = qs ? `${pathname}?${qs}` : pathname
      if (mode === 'push') router.push(url)
      else router.replace(url)
    },
    [params, pathname, router]
  )

  return { params, update }
}
