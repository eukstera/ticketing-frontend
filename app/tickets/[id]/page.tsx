'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Navbar from '@/components/NavBar'
import AssignModal from '@/components/AssignModal'
import ConfirmModal from '@/components/ConfirmModal'
import ActionCell from '@/components/department-tickets/ActionCell'
import TimelineStepper from '@/components/department-tickets/TimelineStepper'
import CommentThread from '@/components/comments/CommentThread'
import ErrorState from '@/components/ui/ErrorState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/Toast'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { getErrorMessage, isAbortError, isApiError } from '@/lib/api'
import { assignTicket, getTicket, markTicketComplete, takeTicket } from '@/lib/tickets'
import { PRIORITY_FALLBACK, PRIORITY_STYLES, statusStyles } from '@/lib/styles'
import { DateActivity, DepartmentTicket, TicketDetail } from '@/types'

interface DetailState {
  id: number
  ticket: TicketDetail | null
  status: number | null // HTTP status of a failed load
  error: string
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
  return `${date} ${time}`
}

function personName(p: { first_name: string; last_name: string } | { name: string } | null) {
  if (!p) return null
  return 'name' in p ? p.name : `${p.first_name} ${p.last_name}`
}

// TimelineStepper reads the list-row activity shape; adapt the detail timeline.
function toActivities(ticket: TicketDetail): DateActivity[] {
  return ticket.timeline.map(t => ({
    id: t.id,
    ticket_id: ticket.id,
    date_category_id: 0,
    user_id: 0,
    status: 1,
    created_at: t.created_at,
    date_category: { id: 0, category: t.category },
    user: t.user,
  }))
}

// ActionCell only reads these fields of a list row.
function toActionTicket(ticket: TicketDetail): Pick<DepartmentTicket, 'id' | 'status' | 'department_id' | 'assigned_activity'> {
  return {
    id: ticket.id,
    status: ticket.status.label,
    department_id: ticket.department.id,
    assigned_activity: ticket.assignee
      ? { id: 0, created_at: '', user: personName(ticket.assignee) ?? '', user_id: ticket.assignee.id }
      : null,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-700">{children}</dd>
    </div>
  )
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params)
  const ticketId = Number(rawId)
  const authed = useAuthGuard()
  const user = useUser()

  const [state, setState] = useState<DetailState | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [assignOpen, setAssignOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completing, setCompleting] = useState(false)

  const validId = Number.isInteger(ticketId) && ticketId > 0
  const loading = validId && state?.id !== ticketId

  useEffect(() => {
    if (!authed || !validId) return
    const controller = new AbortController()
    getTicket(ticketId, controller.signal)
      .then(res => setState({ id: ticketId, ticket: res.result.ticket, status: null, error: '' }))
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setState(prev => ({
          id: ticketId,
          // keep showing the last good ticket if only a refresh failed
          ticket: prev?.id === ticketId ? prev.ticket : null,
          status: isApiError(err) ? err.status : null,
          error: getErrorMessage(err, 'Failed to load this ticket'),
        }))
      })
    return () => controller.abort()
  }, [authed, ticketId, validId, reloadToken])

  function refresh() {
    setReloadToken(t => t + 1)
  }

  async function handleTake() {
    if (!user) return
    try {
      await takeTicket(ticketId, user.id)
      toast('Ticket assigned to you')
    } catch (err) {
      console.error(err)
      toast(getErrorMessage(err, 'Failed to take ticket'), 'error')
    } finally {
      refresh()
    }
  }

  async function handleAssign(id: number, userId: number) {
    await assignTicket(id, userId)
    refresh()
  }

  async function handleConfirmComplete() {
    setCompleting(true)
    try {
      await markTicketComplete(ticketId)
      toast('Ticket marked as complete')
    } catch (err) {
      console.error(err)
      toast(getErrorMessage(err, 'Failed to mark ticket as complete'), 'error')
    } finally {
      setCompleting(false)
      setCompleteOpen(false)
      refresh()
    }
  }

  if (!authed) return null

  const ticket = state?.ticket ?? null
  const failed = !loading && state && state.error
  const notFound = !validId || (failed && state.status === 404)
  const forbidden = failed && state.status === 403

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link
          href="/tickets"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to tickets
        </Link>

        {notFound ? (
          <ErrorState message="This ticket doesn't exist or was removed." />
        ) : forbidden ? (
          <ErrorState message="You don't have access to this ticket." />
        ) : loading ? (
          <div className="space-y-4" aria-busy="true">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={5} />
            <CardSkeleton lines={4} />
          </div>
        ) : !ticket ? (
          <ErrorState
            message={state?.error || 'Failed to load this ticket'}
            onRetry={() => {
              setState(null)
              refresh()
            }}
          />
        ) : (
          <TicketBody
            ticket={ticket}
            refreshError={failed ? state.error : ''}
            onRetry={refresh}
            onTake={handleTake}
            onAssign={() => setAssignOpen(true)}
            onComplete={() => setCompleteOpen(true)}
          />
        )}
      </div>

      <AssignModal
        isOpen={assignOpen}
        ticketId={assignOpen ? ticketId : null}
        onClose={() => setAssignOpen(false)}
        onAssign={handleAssign}
      />

      <ConfirmModal
        isOpen={completeOpen}
        title="Mark ticket as complete?"
        message="This will mark the ticket as complete."
        confirmLabel="Mark as Complete"
        variant="success"
        loading={completing}
        onConfirm={handleConfirmComplete}
        onCancel={() => setCompleteOpen(false)}
      />
    </div>
  )
}

function TicketBody({
  ticket,
  refreshError,
  onRetry,
  onTake,
  onAssign,
  onComplete,
}: {
  ticket: TicketDetail
  refreshError: string
  onRetry: () => void
  onTake: () => void
  onAssign: () => void
  onComplete: () => void
}) {
  const priorityStyle = PRIORITY_STYLES[ticket.priority.level] ?? PRIORITY_FALLBACK
  const d = ticket.details
  const isIT = ticket.type === 'IT'
  const concern = isIT ? d.type_of_concern : d.nature_of_work === 'Others' ? d.other_nature_of_work : d.nature_of_work
  const requester = personName(ticket.requester)
  const assignee = personName(ticket.assignee)

  return (
    <div className="space-y-4">
      {refreshError && <ErrorState message={refreshError} onRetry={onRetry} />}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">{ticket.ticket_number}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {ticket.department.name} &middot; requested {formatDateTime(ticket.created_at)}
            </p>
          </div>
          <ActionCell
            ticket={toActionTicket(ticket)}
            onTake={onTake}
            onAssign={onAssign}
            onMarkComplete={onComplete}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              statusStyles[ticket.status.label] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {ticket.status.label}
          </span>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle.badge}`}>
            {ticket.priority.level}
          </span>
          {ticket.is_overdue && (
            <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Overdue
            </span>
          )}
          <span className="text-xs text-gray-500">
            SLA {ticket.priority.sla_days} {ticket.priority.sla_days === 1 ? 'day' : 'days'}
            {ticket.due_at ? ` · due ${formatDateTime(ticket.due_at)}` : ''}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Details</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label={isIT ? 'Type of concern' : 'Nature of work'}>{concern}</Field>
          <Field label="Type of tech support">{isIT ? d.type_of_tech_support : null}</Field>
          <Field label="Area">{d.name_of_area}</Field>
          <Field label="Area supervisor">{d.area_supervisor}</Field>
          <Field label="Requester">{requester}</Field>
          <Field label="Assigned to">{assignee ?? <span className="text-gray-400">Unassigned</span>}</Field>
        </dl>
        <dl className="mt-3 space-y-3">
          <Field label={isIT ? 'Remarks' : 'Scope of work'}>
            <span className="whitespace-pre-wrap">{isIT ? d.remarks : d.scope_of_work}</span>
          </Field>
          {d.devices && d.devices.length > 0 && (
            <Field label={d.devices.length > 1 ? 'Devices' : 'Device'}>
              {d.devices.map(dev => `${dev.name} (${dev.qty})`).join(', ')}
            </Field>
          )}
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Timeline</h2>
        <TimelineStepper activities={toActivities(ticket)} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Actions taken</h2>
        <CommentThread ticketId={ticket.id} initialComments={ticket.comments} />
      </section>
    </div>
  )
}
