import { DepartmentTicket } from '@/types'
import { getUser } from '@/lib/auth'

export default function ActionCell({
  ticket,
  onAssign,
  onMarkComplete,
}: {
  ticket: DepartmentTicket
  onAssign?: (id: number) => void
  onMarkComplete?: (id: number) => void
}) {

  const user = getUser()
  const userId = user?.id

  if (ticket.status === 'Open' && ticket.requested_activity?.user_id == 1) {
    return (
      <button
        onClick={() => onAssign?.(ticket.id)}
        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition whitespace-nowrap shrink-0"
      >
        Edit
      </button>
    )
  }

  else if (ticket.status === 'Open') {
    return (
      <button
        onClick={() => onAssign?.(ticket.id)}
        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition whitespace-nowrap shrink-0"
      >
        Assign
      </button>
    )
  }

  else if (ticket.status === 'In-progress') {
    return (
      <button
        onClick={() => onMarkComplete?.(ticket.id)}
        className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition whitespace-nowrap shrink-0"
      >
        Complete
      </button>
    )
  }

  else if (ticket.status === 'Completed' || ticket.status === 'Overdue') {
    return <span className="text-gray-300 text-xs">—</span>
  }

  return null
}
