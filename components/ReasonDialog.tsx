// components/ReasonDialog.tsx
'use client'

import { FormEvent, ReactNode, useId, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Field, { fieldClass } from '@/components/ui/Field'
import { getErrorMessage, isApiError } from '@/lib/api'
import { btnSecondary } from '@/lib/styles'

export interface ReasonDialogProps {
  title: string
  /** Text above the form. */
  intro: ReactNode
  /** The textarea's label and the API field its 422 error comes under ("notes", "reason"). */
  label: string
  apiField: string
  min: number
  max: number
  rows?: number
  validate: (text: string) => string | null
  /** Button look: a btn* class string, its label, and the label while the request runs. */
  confirmClass: string
  confirmLabel: string
  pendingLabel: string
  confirmIcon?: LucideIcon
  failureFallback: string
  onClose: () => void
  /** Do the work. Throw to keep the dialog open; the message is shown inline. */
  onSubmit: (text: string) => Promise<void>
}

/**
 * A modal with one required text box (completion notes, a close reason, ...):
 * live counter, client-side length check, a ref-based double-submit guard, and
 * the API's 422 for its field shown under the box while 403/409/other messages
 * go in a banner. Mount it only while open so the text starts fresh.
 */
export default function ReasonDialog({
  title,
  intro,
  label,
  apiField,
  min,
  max,
  rows = 4,
  validate,
  confirmClass,
  confirmLabel,
  pendingLabel,
  confirmIcon: Icon,
  failureFallback,
  onClose,
  onSubmit,
}: ReasonDialogProps) {
  const formId = useId()
  const [text, setText] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [banner, setBanner] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // A ref, not `submitting`: a fast double-click fires before React re-renders.
  const inFlight = useRef(false)

  const remaining = max - text.length

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (inFlight.current) return
    setBanner('')

    const problem = validate(text)
    if (problem) {
      setFieldError(problem)
      return
    }
    setFieldError('')

    inFlight.current = true
    setSubmitting(true)
    try {
      await onSubmit(text.trim())
      onClose()
    } catch (err) {
      console.error(err)
      const serverMessage = isApiError(err) ? err.errors?.[apiField]?.[0] : undefined
      if (serverMessage) setFieldError(serverMessage)
      else setBanner(getErrorMessage(err, failureFallback))
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
      title={title}
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={submitting} className={confirmClass}>
            {Icon && <Icon size={14} aria-hidden="true" />}
            {submitting ? pendingLabel : confirmLabel}
          </button>
        </>
      }
    >
      <div className="mb-4 text-sm text-gray-600">{intro}</div>

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
          label={label}
          required
          error={fieldError}
          hint={
            <span className="flex justify-between gap-3">
              <span>
                {min}–{max} characters.
              </span>
              <span
                className={`tabular-nums ${remaining <= 20 ? 'font-medium text-amber-700' : ''}`}
                aria-label={`${remaining} characters left`}
              >
                {text.length}/{max}
              </span>
            </span>
          }
        >
          {control => (
            <textarea
              {...control}
              value={text}
              onChange={e => {
                setText(e.target.value)
                if (fieldError) setFieldError('')
              }}
              maxLength={max}
              rows={rows}
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
