'use client'

import { DepartmentTicket } from '@/types'
import { useUser } from '@/hooks/useUser'
import { btnPrimary, btnSm, btnSuccess } from '@/lib/styles'

const nowrap = 'whitespace-nowrap shrink-0'

export default function ActionCell({
  ticket,
  ticketNumber,
  taking = false,
  onAssign,
  onTake,
  onMarkComplete,
}: {
  ticket: Pick<DepartmentTicket, 'id' | 'status' | 'department_id' | 'assigned_activity'>
  /** Used in the buttons' accessible names ("Take ticket 10-001-2026"). */
  ticketNumber?: string
  /** A take request for this ticket is in flight; blocks double submits. */
  taking?: boolean
  onAssign?: (id: number) => void
  onTake?: (id: number) => void
  onMarkComplete?: (id: number) => void
}) {
  const user = useUser()
  const suffix = ticketNumber ? ` ${ticketNumber}` : ''

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
            type="button"
            onClick={() => onTake(ticket.id)}
            disabled={taking}
            aria-label={`Take ticket${suffix}`}
            className={`${btnSuccess} ${btnSm} ${nowrap}`}
          >
            {taking ? 'Taking…' : 'Take ticket'}
          </button>
        )}
        <button
          type="button"
          onClick={() => onAssign?.(ticket.id)}
          disabled={taking}
          aria-label={`Assign ticket${suffix}`}
          className={`${btnPrimary} ${btnSm} ${nowrap}`}
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
        type="button"
        onClick={() => onMarkComplete?.(ticket.id)}
        aria-label={`Complete ticket${suffix}`}
        className={`${btnSuccess} ${btnSm} ${nowrap}`}
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
