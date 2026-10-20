'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  EMPTY_LIST_PARAMS,
  TicketListParams,
  parseListParams,
  serializeListParams,
} from '@/lib/ticketList'

type NavMode = 'push' | 'replace'

// The ticket list filters live in the URL so links are shareable and
// back/forward restores them. Must render inside a <Suspense> boundary
// (useSearchParams opts the subtree into client-side rendering).
export function useTicketListParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const params = useMemo(() => parseListParams(new URLSearchParams(queryString)), [queryString])

  const navigate = useCallback(
    (next: TicketListParams, mode: NavMode) => {
      const qs = serializeListParams(next)
      const url = qs ? `${pathname}?${qs}` : pathname
      if (mode === 'push') router.push(url)
      else router.replace(url)
    },
    [pathname, router]
  )

  /**
   * Apply a patch to the current params. Any change other than `page` goes
   * back to page 1. Discrete choices (status, priority, paging, sort) push a
   * history entry; typing (`search`) and cleanups replace it.
   */
  const update = useCallback(
    (patch: Partial<TicketListParams>, mode: NavMode = 'push') => {
      const resetPage = !('page' in patch)
      navigate({ ...params, ...patch, ...(resetPage ? { page: 1 } : {}) }, mode)
    },
    [navigate, params]
  )

  const clearFilters = useCallback(() => {
    navigate(
      {
        ...EMPTY_LIST_PARAMS,
        per_page: params.per_page,
        sort: params.sort,
        dir: params.dir,
      },
      'push'
    )
  }, [navigate, params.per_page, params.sort, params.dir])

  /** Swap in a full set of params without adding a history entry. */
  const replaceParams = useCallback((next: TicketListParams) => navigate(next, 'replace'), [navigate])

  return { params, update, clearFilters, replaceParams }
}
