// components/CloseOnBehalfModal.tsx
'use client'

import { UserCheck } from 'lucide-react'
import ReasonDialog from '@/components/ReasonDialog'
import { CLOSE_REASON_MAX, CLOSE_REASON_MIN, NO_EMAIL_TEXT, validateCloseReason } from '@/lib/confirmation'
import { btnPrimary } from '@/lib/styles'

interface Props {
  isOpen: boolean
  ticketId: number | null
  ticketNumber?: string
  requesterEmail?: string | null
  onClose: () => void
  /** Closes the ticket. Throw to keep the dialog open; the message is shown inline. */
  onSubmit: (ticketId: number, reason: string) => Promise<void>
}

/**
 * Department Heads only: close a ticket that is waiting for confirmation
 * without the requester's reply (no address, a failed email, no response). The
 * reason is required and recorded with the closure.
 */
export default function CloseOnBehalfModal({ isOpen, ticketId, ticketNumber, requesterEmail, onClose, onSubmit }: Props) {
  if (!isOpen || ticketId == null) return null
  return (
    <ReasonDialog
      key={ticketId}
      title="Close on behalf of the requester"
      intro={
        <>
          <p>
            Close <strong className="font-semibold text-gray-800">{ticketNumber ?? 'this ticket'}</strong> as completed
            without the requester&apos;s confirmation. It is recorded as closed by a Department Head, with your reason.
          </p>
          {requesterEmail === null && (
            <p className="mt-2 text-gray-500">{NO_EMAIL_TEXT}, so there is nobody to confirm it.</p>
          )}
        </>
      }
      label="Reason"
      apiField="reason"
      min={CLOSE_REASON_MIN}
      max={CLOSE_REASON_MAX}
      rows={3}
      validate={validateCloseReason}
      confirmClass={btnPrimary}
      confirmLabel="Close ticket"
      pendingLabel="Closing…"
      confirmIcon={UserCheck}
      failureFallback="Couldn't close this ticket. Try again."
      onClose={onClose}
      onSubmit={reason => onSubmit(ticketId, reason)}
    />
  )
}
