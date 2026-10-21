import { DepartmentTicket } from '@/types'
import { formatDateTime } from '@/lib/format'

export default function ActionInfo({ ticket }: { ticket: DepartmentTicket }) {
  if (ticket.status === 'Open' && ticket.requested_activity) {
    const { date, time } = formatDateTime(ticket.requested_activity.created_at)
    return (
      <div className="text-xs">
        <p className="text-gray-500">Requested by:</p>
        <p className="text-gray-700 font-medium">
          {ticket.requested_activity.user}
        </p>
        <p className="text-gray-500">{date} {time}</p>
      </div>
    )
  }

  if (ticket.status === 'In-progress' && ticket.assigned_activity) {
    const { date, time } = formatDateTime(ticket.assigned_activity.created_at)
    return (
      <div className="text-xs">
        <p className="text-gray-500">Assigned to:</p>
        <p className="text-gray-700 font-medium">
          {ticket.assigned_activity.user}
        </p>
        <p className="text-gray-500">{date} {time}</p>
      </div>
    )
  }

  if (ticket.status === 'Completed' && ticket.completed_activity) {
    const { date, time } = formatDateTime(ticket.completed_activity.created_at)
    return (
      <div className="text-xs">
        <p className="text-gray-500">Completed by:</p>
        <p className="text-gray-700 font-medium">
          {ticket.completed_activity.user}
        </p>
        <p className="text-gray-500">{date} {time}</p>
      </div>
    )
  }

    if (ticket.status === 'Overdue') {
      const activity = ticket.assigned_activity ?? ticket.requested_activity
      const label = ticket.assigned_activity ? 'Assigned To:' : 'Requested By:'

      if (!activity) return null

      const { date, time } = formatDateTime(activity.created_at)
      const name = activity.user

      return (
        <div className="text-xs">
          <p className="text-gray-500">{label}</p>
          <p className="text-gray-700 font-medium">
            {name}
          </p>
          <p className="text-gray-500">{date} {time}</p>
        </div>
      )
    }

  return null
}
