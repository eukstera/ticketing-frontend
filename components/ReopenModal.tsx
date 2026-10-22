// components/ReopenModal.tsx
'use client'

import { FormEvent, useId, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Field, { fieldClass } from '@/components/ui/Field'
import { getErrorMessage, isApiError } from '@/lib/api'
import { REASON_MAX, REASON_MIN, validateReopenReason } from '@/lib/falseAlarm'
import { btnSecondary, btnSuccess } from '@/lib/styles'

interface Props {
  isOpen: boolean
  ticketId: number | null
  /** Named in the dialog so the user can see which request they are reopening. */
  ticketNumber?: string
  /** Why it was rejected, shown for context. */
  rejectionReason?: string | null
  rejectedBy?: string | null
  onClose: () => void
  /** Reopens the ticket. Throw to keep the dialog open; the message is shown inline. `reason` is '' when left blank. */
  onSubmit: (ticketId: number, reason: string) => Promise<void>
}

// Mounted only while open (and per ticket), so the text and errors start fresh
// every time without reset effects.
export default function ReopenModal({ isOpen, ticketId, ...rest }: Props) {
  if (!isOpen || ticketId == null) return null
  return <ReopenContent key={ticketId} ticketId={ticketId} {...rest} />
}

function ReopenContent({
  ticketId,
  ticketNumber,
  rejectionReason,
  rejectedBy,
  onClose,
  onSubmit,
}: Omit<Props, 'isOpen' | 'ticketId'> & { ticketId: number }) {
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

    const problem = validateReopenReason(reason)
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
      else setBanner(getErrorMessage(err, "Couldn't reopen this ticket. Try again."))
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
      title="Reopen ticket"
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={submitting} className={btnSuccess}>
            <RotateCcw size={14} aria-hidden="true" />
            {submitting ? 'Reopening…' : 'Reopen ticket'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-gray-600">
        <strong className="font-semibold text-gray-800">Reopen{ticketNumber ? <> {ticketNumber}</> : null}?</strong>{' '}
        It goes back to Open, untaken, for the department to take or assign. The rejection stays in its history.
      </p>

      {rejectionReason && (
        <div className="mb-4 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <p className="font-medium">
            Rejected as a false alarm{rejectedBy ? ` by ${rejectedBy}` : ''}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap">
            <span className="font-medium">Reason: </span>
            {rejectionReason}
          </p>
        </div>
      )}

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
          label="Reason (optional)"
          error={fieldError}
          hint={
            <span className="flex justify-between gap-3">
              <span>
                Why it is a real request after all. If you write one, {REASON_MIN}–{REASON_MAX} characters.
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
              rows={3}
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
