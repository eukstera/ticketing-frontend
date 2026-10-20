import Link from 'next/link'
import { ChevronDown, ChevronRight, Timer } from 'lucide-react'
import { DepartmentTicket } from '@/types'
import { priorityStyles } from '@/lib/styles'
import { IT_DEPARTMENT_ID } from '@/lib/constants'
import StatusCell from './StatusCell'
import ActionCell from './ActionCell'
import ActionInfo from './ActionInfo'
import LiveTimer from './LiveTimer'
import CommentButton from './CommentButton'
import TimelineStepper from './TimelineStepper'
import { getTimerStartDate } from '@/hooks/useElapsedTime'
import { useUser } from '@/hooks/useUser'
import type { AuthUser } from '@/lib/auth'

const COLUMN_COUNT = 10

export default function TicketsTable({
  tickets,
  expanded,
  takingId = null,
  onToggleExpand,
  onAssign,
  onTake,
  onMarkComplete,
  onOpenComments,
}: {
  tickets: DepartmentTicket[]
  expanded: number[]
  /** Ticket with a take request in flight (disables its buttons). */
  takingId?: number | null
  onToggleExpand: (id: number) => void
  onAssign: (id: number) => void
  onTake?: (id: number) => void
  onMarkComplete: (id: number) => void
  onOpenComments: (id: number) => void
}) {
  const user = useUser()
  const isIT = user?.department_id === IT_DEPARTMENT_ID

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-8">
              <span className="sr-only">Expand</span>
            </th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ticket #</th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500">
              {isIT ? 'Concern' : 'Nature of Work'}
            </th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500">Area</th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500">Prioritization</th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500">Info</th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500">Elapsed Time</th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500 min-w-[140px]">Action</th>
            <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-500">Actions Taken</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tickets.map(ticket => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              user={user}
              isExpanded={expanded.includes(ticket.id)}
              taking={takingId === ticket.id}
              onToggleExpand={onToggleExpand}
              onAssign={onAssign}
              onTake={onTake}
              onMarkComplete={onMarkComplete}
              onOpenComments={onOpenComments}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TicketRow({
  ticket,
  user,
  isExpanded,
  taking,
  onToggleExpand,
  onAssign,
  onTake,
  onMarkComplete,
  onOpenComments,
}: {
  ticket: DepartmentTicket
  user: AuthUser | null
  isExpanded: boolean
  taking: boolean
  onToggleExpand: (id: number) => void
  onAssign: (id: number) => void
  onTake?: (id: number) => void
  onMarkComplete: (id: number) => void
  onOpenComments: (id: number) => void
}) {
  const timerStartDate = getTimerStartDate(ticket)
  const isIT = user?.department_id === IT_DEPARTMENT_ID
  const detailsId = `ticket-${ticket.id}-details`

  return (
    <>
      <tr className="hover:bg-gray-50 transition">
        <td className="px-2 py-3">
          <button
            type="button"
            onClick={() => onToggleExpand(ticket.id)}
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={`Toggle details for ${ticket.ticket_number}`}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {isExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
        </td>
        <td className="px-4 py-3 font-medium text-gray-700">
          <Link
            href={`/tickets/${ticket.id}`}
            className="text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            {ticket.ticket_number}
          </Link>
        </td>
        <td className="px-4 py-3 text-gray-600">
          {isIT ? ticket.type_of_concern : ticket.nature_of_work}
        </td>
        <td className="px-4 py-3 text-gray-600">{ticket.name_of_area}</td>
        <td className="px-4 py-3">
          <span className={priorityStyles[ticket.priority] || 'text-gray-600'}>
            {ticket.priority}
          </span>
        </td>
        <td className="px-4 py-3">
          <StatusCell ticket={ticket} />
        </td>
        <td className="px-4 py-3">
          <ActionInfo ticket={ticket} />
        </td>
        <td className="px-4 py-3">
          {timerStartDate ? (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Timer size={12} className="text-gray-500" aria-hidden="true" />
              <LiveTimer startDate={timerStartDate} />
            </div>
          ) : <span className="text-xs text-gray-500">—</span>}
        </td>
        <td className="px-4 py-3">
          <ActionCell
            ticket={ticket}
            ticketNumber={ticket.ticket_number}
            taking={taking}
            onAssign={onAssign}
            onTake={onTake}
            onMarkComplete={onMarkComplete}
          />
        </td>
        <td className="px-3 py-3 text-center">
          <CommentButton count={ticket.comments_count} onClick={() => onOpenComments(ticket.id)} />
        </td>
      </tr>

      {isExpanded && (
        <tr id={detailsId} className="bg-gray-50">
          <td colSpan={COLUMN_COUNT} className="px-4 py-4 md:px-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="min-w-0">
                <p className="text-gray-500 text-xs font-medium mb-2">Timeline</p>
                <TimelineStepper activities={ticket.date_activities} />
              </div>

              <div className="min-w-0 md:border-l md:border-gray-200 md:pl-6">
                <div className="mb-2">
                  <p className="text-sm text-gray-500">{isIT ? 'Remarks' : 'Scope of Work'}</p>
                  <p className="text-sm text-gray-700">{isIT ? ticket.remarks : ticket.scope_of_work}</p>
                </div>

                {ticket.devices.length > 0 && (
                  <div className="mb-2 mt-2">
                    <p className="text-sm text-gray-500">Device{ticket.devices.length > 1 ? 's' : ''}</p>
                    <p className="text-sm text-gray-700">
                      {ticket.devices.map(d => `${d.device} (${d.qty})`).join(', ')}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-500">Supervisor</p>
                  <p className="text-sm text-gray-700">{ticket.area_supervisor}</p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
