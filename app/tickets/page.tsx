'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/NavBar'
import { getDepartmentTickets, markTicketComplete, assignTicket } from '@/lib/tickets'
import { isAuthenticated } from '@/lib/auth'
import { DepartmentTicket } from '@/types'
import AssignModal from '@/components/AssignModal'
import CommentsModal from '@/components/CommentsModal'
import ConfirmModal from '@/components/ConfirmModal'
import FilterPills, { buildStatusPills, buildPriorityPills } from '@/components/department-tickets/FilterPills'
import TicketsTable from '@/components/department-tickets/TicketsTable'
import Pagination from '@/components/department-tickets/Pagination'
import { toast } from '@/components/Toast'

export default function DepartmentTicketsPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [tickets, setTickets] = useState<DepartmentTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [expanded, setExpanded] = useState<number[]>([])
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [priorityCounts, setPriorityCounts] = useState<Record<string, number>>({})
  const [prioritySla, setPrioritySla] = useState<Record<string, number>>({})
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [completeTicketId, setCompleteTicketId] = useState<number | null>(null)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isAuthenticated()) {
      router.push('/auth/login')
      return
    }

    const statusFromStorage = sessionStorage.getItem('ticketStatusFilter')
    if (statusFromStorage) {
      const stored = JSON.parse(statusFromStorage)
      if(stored.type == 'status'){
        setStatusFilter(stored.level)
      }else{
        setPriorityFilter(stored.level)
      }
      sessionStorage.removeItem('ticketStatusFilter')
    }
  }, [router])

  useEffect(() => {
    if (!mounted) return
    const timeout = setTimeout(() => {
      fetchTickets(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [mounted, statusFilter, priorityFilter, search])

  async function fetchTickets(page: number, loadState: boolean = true) {
    if(loadState) setLoading(true)
    setError('')
    try {
      const res = await getDepartmentTickets(page, {
        status: statusFilter,
        priority: priorityFilter,
        search,
      })
      const ticketData = res.result.ticket
      setTickets(ticketData.data)
      setCurrentPage(ticketData.current_page)
      setLastPage(ticketData.last_page)
      setTotal(ticketData.total)
      setStatusCounts(res.result.status_counts)
      setPriorityCounts(res.result.priority_counts)
      setPrioritySla(res.result.priority_sla)
    } catch (err) {
      console.error(err)
      setError('Failed to load tickets')
    } finally {
      setLoading(false)
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
      toast('Failed to mark ticket as complete', 'error')
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

  if (!mounted) return null

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
            <h1 className="text-lg font-semibold text-gray-800">Department Tickets</h1>
            <p className="text-sm text-gray-500">
              Tickets assigned to your department ({total} total)
            </p>
          </div>
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
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
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
    </div>
  )
}