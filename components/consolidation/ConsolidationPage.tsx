'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FileDown, Loader2, SearchX } from 'lucide-react'
import Navbar from '@/components/NavBar'
import { toast } from '@/components/Toast'
import AppliedChips, { buildChips, withoutChip, type Chip } from '@/components/consolidation/AppliedChips'
import Breakdowns from '@/components/consolidation/Breakdowns'
import FilterPanel, { type OptionsState } from '@/components/consolidation/FilterPanel'
import KpiTiles, { KpiSkeleton } from '@/components/consolidation/KpiTiles'
import PreviewTable from '@/components/consolidation/PreviewTable'
import Pagination from '@/components/department-tickets/Pagination'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useConsolidatedExport } from '@/hooks/useConsolidatedExport'
import { useUser } from '@/hooks/useUser'
import { getErrorMessage, isAbortError, isApiError } from '@/lib/api'
import {
  FORBIDDEN_TOAST,
  canViewConsolidation,
  defaultFilters,
  getConsolidation,
  getConsolidationOptions,
  parseFilters,
  serializeFilters,
  type ConsolidationFilters,
} from '@/lib/consolidation'
import { btnPrimary } from '@/lib/styles'
import type { ConsolidationOptions, ConsolidationReport } from '@/types/consolidation'

interface ReportState {
  key: string
  data: ConsolidationReport | null
  error: string
  forbidden: boolean
}

interface OptionsResult {
  key: number
  data: ConsolidationOptions | null
}

export default function ConsolidationPage() {
  const authed = useAuthGuard()
  const user = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const exporter = useConsolidatedExport()

  const allowed = canViewConsolidation(user)
  // The role arrives with the stored user / GET /me; until it is known, don't redirect.
  const roleKnown = !!user?.role
  const enabled = authed && allowed

  const query = searchParams.toString()
  const applied = useMemo(() => parseFilters(new URLSearchParams(query)), [query])
  const appliedKey = serializeFilters(applied)

  const [reloadToken, setReloadToken] = useState(0)
  const [optionsToken, setOptionsToken] = useState(0)
  const [report, setReport] = useState<ReportState | null>(null)
  const [optionsResult, setOptionsResult] = useState<OptionsResult | null>(null)

  useEffect(() => {
    document.title = 'Consolidation – Ticketing System'
  }, [])

  useEffect(() => {
    if (authed && roleKnown && !allowed) {
      toast(FORBIDDEN_TOAST, 'error')
      router.replace('/dashboard')
    }
  }, [authed, roleKnown, allowed, router])

  const requestKey = `${appliedKey}|${reloadToken}`
  const loading = report?.key !== requestKey

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    getConsolidation(applied, controller.signal)
      .then(data => setReport({ key: requestKey, data, error: '', forbidden: false }))
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setReport(prev => ({
          key: requestKey,
          data: prev?.data ?? null,
          error: getErrorMessage(err, "Couldn't load the report."),
          forbidden: isApiError(err) && err.status === 403,
        }))
      })
    return () => controller.abort()
  }, [enabled, applied, requestKey])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    getConsolidationOptions(controller.signal)
      .then(data => setOptionsResult({ key: optionsToken, data }))
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setOptionsResult({ key: optionsToken, data: null })
      })
    return () => controller.abort()
  }, [enabled, optionsToken])

  const options: OptionsState =
    optionsResult?.key !== optionsToken
      ? { status: 'loading' }
      : optionsResult.data
        ? { status: 'ready', data: optionsResult.data }
        : { status: 'error' }

  const go = useCallback(
    (next: ConsolidationFilters) => {
      const qs = serializeFilters(next)
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname]
  )

  if (!authed || !allowed) return null

  const data = report?.data ?? null
  const error = !loading ? report?.error ?? '' : ''
  const forbidden = !loading && !!report?.forbidden
  const total = data?.tickets.total ?? 0
  const refreshing = loading && !!data
  const exportDisabled = exporter.busy || loading || !data || total === 0

  const chips = buildChips(
    applied,
    options.status === 'ready' ? { statuses: options.data.statuses, priorities: options.data.priorities, concern_types: options.data.concern_types, staff: options.data.staff } : {}
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Consolidation</h1>
            <p className="text-sm text-gray-500">Consolidated ticket report for your department.</p>
          </div>
          <div className="sm:text-right">
            <ExportButton
              busy={exporter.busy}
              slow={exporter.slow}
              disabled={exportDisabled}
              noMatches={!!data && total === 0}
              onClick={() => exporter.run(applied)}
            />
          </div>
        </div>

        <FilterPanel
          key={appliedKey.replace(/(^|&)page=\d+/, '')}
          applied={applied}
          options={options}
          onApply={go}
          onReset={() => go(defaultFilters())}
          onRetryOptions={() => {
            setOptionsResult(null)
            setOptionsToken(t => t + 1)
          }}
        />
        <AppliedChips chips={chips} onRemove={(chip: Chip) => go(withoutChip(applied, chip))} />

        <div className="mt-6 space-y-6">
          <ReportBody
            data={data}
            error={error}
            forbidden={forbidden}
            refreshing={refreshing}
            onRetry={() => setReloadToken(t => t + 1)}
            onReset={() => go(defaultFilters())}
            onPage={page => go({ ...applied, page })}
          />
        </div>
      </main>
    </div>
  )
}

const NO_MATCHES = 'No tickets match these filters'

export function ExportButton({
  busy,
  slow,
  disabled,
  noMatches,
  onClick,
}: {
  busy: boolean
  slow: boolean
  disabled: boolean
  /** The report loaded and has no tickets: say why the button is off. */
  noMatches: boolean
  onClick: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-describedby={noMatches ? 'consolidation-export-note' : undefined}
        title={noMatches ? NO_MATCHES : undefined}
        className={`${btnPrimary} w-full sm:w-auto`}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <FileDown size={16} aria-hidden="true" />
        )}
        {busy ? (slow ? 'Still working…' : 'Exporting…') : 'Export to Excel'}
      </button>
      {noMatches && (
        <span id="consolidation-export-note" className="sr-only">
          {NO_MATCHES}
        </span>
      )}
    </>
  )
}

/** Everything under the filters: first-load skeletons, error, empty, or the report. */
export function ReportBody({
  data,
  error,
  forbidden,
  refreshing,
  onRetry,
  onReset,
  onPage,
}: {
  data: ConsolidationReport | null
  error: string
  forbidden: boolean
  refreshing: boolean
  onRetry: () => void
  onReset: () => void
  onPage: (page: number) => void
}) {
  if (!data) {
    if (error) {
      return (
        <ErrorState
          message={forbidden ? error : `Couldn't load the report. ${error}`}
          onRetry={forbidden ? undefined : onRetry}
        />
      )
    }
    return (
      <>
        <KpiSkeleton />
        <TableSkeleton rows={8} columns={11} />
      </>
    )
  }
  const total = data.tickets.total
  return (
    <>
      {error && <ErrorState message={`Couldn't load the report. ${error}`} onRetry={onRetry} />}
      <KpiTiles summary={data.summary} />
      {data.breakdowns && (
        <Breakdowns byStatus={data.breakdowns.by_status ?? []} byPriority={data.breakdowns.by_priority ?? []} />
      )}
      <section aria-labelledby="consolidation-preview">
        <h2 id="consolidation-preview" className="text-base font-semibold text-gray-900">Preview</h2>
        <p className="mb-3 text-sm text-gray-500">
          Showing {data.tickets.data.length} of {total.toLocaleString('en-US')} tickets. The Excel export includes all of them.
        </p>
        {total === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white">
            <EmptyState
              icon={SearchX}
              title={NO_MATCHES}
              description="Try a wider date range or clear some filters."
              action={{ label: 'Reset filters', onClick: onReset }}
            />
          </div>
        ) : (
          <>
            <PreviewTable tickets={data.tickets.data} refreshing={refreshing} />
            <Pagination
              currentPage={data.tickets.current_page}
              lastPage={data.tickets.last_page}
              total={total}
              noun="tickets"
              onPageChange={onPage}
            />
          </>
        )}
      </section>
    </>
  )
}
