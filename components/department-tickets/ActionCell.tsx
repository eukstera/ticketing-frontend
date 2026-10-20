'use client'

import { DepartmentTicket } from '@/types'
import { useUser } from '@/hooks/useUser'

const primaryBtn =
  'px-3 py-1.5 text-white rounded text-xs font-medium transition whitespace-nowrap shrink-0'

export default function ActionCell({
  ticket,
  onAssign,
  onTake,
  onMarkComplete,
}: {
  ticket: Pick<DepartmentTicket, 'id' | 'status' | 'department_id' | 'assigned_activity'>
  onAssign?: (id: number) => void
  onTake?: (id: number) => void
  onMarkComplete?: (id: number) => void
}) {
  const user = useUser()

  // The API only lets members of the ticket's handling department assign it
  // (403 otherwise), so everyone else gets no button.
  const isMember = !!user && user.department_id === ticket.department_id
  const isAssignee = !!user && ticket.assigned_activity?.user_id === user.id

  if (ticket.status === 'Open') {
    if (!isMember) return null
    return (
      <div className="flex items-center gap-2">
        {onTake && (
          <button
            onClick={() => onTake(ticket.id)}
            className={`${primaryBtn} bg-green-600 hover:bg-green-700`}
          >
            Take ticket
          </button>
        )}
        <button
          onClick={() => onAssign?.(ticket.id)}
          className={`${primaryBtn} bg-blue-600 hover:bg-blue-700`}
        >
          Assign
        </button>
      </div>
    )
  }

  if (ticket.status === 'In-progress') {
    if (!isMember && !isAssignee) return null
    return (
      <button
        onClick={() => onMarkComplete?.(ticket.id)}
        className={`${primaryBtn} bg-green-600 hover:bg-green-700`}
      >
        Complete
      </button>
    )
  }

  if (ticket.status === 'Completed' || ticket.status === 'Overdue') {
    return <span className="text-gray-500 text-xs">—</span>
  }

  return null
}
