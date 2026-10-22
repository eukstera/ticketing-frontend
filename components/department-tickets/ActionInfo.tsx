import { DepartmentTicket } from '@/types'
import { formatDateTime } from '@/lib/format'
import { FALSE_ALARM_STATUS, falseAlarmEntry } from '@/lib/falseAlarm'

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

  if (ticket.status === FALSE_ALARM_STATUS) {
    const rejected = falseAlarmEntry(ticket)
    if (!rejected) return null
    const { date, time } = formatDateTime(rejected.created_at)
    return (
      <div className="text-xs">
        <p className="text-gray-500">Rejected by:</p>
        <p className="text-gray-700 font-medium">{rejected.user ?? '—'}</p>
        <p className="text-gray-500">{date} {time}</p>
        {rejected.remarks && (
          <p className="mt-1 line-clamp-2 text-gray-600" title={rejected.remarks}>
            Reason: {rejected.remarks}
          </p>
        )}
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
