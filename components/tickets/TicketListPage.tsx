'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, SearchX, Inbox } from 'lucide-react'
import Navbar from '@/components/NavBar'
import AssignModal from '@/components/AssignModal'
import CommentsModal from '@/components/CommentsModal'
import ConfirmModal from '@/components/ConfirmModal'
import FalseAlarmModal from '@/components/FalseAlarmModal'
import CompleteModal from '@/components/CompleteModal'
import CloseOnBehalfModal from '@/components/CloseOnBehalfModal'
import ReopenModal from '@/components/ReopenModal'
import AccomplishmentModal from '@/components/AccomplishmentModal'
import FilterPills from '@/components/department-tickets/FilterPills'
import TicketsTable from '@/components/department-tickets/TicketsTable'
import Pagination from '@/components/department-tickets/Pagination'
import TicketToolbar from '@/components/tickets/TicketToolbar'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/Toast'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { useJobOrderDownload } from '@/hooks/useJobOrderDownload'
import { useTicketListParams } from '@/hooks/useTicketListParams'
import { getErrorMessage, isAbortError, isApiError } from '@/lib/api'
import { IT_DEPARTMENT_ID } from '@/lib/constants'
import {
  getDepartmentTickets,
  getMyTickets,
  markTicketComplete,
  closeTicketOnBehalf,
  resendConfirmation,
  assignTicket,
  markFalseAlarm,
  reopenTicket,
  takeTicket,
} from '@/lib/tickets'
import { falseAlarmEntry } from '@/lib/falseAlarm'
import { completionMessage } from '@/lib/confirmation'
import { canDownloadJobOrder, takeThenJobOrder } from '@/lib/jobOrder'
import type { JobOrderFormat } from '@/lib/jobOrderFormat'
import {
  TicketListResult,
  hasActiveFilters,
  resolveLegacyFilters,
  serializeListParams,
} from '@/lib/ticketList'
import { buildPriorityPills, buildStatusPills } from '@/components/tickets/pills'
import { btnTint } from '@/lib/styles'

type Mode = 'department' | 'mine'

const COPY: Record<Mode, { title: string; subtitle: string; empty: string }> = {
  department: {
    title: 'Department Tickets',
    subtitle: 'Tickets assigned to your department',
    empty: 'No tickets have been created for your department yet.',
  },
  mine: {
    title: 'My Tickets',
    subtitle: 'Tickets you requested or are assigned to',
    empty: "You don't have any tickets yet.",
  },
}

interface FetchState {
  key: string
  data: TicketListResult | null
  error: string
}

export default function TicketListPage({ mode }: { mode: Mode }) {
  const authed = useAuthGuard()
  const user = useUser()
  const { params, update, clearFilters, replaceParams } = useTicketListParams()

  const [fetchState, setFetchState] = useState<FetchState | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [expanded, setExpanded] = useState<number[]>([])
  const [assignTicketId, setAssignTicketId] = useState<number | null>(null)
  const [commentsTicketId, setCommentsTicketId] = useState<number | null>(null)
  const [completeTicketId, setCompleteTicketId] = useState<number | null>(null)
  const [resendTicketId, setResendTicketId] = useState<number | null>(null)
  const [resending, setResending] = useState(false)
  const [resendError, setResendError] = useState('')
  const [closeTicketId, setCloseTicketId] = useState<number | null>(null)
  const [takingId, setTakingId] = useState<number | null>(null)
  const [falseAlarmTicketId, setFalseAlarmTicketId] = useState<number | null>(null)
  const [reopenTicketId, setReopenTicketId] = useState<number | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const jobOrder = useJobOrderDownload()

  const copy = COPY[mode]
  const dateRangeInvalid = !!(params.date_from && params.date_to && params.date_to < params.date_from)
  const requestKey = serializeListParams(params)
  const loading = !dateRangeInvalid && fetchState?.key !== requestKey
  const data = fetchState?.data ?? null
  const error = loading ? '' : fetchState?.error ?? ''
  // Counts of the last good response, kept across refetches so the pills don't blink.
  const counts = useMemo(
    () => (data ? { statusCounts: data.statusCounts, priorityCounts: data.priorityCounts } : undefined),
    [data]
  )

  useEffect(() => {
    if (!authed || dateRangeInvalid) return
    const controller = new AbortController()
    const fetcher = mode === 'mine' ? getMyTickets : getDepartmentTickets

    fetcher(params, counts, controller.signal)
      .then(result => setFetchState({ key: requestKey, data: result, error: '' }))
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setFetchState(prev => ({
          key: requestKey,
          data: prev?.data ?? null,
          error: getErrorMessage(err, 'Failed to load tickets'),
        }))
      })
    return () => controller.abort()
    // `params` is fully described by requestKey; `counts` only matters for the
    // legacy label mapping and must not retrigger a fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, mode, requestKey, reloadToken, dateRangeInvalid])

  // A dashboard deep-link arrives as a label (?status=Open). Swap it for the
  // id once the counts that carry the id->label mapping are in.
  useEffect(() => {
    if (!counts || (!params.status && !params.priority)) return
    const resolved = resolveLegacyFilters(params, counts)
    if (resolved) replaceParams(resolved)
  }, [counts, params, replaceParams])

  function refresh() {
    setReloadToken(t => t + 1)
  }

  function retry() {
    setFetchState(null)
    refresh()
  }

  function toggleExpand(id: number) {
    setExpanded(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  // Completing needs notes and leaves the ticket "Pending Confirmation" until the
  // requester answers. Throws on failure so the dialog stays open with the message.
  async function handleComplete(ticketId: number, notes: string) {
    let res: Awaited<ReturnType<typeof markTicketComplete>>
    try {
      res = await markTicketComplete(ticketId, notes)
    } catch (err) {
      // 409: it was already completed or is waiting for confirmation; the row is stale.
      if (isApiError(err) && err.status === 409) refresh()
      throw err
    }
    toast(completionMessage(res.result?.confirmation), 'success', 8000)
    refresh()
  }

  async function handleConfirmResend() {
    if (resendTicketId === null || resending) return
    setResending(true)
    setResendError('')
    try {
      await resendConfirmation(resendTicketId)
      setResendTicketId(null)
      toast('A new confirmation email is on its way')
      refresh()
    } catch (err) {
      console.error(err)
      if (isApiError(err) && err.status === 409) refresh()
      setResendError(getErrorMessage(err, "Couldn't resend the confirmation email."))
    } finally {
      setResending(false)
    }
  }

  // Department Heads only (the button is hidden for everyone else; the API says 403 anyway).
  async function handleCloseOnBehalf(ticketId: number, reason: string) {
    try {
      await closeTicketOnBehalf(ticketId, reason)
    } catch (err) {
      if (isApiError(err) && err.status === 409) refresh()
      throw err
    }
    toast("Ticket closed on the requester's behalf")
    refresh()
  }

  async function handleAssignSubmit(ticketId: number, userId: number) {
    await assignTicket(ticketId, userId)
    refresh()
  }

  // Throws on failure so the dialog stays open and shows the message inline.
  async function handleFalseAlarm(ticketId: number, reason: string) {
    try {
      await markFalseAlarm(ticketId, reason)
    } catch (err) {
      // 409: someone took, completed or already rejected it; the row is stale.
      if (isApiError(err) && err.status === 409) refresh()
      throw err
    }
    toast('Request rejected as a false alarm')
    refresh()
  }

  // Department Heads only (the button is hidden for everyone else; the API says 403 anyway).
  async function handleReopen(ticketId: number, reason: string) {
    try {
      await reopenTicket(ticketId, reason)
    } catch (err) {
      // 409: it was already reopened or isn't a false alarm; the row is stale.
      if (isApiError(err) && err.status === 409) refresh()
      throw err
    }
    toast('Ticket reopened')
    refresh()
  }

  function openComplete(ticketId: number) {
    setCompleteTicketId(ticketId)
  }

  function openResend(ticketId: number) {
    setResendError('')
    setResendTicketId(ticketId)
  }

  // Taking a ticket also downloads its job order (IT tickets). The download
  // starts only after the take succeeded and can never undo or hide it.
  async function handleTake(ticketId: number) {
    if (!user || takingId !== null) return
    setTakingId(ticketId)
    const row = data?.tickets.data.find(t => t.id === ticketId)
    const result = await takeThenJobOrder(ticketId, user.id, {
      take: takeTicket,
      onTaken: () => {
        toast('Ticket assigned to you')
        setTakingId(null)
        refresh()
      },
      downloadJobOrder: async id => {
        if (row && canDownloadJobOrder(row, user)) await jobOrder.download(id, row.ticket_number, { auto: true })
      },
    })
    if (!result.taken) {
      console.error(result.error)
      toast(getErrorMessage(result.error, 'Failed to take ticket'), 'error')
      setTakingId(null)
      refresh()
    }
  }

  function downloadJo(ticketId: number, format: JobOrderFormat) {
    void jobOrder.download(ticketId, data?.tickets.data.find(t => t.id === ticketId)?.ticket_number, { format })
  }

  if (!authed) return null

  const filtered = hasActiveFilters(params)
  // Zero tickets and nothing filtered: the page is just the header and an EmptyState.
  const noTicketsAtAll = !!data && !filtered && !error && data.tickets.total === 0
  const rowOf = (id: number | null) => data?.tickets.data.find(t => t.id === id)
  const completeRow = rowOf(completeTicketId)
  const resendRow = rowOf(resendTicketId)
  const closeRow = rowOf(closeTicketId)
  const reopenRow = data?.tickets.data.find(t => t.id === reopenTicketId)
  const reopenRejection = reopenRow ? falseAlarmEntry(reopenRow) : null
  const showReport = mode === 'mine' && user?.department_id === IT_DEPARTMENT_ID

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {!data ? (
          <div className="mb-6 flex flex-wrap gap-2" aria-hidden="true">
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
          </div>
        ) : !noTicketsAtAll && (
        <FilterPills
          statusPills={buildStatusPills(data?.statusCounts ?? [])}
          priorityPills={buildPriorityPills(data?.priorityCounts ?? [])}
          statusFilter={params.status_id === null ? null : String(params.status_id)}
          priorityFilter={params.priority_id === null ? null : String(params.priority_id)}
          onStatusChange={value =>
            update({ status_id: value === null ? null : Number(value), status: null })
          }
          onPriorityChange={value =>
            update({ priority_id: value === null ? null : Number(value), priority: null })
          }
        />
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">{copy.title}</h1>
            <p className="text-sm text-gray-500">
              {copy.subtitle}
              {data ? ` (${data.tickets.total} total)` : ''}
            </p>
          </div>
          {showReport && (
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className={btnTint}
            >
              <Download size={14} aria-hidden="true" />
              Accomplishment report
            </button>
          )}
        </div>

        {!noTicketsAtAll && (
          <TicketToolbar
            params={params}
            update={update}
            dateRangeInvalid={dateRangeInvalid}
            filtersActive={filtered}
            onClear={clearFilters}
          />
        )}

        {error && <ErrorState message={error} onRetry={retry} className="mb-4" />}

        {loading && !data ? (
          <TableSkeleton rows={Math.min(params.per_page, 10)} columns={10} />
        ) : data && !error && !dateRangeInvalid ? (
          data.tickets.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white">
              {filtered ? (
                <EmptyState
                  icon={SearchX}
                  title="No tickets match your filters"
                  description="Try a different search or widen the filters."
                  action={{ label: 'Clear filters', onClick: clearFilters }}
                />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="No tickets yet"
                  description={copy.empty}
                  action={{ label: 'Create a ticket', href: '/tickets/create' }}
                />
              )}
            </div>
          ) : (
            // Stays mounted while a refetch is in flight so focus and scroll
            // aren't lost; only dimmed and made inert to clicks.
            <div
              aria-busy={loading}
              className={loading ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}
            >
              <TicketsTable
                tickets={data.tickets.data}
                expanded={expanded}
                takingId={takingId}
                onToggleExpand={toggleExpand}
                onAssign={setAssignTicketId}
                onTake={handleTake}
                onMarkComplete={openComplete}
                onFalseAlarm={setFalseAlarmTicketId}
                onReopen={setReopenTicketId}
                onDownloadJo={downloadJo}
                jobOrderBusyId={jobOrder.busyId}
                onResend={openResend}
                resendingId={resending ? resendTicketId : null}
                onCloseOnBehalf={setCloseTicketId}
                onOpenComments={setCommentsTicketId}
              />
              <Pagination
                currentPage={data.tickets.current_page}
                lastPage={data.tickets.last_page}
                total={data.tickets.total}
                onPageChange={page => update({ page })}
              />
            </div>
          )
        ) : null}
      </main>

      <AssignModal
        isOpen={assignTicketId !== null}
        ticketId={assignTicketId}
        onClose={() => setAssignTicketId(null)}
        onAssign={handleAssignSubmit}
      />

      <FalseAlarmModal
        isOpen={falseAlarmTicketId !== null}
        ticketId={falseAlarmTicketId}
        ticketNumber={data?.tickets.data.find(t => t.id === falseAlarmTicketId)?.ticket_number}
        onClose={() => setFalseAlarmTicketId(null)}
        onSubmit={handleFalseAlarm}
      />

      <ReopenModal
        isOpen={reopenTicketId !== null}
        ticketId={reopenTicketId}
        ticketNumber={reopenRow?.ticket_number}
        rejectionReason={reopenRejection?.remarks}
        rejectedBy={reopenRejection?.user}
        onClose={() => setReopenTicketId(null)}
        onSubmit={handleReopen}
      />

      <CommentsModal
        isOpen={commentsTicketId !== null}
        ticketId={commentsTicketId}
        onClose={() => setCommentsTicketId(null)}
        onCommentAdded={refresh}
      />

      <CompleteModal
        isOpen={completeTicketId !== null}
        ticketId={completeTicketId}
        ticketNumber={completeRow?.ticket_number}
        requesterEmail={completeRow?.requester_email}
        onClose={() => setCompleteTicketId(null)}
        onSubmit={handleComplete}
      />

      <ConfirmModal
        isOpen={resendTicketId !== null}
        title="Resend the confirmation email?"
        message={`A new email with a fresh link goes to ${resendRow?.requester_email ?? 'the requester'}. The link in the previous email stops working.`}
        confirmLabel="Resend email"
        loading={resending}
        error={resendError}
        onConfirm={handleConfirmResend}
        onCancel={() => setResendTicketId(null)}
      />

      <CloseOnBehalfModal
        isOpen={closeTicketId !== null}
        ticketId={closeTicketId}
        ticketNumber={closeRow?.ticket_number}
        requesterEmail={closeRow?.requester_email}
        onClose={() => setCloseTicketId(null)}
        onSubmit={handleCloseOnBehalf}
      />

      {showReport && (
        <AccomplishmentModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />
      )}
    </div>
  )
}
