'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileQuestion, Lock } from 'lucide-react'
import Navbar from '@/components/NavBar'
import AssignModal from '@/components/AssignModal'
import ConfirmModal from '@/components/ConfirmModal'
import FalseAlarmModal from '@/components/FalseAlarmModal'
import ActionCell from '@/components/department-tickets/ActionCell'
import TimelineStepper from '@/components/department-tickets/TimelineStepper'
import CommentThread from '@/components/comments/CommentThread'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/Toast'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { getErrorMessage, isAbortError, isApiError } from '@/lib/api'
import { assignTicket, getTicket, markFalseAlarm, markTicketComplete, takeTicket } from '@/lib/tickets'
import { PRIORITY_FALLBACK, PRIORITY_STYLES, badgeBase, statusBadgeClass } from '@/lib/styles'
import { formatDateTimeText, slaLabel } from '@/lib/format'
import { DateActivity, DepartmentTicket, TicketDetail } from '@/types'

interface DetailState {
  id: number
  ticket: TicketDetail | null
  status: number | null // HTTP status of a failed load
  error: string
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
    remarks: t.remarks ?? null,
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
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-700">{children}</dd>
    </div>
  )
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params)
  const ticketId = Number(rawId)
  const authed = useAuthGuard()
  const user = useUser()
  const router = useRouter()

  const [state, setState] = useState<DetailState | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [assignOpen, setAssignOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState('')
  const [taking, setTaking] = useState(false)
  const [falseAlarmOpen, setFalseAlarmOpen] = useState(false)

  const validId = Number.isInteger(ticketId) && ticketId > 0
  const loadedNumber = state?.ticket?.ticket_number

  useEffect(() => {
    if (!loadedNumber) return
    const previous = document.title
    document.title = `Ticket ${loadedNumber}`
    return () => {
      document.title = previous
    }
  }, [loadedNumber])
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
    if (!user || taking) return
    setTaking(true)
    try {
      await takeTicket(ticketId, user.id)
      toast('Ticket assigned to you')
    } catch (err) {
      console.error(err)
      toast(getErrorMessage(err, 'Failed to take ticket'), 'error')
    } finally {
      setTaking(false)
      refresh()
    }
  }

  async function handleAssign(id: number, userId: number) {
    await assignTicket(id, userId)
    refresh()
  }

  // Throws on failure so the dialog stays open and shows the message inline.
  async function handleFalseAlarm(id: number, reason: string) {
    try {
      await markFalseAlarm(id, reason)
    } catch (err) {
      // 409: it was taken, completed or already rejected; show what it is now.
      if (isApiError(err) && err.status === 409) refresh()
      throw err
    }
    toast('Request rejected as a false alarm')
    refresh()
  }

  async function handleConfirmComplete() {
    setCompleting(true)
    setCompleteError('')
    try {
      await markTicketComplete(ticketId)
      setCompleteOpen(false)
      toast('Ticket marked as complete')
      refresh()
    } catch (err) {
      console.error(err)
      setCompleteError(getErrorMessage(err, 'Failed to mark ticket as complete'))
    } finally {
      setCompleting(false)
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
      <main id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <h1 className="sr-only">Ticket</h1>
        <Link
          href="/tickets"
          onClick={e => {
            // Return to wherever the user came from (keeps list filters); fall
            // back to the link's href when this page was opened directly.
            if (window.history.length > 1) {
              e.preventDefault()
              router.back()
            }
          }}
          className="mb-4 inline-flex items-center gap-1.5 rounded text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to tickets
        </Link>

        {notFound ? (
          <EmptyState
            icon={FileQuestion}
            title="Ticket not found"
            description="It may have been removed, or the link is wrong."
            action={{ label: 'Back to tickets', href: '/tickets' }}
            className="rounded-xl border border-gray-200 bg-white"
          />
        ) : forbidden ? (
          <EmptyState
            icon={Lock}
            title="You don't have access to this ticket"
            action={{ label: 'Back to tickets', href: '/tickets' }}
            className="rounded-xl border border-gray-200 bg-white"
          />
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
            taking={taking}
            onTake={handleTake}
            onAssign={() => setAssignOpen(true)}
            onFalseAlarm={() => setFalseAlarmOpen(true)}
            onComplete={() => {
              setCompleteError('')
              setCompleteOpen(true)
            }}
          />
        )}
      </main>

      <AssignModal
        isOpen={assignOpen}
        ticketId={assignOpen ? ticketId : null}
        onClose={() => setAssignOpen(false)}
        onAssign={handleAssign}
      />

      <FalseAlarmModal
        isOpen={falseAlarmOpen}
        ticketId={falseAlarmOpen ? ticketId : null}
        ticketNumber={ticket?.ticket_number}
        onClose={() => setFalseAlarmOpen(false)}
        onSubmit={handleFalseAlarm}
      />

      <ConfirmModal
        isOpen={completeOpen}
        title="Mark ticket as complete?"
        message="This will mark the ticket as complete."
        confirmLabel="Mark as Complete"
        variant="success"
        loading={completing}
        error={completeError}
        onConfirm={handleConfirmComplete}
        onCancel={() => setCompleteOpen(false)}
      />
    </div>
  )
}

function TicketBody({
  ticket,
  refreshError,
  taking,
  onRetry,
  onTake,
  onAssign,
  onFalseAlarm,
  onComplete,
}: {
  ticket: TicketDetail
  refreshError: string
  taking: boolean
  onRetry: () => void
  onTake: () => void
  onAssign: () => void
  onFalseAlarm: () => void
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
            <h2 className="text-xl font-semibold text-gray-800">{ticket.ticket_number}</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {ticket.department.name} &middot; requested {formatDateTimeText(ticket.created_at)}
            </p>
          </div>
          <ActionCell
            ticket={toActionTicket(ticket)}
            ticketNumber={ticket.ticket_number}
            taking={taking}
            onTake={onTake}
            onAssign={onAssign}
            onFalseAlarm={onFalseAlarm}
            onMarkComplete={onComplete}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={statusBadgeClass(ticket.status.label)}>{ticket.status.label}</span>
          <span className={`${badgeBase} ${priorityStyle.badge}`}>
            {ticket.priority.level}
          </span>
          {ticket.is_overdue && ticket.status.label !== 'Overdue' && (
            <span className={`${badgeBase} bg-red-100 text-red-700`}>
              Overdue
            </span>
          )}
          <span className="text-xs text-gray-500">
            {slaLabel(ticket.priority.sla_days)}
            {ticket.due_at ? ` · due ${formatDateTimeText(ticket.due_at)}` : ''}
          </span>
        </div>

        {ticket.false_alarm && (
          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <p className="font-medium">
              Rejected as a false alarm by {personName(ticket.false_alarm.marked_by) ?? 'a former user'}
              <span className="font-normal text-violet-800">
                {' '}on {formatDateTimeText(ticket.false_alarm.marked_at)}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap">
              <span className="font-medium">Reason: </span>
              {ticket.false_alarm.reason}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Details</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label={isIT ? 'Type of concern' : 'Nature of work'}>{concern}</Field>
          <Field label="Type of tech support">{isIT ? d.type_of_tech_support : null}</Field>
          <Field label="Area">{d.name_of_area}</Field>
          <Field label="Area supervisor">{d.area_supervisor}</Field>
          <Field label="Requester">{requester}</Field>
          <Field label="Assigned to">{assignee ?? <span className="text-gray-500">Unassigned</span>}</Field>
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
