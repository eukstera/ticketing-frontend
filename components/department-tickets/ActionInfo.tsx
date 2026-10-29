import { DepartmentTicket } from '@/types'
import { formatDateTime } from '@/lib/format'
import { FALSE_ALARM_STATUS, falseAlarmEntry, latestActivity, reopenedEntry } from '@/lib/falseAlarm'
import { currentDispute, isPendingConfirmation } from '@/lib/confirmation'
import { BLANK_STATUS, NOT_FILLED_IN_TEXT } from '@/lib/blankJobOrder'
import RequesterEmail from '@/components/ui/RequesterEmail'

function statusInfo(ticket: DepartmentTicket) {
  // Waiting for the requester to confirm the work.
  if (isPendingConfirmation(ticket.status)) {
    const completed = latestActivity(ticket.date_activities, 'Completed')
    const at = completed?.created_at ?? ticket.completed_activity?.created_at
    const by = completed?.user ?? ticket.completed_activity?.user
    const notes = completed?.remarks
    return (
      <div className="text-xs">
        <p className="font-medium text-teal-700">Awaiting requester confirmation</p>
        {by && <p className="text-gray-700 font-medium">{by}</p>}
        {at && (
          <p className="text-gray-500">
            {formatDateTime(at).date} {formatDateTime(at).time}
          </p>
        )}
        {notes && (
          <p className="mt-1 line-clamp-2 text-gray-600" title={notes}>
            Action taken: {notes}
          </p>
        )}
      </div>
    )
  }

  // A reopened ticket shows who put it back, which replaces "Requested by".
  if (ticket.status === 'Open') {
    const reopened = reopenedEntry(ticket)
    if (reopened) {
      const { date, time } = formatDateTime(reopened.created_at)
      return (
        <div className="text-xs">
          <p className="text-gray-500">Reopened by:</p>
          <p className="text-gray-700 font-medium">{reopened.user ?? '—'}</p>
          <p className="text-gray-500">{date} {time}</p>
          {reopened.remarks && (
            <p className="mt-1 line-clamp-2 text-gray-600" title={reopened.remarks}>
              Reason: {reopened.remarks}
            </p>
          )}
        </div>
      )
    }
  }

  if (ticket.status === BLANK_STATUS) {
    return <p className="text-xs italic text-gray-500">{NOT_FILLED_IN_TEXT}</p>
  }

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

/**
 * The Info column: what happened last on this ticket, the requester's
 * dispute while it stands, and where the confirmation email goes. The email
 * line only appears when the server sends the field (staff only; null = none).
 */
export default function ActionInfo({ ticket }: { ticket: DepartmentTicket }) {
  const info = statusInfo(ticket)
  const dispute = ticket.status === 'In-progress' ? currentDispute(ticket.date_activities) : undefined
  const showEmail = ticket.requester_email !== undefined
  if (!info && !dispute && !showEmail) return null
  return (
    <>
      {info}
      {dispute && (
        <p role="note" className="mt-1 text-xs text-amber-800">
          <span className="font-medium">Disputed by requester:</span> {dispute.remarks ?? 'no reason given'}
        </p>
      )}
      {showEmail && (
        <p className="mt-1 text-xs text-gray-500">
          Email: <RequesterEmail email={ticket.requester_email} />
        </p>
      )}
    </>
  )
}
