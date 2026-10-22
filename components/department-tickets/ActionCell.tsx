'use client'

import { Ban } from 'lucide-react'
import { DepartmentTicket } from '@/types'
import { useUser } from '@/hooks/useUser'
import { FALSE_ALARM_STATUS, canMarkFalseAlarm } from '@/lib/falseAlarm'
import { btnPrimary, btnSm, btnSuccess, btnWarn } from '@/lib/styles'

const nowrap = 'whitespace-nowrap shrink-0'

export default function ActionCell({
  ticket,
  ticketNumber,
  taking = false,
  onAssign,
  onTake,
  onMarkComplete,
  onFalseAlarm,
}: {
  ticket: Pick<DepartmentTicket, 'id' | 'status' | 'department_id' | 'assigned_activity'>
  /** Used in the buttons' accessible names ("Take ticket 10-001-2026"). */
  ticketNumber?: string
  /** A take request for this ticket is in flight; blocks double submits. */
  taking?: boolean
  onAssign?: (id: number) => void
  onTake?: (id: number) => void
  onMarkComplete?: (id: number) => void
  onFalseAlarm?: (id: number) => void
}) {
  const user = useUser()
  const suffix = ticketNumber ? ` ${ticketNumber}` : ''

  // The API only lets members of the ticket's handling department assign it
  // (403 otherwise), so everyone else gets no button.
  const isMember = !!user && user.department_id === ticket.department_id
  const isAssignee = !!user && ticket.assigned_activity?.user_id === user.id

  // Staff of the handling department and Department Heads may reject an untaken request.
  const canReject = !!onFalseAlarm && canMarkFalseAlarm(ticket, user)
  const falseAlarmButton = canReject && (
    <button
      type="button"
      onClick={() => onFalseAlarm?.(ticket.id)}
      disabled={taking}
      aria-label={`Mark ticket${suffix} as false alarm`}
      className={`${btnWarn} ${btnSm} ${nowrap}`}
    >
      <Ban size={12} aria-hidden="true" />
      False alarm
    </button>
  )

  if (ticket.status === 'Open') {
    if (!isMember && !canReject) return null
    return (
      // Wraps on narrow cards instead of overflowing.
      <div className="flex flex-wrap items-center gap-2">
        {isMember && onTake && (
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
        {isMember && (
          <button
            type="button"
            onClick={() => onAssign?.(ticket.id)}
            disabled={taking}
            aria-label={`Assign ticket${suffix}`}
            className={`${btnPrimary} ${btnSm} ${nowrap}`}
          >
            Assign
          </button>
        )}
        {falseAlarmButton}
      </div>
    )
  }

  // An untaken overdue request can still be rejected; everything else is final.
  if (ticket.status === 'Overdue' && canReject) return falseAlarmButton

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

  if (ticket.status === 'Completed' || ticket.status === 'Overdue' || ticket.status === FALSE_ALARM_STATUS) {
    return <span className="text-gray-500 text-xs">—</span>
  }

  return null
}
