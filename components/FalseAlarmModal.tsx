// components/FalseAlarmModal.tsx
'use client'

import { FormEvent, useId, useRef, useState } from 'react'
import { Ban } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Field, { fieldClass } from '@/components/ui/Field'
import { getErrorMessage, isApiError } from '@/lib/api'
import { REASON_MAX, REASON_MIN, validateReason } from '@/lib/falseAlarm'
import { btnDanger, btnSecondary } from '@/lib/styles'

interface Props {
  isOpen: boolean
  ticketId: number | null
  /** Shown in the dialog text so the user can see which request they are rejecting. */
  ticketNumber?: string
  onClose: () => void
  /** Rejects the ticket. Throw to keep the dialog open; the message is shown inline. */
  onSubmit: (ticketId: number, reason: string) => Promise<void>
}

// Mounted only while open (and per ticket), so the text and errors start fresh
// every time without reset effects.
export default function FalseAlarmModal({ isOpen, ticketId, ticketNumber, onClose, onSubmit }: Props) {
  if (!isOpen || ticketId == null) return null
  return (
    <FalseAlarmContent
      key={ticketId}
      ticketId={ticketId}
      ticketNumber={ticketNumber}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function FalseAlarmContent({
  ticketId,
  ticketNumber,
  onClose,
  onSubmit,
}: {
  ticketId: number
  ticketNumber?: string
  onClose: () => void
  onSubmit: Props['onSubmit']
}) {
  const formId = useId()
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [banner, setBanner] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // A ref, not `submitting`: a fast double-click fires before React re-renders.
  const inFlight = useRef(false)

  const remaining = REASON_MAX - reason.length

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (inFlight.current) return
    setBanner('')

    const problem = validateReason(reason)
    if (problem) {
      setFieldError(problem)
      return
    }
    setFieldError('')

    inFlight.current = true
    setSubmitting(true)
    try {
      await onSubmit(ticketId, reason.trim())
      onClose()
    } catch (err) {
      console.error(err)
      // 422 carries the reason's own message; 403/409 and everything else go in the banner.
      const serverReason = isApiError(err) ? err.errors?.reason?.[0] : undefined
      if (serverReason) setFieldError(serverReason)
      else setBanner(getErrorMessage(err, "Couldn't mark this ticket as a false alarm. Try again."))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen
      // A request is in flight: don't let Escape / X / backdrop dismiss it
      onClose={submitting ? () => {} : onClose}
      title="Mark as false alarm"
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            // Destructive action: default focus is not on the confirm button.
            className={btnSecondary}
          >
            Cancel
          </button>
          <button type="submit" form={formId} disabled={submitting} className={btnDanger}>
            <Ban size={14} aria-hidden="true" />
            {submitting ? 'Rejecting…' : 'Reject request'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-gray-600">
        This <strong className="font-semibold text-gray-800">rejects the request</strong>
        {ticketNumber ? <> {ticketNumber}</> : null}. It is closed as a false alarm, nobody will be assigned,
        and your reason is recorded on its timeline.
      </p>

      <form id={formId} onSubmit={handleSubmit} noValidate>
        {banner && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {banner}
          </p>
        )}

        <Field
          label="Reason"
          required
          error={fieldError}
          hint={
            <span className="flex justify-between gap-3">
              <span>
                {REASON_MIN}–{REASON_MAX} characters. Say why this is not a real request.
              </span>
              <span
                className={`tabular-nums ${remaining <= 20 ? 'font-medium text-amber-700' : ''}`}
                aria-label={`${remaining} characters left`}
              >
                {reason.length}/{REASON_MAX}
              </span>
            </span>
          }
        >
          {control => (
            <textarea
              {...control}
              value={reason}
              onChange={e => {
                setReason(e.target.value)
                if (fieldError) setFieldError('')
              }}
              maxLength={REASON_MAX}
              rows={4}
              disabled={submitting}
              autoFocus
              className={`${fieldClass(!!fieldError)} resize-y`}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
