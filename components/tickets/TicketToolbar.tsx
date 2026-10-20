'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import {
  PER_PAGE_OPTIONS,
  SORT_KEYS,
  SORT_LABELS,
  SortKey,
  TicketListParams,
} from '@/lib/ticketList'
import { btnSecondary, btnSm, input, inputAuto } from '@/lib/styles'

const SEARCH_DEBOUNCE_MS = 300

type Update = (patch: Partial<TicketListParams>, mode?: 'push' | 'replace') => void

// Search box + date range + sort + page size. All values come from (and go
// back to) the URL params; only the search text keeps a local draft so typing
// isn't throttled by navigation.
export default function TicketToolbar({
  params,
  update,
  dateRangeInvalid,
  filtersActive,
  onClear,
}: {
  params: TicketListParams
  update: Update
  dateRangeInvalid: boolean
  filtersActive: boolean
  onClear: () => void
}) {
  // The draft only wins while the URL still holds the value it was typed over;
  // once the URL moves (debounce landed, or back/forward) the URL takes over.
  const [draft, setDraft] = useState<{ base: string; value: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchValue = draft && draft.base === params.search ? draft.value : params.search

  useEffect(() => {
    const pending = timer
    return () => {
      if (pending.current) clearTimeout(pending.current)
    }
  }, [])

  function handleSearch(value: string) {
    setDraft({ base: params.search, value })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => update({ search: value.trim() }, 'replace'), SEARCH_DEBOUNCE_MS)
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-gray-500">
          Search
          <span className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={searchValue}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Ticket #, area, requester, concern"
              className={`${input} pl-8`}
            />
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          From
          <input
            type="date"
            value={params.date_from ?? ''}
            max={params.date_to ?? undefined}
            onChange={e => update({ date_from: e.target.value || null })}
            className={inputAuto}
            aria-invalid={dateRangeInvalid}
            aria-describedby={dateRangeInvalid ? 'date-range-error' : undefined}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          To
          <input
            type="date"
            value={params.date_to ?? ''}
            min={params.date_from ?? undefined}
            onChange={e => update({ date_to: e.target.value || null })}
            className={inputAuto}
            aria-invalid={dateRangeInvalid}
            aria-describedby={dateRangeInvalid ? 'date-range-error' : undefined}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          Sort by
          <span className="flex gap-1">
            <select
              value={params.sort}
              onChange={e => update({ sort: e.target.value as SortKey })}
              className={inputAuto}
            >
              {SORT_KEYS.map(key => (
                <option key={key} value={key}>{SORT_LABELS[key]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => update({ dir: params.dir === 'asc' ? 'desc' : 'asc' })}
              aria-label={params.dir === 'asc' ? 'Ascending, switch to descending' : 'Descending, switch to ascending'}
              title={params.dir === 'asc' ? 'Ascending' : 'Descending'}
              className="flex w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {params.dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          Per page
          <select
            value={params.per_page}
            onChange={e => update({ per_page: Number(e.target.value) })}
            className={inputAuto}
          >
            {PER_PAGE_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        {filtersActive && (
          <button type="button" onClick={onClear} className={`${btnSecondary} ${btnSm} h-[38px]`}>
            Clear
          </button>
        )}
      </div>

      {dateRangeInvalid && (
        <p id="date-range-error" role="alert" className="text-xs text-red-600">
          &ldquo;To&rdquo; must be on or after &ldquo;From&rdquo;.
        </p>
      )}
    </div>
  )
}
