'use client'

import { useEffect, useRef, useState } from 'react'
import Navbar from '@/components/NavBar'
import { getMyTickets, markTicketComplete, assignTicket } from '@/lib/tickets'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { getErrorMessage, isAbortError } from '@/lib/api'
import ErrorState from '@/components/ui/ErrorState'
import { DepartmentTicket } from '@/types'
import AssignModal from '@/components/AssignModal'
import CommentsModal from '@/components/CommentsModal'
import ConfirmModal from '@/components/ConfirmModal'
import AccomplishmentModal from '@/components/AccomplishmentModal'
import FilterPills, { buildStatusPills, buildPriorityPills } from '@/components/department-tickets/FilterPills'
import TicketsTable from '@/components/department-tickets/TicketsTable'
import Pagination from '@/components/department-tickets/Pagination'
import { toast } from '@/components/Toast'
import { readDeepLinkFilter, clearDeepLinkFilter } from '@/lib/ticketFilters'

export default function MyTicketsPage() {
  const authed = useAuthGuard()
  const abortRef = useRef<AbortController | null>(null)
  const [tickets, setTickets] = useState<DepartmentTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [expanded, setExpanded] = useState<number[]>([])
  const [deepLink] = useState(readDeepLinkFilter)
  const [statusFilter, setStatusFilter] = useState<string | null>(deepLink?.type === 'status' ? deepLink.level : null)
  const [priorityFilter, setPriorityFilter] = useState<string | null>(deepLink && deepLink.type !== 'status' ? deepLink.level : null)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [priorityCounts, setPriorityCounts] = useState<Record<string, number>>({})
  const [prioritySla, setPrioritySla] = useState<Record<string, number>>({})
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [completeTicketId, setCompleteTicketId] = useState<number | null>(null)
  const [completing, setCompleting] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const user = useUser()

  useEffect(() => {
    clearDeepLinkFilter()
  }, [])

  useEffect(() => {
    if (!authed) return
    const timeout = setTimeout(() => {
      fetchTickets(1)
    }, 300)
    return () => {
      clearTimeout(timeout)
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchTickets reads the filters directly
  }, [authed, statusFilter, priorityFilter, search])

  async function fetchTickets(page: number, loadState: boolean = true) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    if (loadState) setLoading(true)
    setError('')
    try {
      const res = await getMyTickets(page, {
        status: statusFilter,
        priority: priorityFilter,
        search,
      }, controller.signal)
      const ticketData = res.result.ticket
      setTickets(ticketData.data)
      setCurrentPage(ticketData.current_page)
      setLastPage(ticketData.last_page)
      setTotal(ticketData.total)
      setStatusCounts(res.result.status_counts)
      setPriorityCounts(res.result.priority_counts)
      setPrioritySla(res.result.priority_sla)
    } catch (err) {
      if (isAbortError(err)) return
      console.error(err)
      setError(getErrorMessage(err, 'Failed to load tickets'))
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  function openCompleteModal(ticketId: number) {
    setCompleteTicketId(ticketId)
    setCompleteModalOpen(true)
  }

  async function handleConfirmComplete() {
    if (!completeTicketId) return
    setCompleting(true)
    try {
      await markTicketComplete(completeTicketId)
      setCompleteModalOpen(false)
      toast('Ticket marked as complete')
      fetchTickets(currentPage, false)
    } catch (err) {
      console.error(err)
      toast(getErrorMessage(err, 'Failed to mark ticket as complete'), 'error')
    } finally {
      setCompleting(false)
    }
  }

  function openAssignModal(ticketId: number) {
    setSelectedTicketId(ticketId)
    setAssignModalOpen(true)
  }

  function openComments(ticketId: number) {
    setSelectedTicketId(ticketId)
    setCommentsModalOpen(true)
  }

  async function handleAssignSubmit(ticketId: number, userId: number) {
    await assignTicket(ticketId, userId)
    fetchTickets(currentPage, false)
  }

  function toggleExpand(id: number) {
    setExpanded(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function togglePriorityFilter(value: string | null) {
    setPriorityFilter(prev => (prev === value ? null : value))
  }

  if (!authed) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <FilterPills
          statusPills={buildStatusPills(statusCounts)}
          priorityPills={buildPriorityPills(priorityCounts, prioritySla)}
          statusFilter={statusFilter}
          priorityFilter={priorityFilter}
          onStatusChange={setStatusFilter}
          onPriorityChange={togglePriorityFilter}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">My Tickets</h1>
            <p className="text-sm text-gray-500">
              Tickets you requested or are assigned to ({total} total)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <span className="text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-sm outline-none w-full sm:w-48"
              />
            </div>

            {
              user?.department_id == 1 && (
                <button
                  onClick={() => setReportModalOpen(true)}
                  title="Download accomplishment report"
                  aria-label="Download accomplishment report"
                  className="flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <path d="M12 3v12" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M4 19h16" />
                  </svg>
                </button>
              )
            }

          </div>
        </div>

        {error && (
          <ErrorState message={error} onRetry={() => fetchTickets(currentPage)} className="mb-4" />
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading tickets...</div>
        ) : (
          <>
            <TicketsTable
              tickets={tickets}
              expanded={expanded}
              onToggleExpand={toggleExpand}
              onAssign={openAssignModal}
              onMarkComplete={openCompleteModal}
              onOpenComments={openComments}
            />
            <Pagination
              currentPage={currentPage}
              lastPage={lastPage}
              total={total}
              onPageChange={fetchTickets}
            />
          </>
        )}
      </div>

      <AssignModal
        isOpen={assignModalOpen}
        ticketId={selectedTicketId}
        onClose={() => setAssignModalOpen(false)}
        onAssign={handleAssignSubmit}
      />

      <CommentsModal
        isOpen={commentsModalOpen}
        ticketId={selectedTicketId}
        onClose={() => setCommentsModalOpen(false)}
        onCommentAdded={() => fetchTickets(currentPage, false)}
      />

      <ConfirmModal
        isOpen={completeModalOpen}
        title="Mark ticket as complete?"
        message="This will mark the ticket as complete."
        confirmLabel="Mark as Complete"
        variant="success"
        loading={completing}
        onConfirm={handleConfirmComplete}
        onCancel={() => setCompleteModalOpen(false)}
      />

      <AccomplishmentModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </div>
  )
}