import { DepartmentTicket } from '@/types'
import { priorityStyles } from '@/lib/styles'
import StatusCell from './StatusCell'
import ActionCell from './ActionCell'
import ActionInfo from './ActionInfo'
import LiveTimer from './LiveTimer'
import CommentButton from './CommentButton'
import TimelineStepper from './TimelineStepper'
import { User } from '@/types'
import { getTimerStartDate } from '@/hooks/useElapsedTime'
import { getUser } from '@/lib/auth'
import { useEffect, useState } from 'react'

const COLUMN_COUNT = 10

export default function TicketsTable({
  tickets,
  expanded,
  onToggleExpand,
  onAssign,
  onMarkComplete,
  onOpenComments,
}: {
  tickets: DepartmentTicket[]
  expanded: number[]
  onToggleExpand: (id: number) => void
  onAssign: (id: number) => void
  onMarkComplete: (id: number) => void
  onOpenComments: (id: number) => void
}) {

    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        setUser(getUser())
    }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-8"></th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ticket #</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
            {user?.department_id == 1 ? 'Concern' : 'Nature of Work'}
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Area</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Prioritization</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Info</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Elapsed Time</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 min-w-[140px]">Action</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Actions Taken</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tickets.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className="text-center py-10 text-gray-400">
                No tickets found
              </td>
            </tr>
          ) : (
            tickets.map(ticket => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                user={user}
                isExpanded={expanded.includes(ticket.id)}
                onToggleExpand={onToggleExpand}
                onAssign={onAssign}
                onMarkComplete={onMarkComplete}
                onOpenComments={onOpenComments}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function TicketRow({
  ticket,
  user,
  isExpanded,
  onToggleExpand,
  onAssign,
  onMarkComplete,
  onOpenComments,
}: {
  ticket: DepartmentTicket
  user: User | null
  isExpanded: boolean
  onToggleExpand: (id: number) => void
  onAssign: (id: number) => void
  onMarkComplete: (id: number) => void
  onOpenComments: (id: number) => void
}) {
  const timerStartDate = getTimerStartDate(ticket)

  return (
    <>
      <tr className="hover:bg-gray-50 transition">
        <td
          onClick={() => onToggleExpand(ticket.id)}
          className="px-4 py-3 text-gray-400 cursor-pointer"
        >
          {isExpanded ? '▼' : '›'}
        </td>
        <td
          onClick={() => onToggleExpand(ticket.id)}
          className="px-4 py-3 font-medium text-gray-700 cursor-pointer"
        >
          {ticket.ticket_number}
        </td>
        <td className="px-4 py-3 text-gray-600">
            {user?.department_id == 1 ? ticket.type_of_concern : ticket.nature_of_work}
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
              <span className="text-gray-400">⏱</span>
              <LiveTimer startDate={timerStartDate} />
            </div>
          ) : <span className="text-xs text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3">
          <ActionCell ticket={ticket} onAssign={onAssign} onMarkComplete={onMarkComplete} />
        </td>
        <td className="px-3 py-3 text-center">
          <CommentButton count={ticket.comments_count} onClick={() => onOpenComments(ticket.id)} />
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={COLUMN_COUNT} className="px-8 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="min-w-0">
                <p className="text-gray-400 text-xs font-medium mb-2">Timeline</p>
                <TimelineStepper activities={ticket.date_activities} />
              </div>

              <div className="border-l border-gray-200 pl-6 min-w-0">

              <div className='mb-2'>
                <p className="text-sm text-gray-400">
                    {user?.department_id == 1 ? 'Remarks' : 'Scope of Work'}
                </p>
                <p className="text-sm text-gray-700">
                    {user?.department_id == 1 ? ticket.remarks : ticket.scope_of_work}
                </p>
              </div>

              {
                ticket.devices.length > 0 && (
                <div className='mb-2 mt-2'>
                  <p className="text-sm text-gray-400">Device{ticket.devices.length > 1 ? 's' : ''}</p>
                  <p className="text-sm text-gray-700">
                    {ticket.devices.map(d => `${d.device} (${d.qty})`).join(', ')}
                  </p>
                </div>
                )
              }

              <div>
                <p className="text-sm text-gray-400">Supervisor</p>
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
