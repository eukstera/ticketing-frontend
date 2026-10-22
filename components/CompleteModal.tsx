// components/CompleteModal.tsx
'use client'

import { CheckCircle2 } from 'lucide-react'
import ReasonDialog from '@/components/ReasonDialog'
import { NOTES_MAX, NOTES_MIN, NO_EMAIL_TEXT, validateNotes } from '@/lib/confirmation'
import { btnSuccess } from '@/lib/styles'

interface Props {
  isOpen: boolean
  ticketId: number | null
  ticketNumber?: string
  /** Where the confirmation email will go; null = none on file, undefined = not known. */
  requesterEmail?: string | null
  onClose: () => void
  /** Completes the ticket. Throw to keep the dialog open; the message is shown inline. */
  onSubmit: (ticketId: number, notes: string) => Promise<void>
}

/**
 * "Complete ticket": the work is done, and the requester is asked to confirm.
 * Completion notes are required (the API rejects a completion without them).
 */
export default function CompleteModal({ isOpen, ticketId, ticketNumber, requesterEmail, onClose, onSubmit }: Props) {
  if (!isOpen || ticketId == null) return null
  return (
    <ReasonDialog
      key={ticketId}
      title="Complete ticket"
      intro={
        <>
          <p>
            Mark <strong className="font-semibold text-gray-800">{ticketNumber ?? 'this ticket'}</strong> as done. It is
            not closed yet: the requester is asked to confirm the work first.
          </p>
          {requesterEmail !== undefined && (
            <p className="mt-2">
              {requesterEmail ? (
                <>
                  The confirmation email goes to <strong className="font-semibold text-gray-800">{requesterEmail}</strong>.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-gray-800">{NO_EMAIL_TEXT}.</strong> A Department Head will have to
                  close it on the requester&apos;s behalf.
                </>
              )}
            </p>
          )}
        </>
      }
      label="Completion notes"
      apiField="notes"
      min={NOTES_MIN}
      max={NOTES_MAX}
      rows={5}
      validate={validateNotes}
      confirmClass={btnSuccess}
      confirmLabel="Complete ticket"
      pendingLabel="Completing…"
      confirmIcon={CheckCircle2}
      failureFallback="Couldn't complete this ticket. Try again."
      onClose={onClose}
      onSubmit={notes => onSubmit(ticketId, notes)}
    />
  )
}
