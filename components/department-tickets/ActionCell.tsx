'use client'

import { Ban, Mail, RotateCcw, UserCheck } from 'lucide-react'
import { DepartmentTicket } from '@/types'
import { useUser } from '@/hooks/useUser'
import { FALSE_ALARM_STATUS, canMarkFalseAlarm, canReopen } from '@/lib/falseAlarm'
import { canCloseOnBehalf, canResendConfirmation, isPendingConfirmation } from '@/lib/confirmation'
import { canDownloadJobOrder } from '@/lib/jobOrder'
import type { JobOrderFormat } from '@/lib/jobOrderFormat'
import { btnPrimary, btnSecondary, btnSm, btnSuccess, btnSuccessOutline, btnWarn } from '@/lib/styles'
import JobOrderMenu from './JobOrderMenu'

const nowrap = 'whitespace-nowrap shrink-0'

export default function ActionCell({
  ticket,
  ticketNumber,
  taking = false,
  onAssign,
  onTake,
  onMarkComplete,
  onFalseAlarm,
  onReopen,
  onDownloadJo,
  downloadingJo = false,
  onResend,
  resending = false,
  onCloseOnBehalf,
}: {
  ticket: Pick<DepartmentTicket, 'id' | 'status' | 'department_id' | 'assigned_activity'> & {
    requester_email?: string | null
  }
  /** Used in the buttons' accessible names ("Take ticket 10-001-2026"). */
  ticketNumber?: string
  /** A take request for this ticket is in flight; blocks double submits. */
  taking?: boolean
  onAssign?: (id: number) => void
  onTake?: (id: number) => void
  onMarkComplete?: (id: number) => void
  onFalseAlarm?: (id: number) => void
  /** Department Heads only: put a rejected request back to Open. */
  onReopen?: (id: number) => void
  /** Download the filled job order form as Excel or PDF (IT tickets; staff of the department and Department Heads). */
  onDownloadJo?: (id: number, format: JobOrderFormat) => void
  /** This ticket's job order is downloading; blocks double clicks. */
  downloadingJo?: boolean
  /** Send the requester a new confirmation email (pending confirmations; staff and heads). */
  onResend?: (id: number) => void
  /** A resend for this ticket is in flight. */
  resending?: boolean
  /** Department Heads only: close a pending confirmation for the requester. */
  onCloseOnBehalf?: (id: number) => void
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

  const canJo = !!onDownloadJo && canDownloadJobOrder(ticket, user)
  const jobOrderButton = canJo && (
    <JobOrderMenu
      ticketNumber={ticketNumber}
      busy={downloadingJo}
      onDownload={format => onDownloadJo?.(ticket.id, format)}
    />
  )
  // Wraps on narrow cards instead of overflowing.
  const row = 'flex flex-wrap items-center gap-2'

  if (ticket.status === 'Open') {
    if (!isMember && !canReject && !canJo) return null
    return (
      <div className={row}>
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
        {jobOrderButton}
      </div>
    )
  }

  // Only a Department Head may undo a rejection, never the handling staff.
  if (ticket.status === FALSE_ALARM_STATUS && onReopen && canReopen(ticket, user)) {
    return (
      <button
        type="button"
        onClick={() => onReopen(ticket.id)}
        aria-label={`Reopen ticket${suffix}`}
        className={`${btnSuccessOutline} ${btnSm} ${nowrap}`}
      >
        <RotateCcw size={12} aria-hidden="true" />
        Reopen
      </button>
    )
  }

  // An untaken overdue request can still be rejected.
  if (ticket.status === 'Overdue' && (canReject || canJo)) {
    return (
      <div className={row}>
        {falseAlarmButton}
        {jobOrderButton}
      </div>
    )
  }

  if (ticket.status === 'In-progress') {
    const canComplete = isMember || isAssignee
    if (!canComplete && !canJo) return null
    return (
      <div className={row}>
        {canComplete && (
          <button
            type="button"
            onClick={() => onMarkComplete?.(ticket.id)}
            aria-label={`Complete ticket${suffix}`}
            className={`${btnSuccess} ${btnSm} ${nowrap}`}
          >
            Complete
          </button>
        )}
        {jobOrderButton}
      </div>
    )
  }

  // Completed by staff, waiting for the requester: nothing to complete or take, but
  // the email can be resent, a head can close it for the requester, and the job order still prints.
  if (isPendingConfirmation(ticket.status)) {
    const canResend = !!onResend && canResendConfirmation(ticket, user)
    const canClose = !!onCloseOnBehalf && canCloseOnBehalf(ticket, user)
    if (!canResend && !canClose && !canJo) return <span className="text-gray-500 text-xs">—</span>
    return (
      <div className={row}>
        {canResend && (
          <button
            type="button"
            onClick={() => onResend?.(ticket.id)}
            disabled={resending}
            aria-label={`Resend confirmation email${suffix}`}
            className={`${btnSecondary} ${btnSm} ${nowrap}`}
          >
            <Mail size={12} aria-hidden="true" />
            {resending ? 'Sending…' : 'Resend email'}
          </button>
        )}
        {canClose && (
          <button
            type="button"
            onClick={() => onCloseOnBehalf?.(ticket.id)}
            aria-label={`Close ticket${suffix} on behalf of the requester`}
            className={`${btnSuccessOutline} ${btnSm} ${nowrap}`}
          >
            <UserCheck size={12} aria-hidden="true" />
            Close for requester
          </button>
        )}
        {jobOrderButton}
      </div>
    )
  }

  // A finished ticket has nothing left to do, but its job order can still be printed.
  if (ticket.status === 'Completed' && canJo) return jobOrderButton

  if (ticket.status === 'Completed' || ticket.status === 'Overdue' || ticket.status === FALSE_ALARM_STATUS) {
    return <span className="text-gray-500 text-xs">—</span>
  }

  return null
}
