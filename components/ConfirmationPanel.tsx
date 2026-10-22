// components/ConfirmationPanel.tsx
'use client'

import type { ReactNode } from 'react'
import { Mail, UserCheck } from 'lucide-react'
import RequesterEmail from '@/components/ui/RequesterEmail'
import SurveyResults from '@/components/SurveyResults'
import { channelLabel, confirmationStateLabel, mailStatusText } from '@/lib/confirmation'
import { formatDateTimeText } from '@/lib/format'
import { badgeBase, btnSecondary, btnSm, btnSuccessOutline } from '@/lib/styles'
import type { ConfirmationInfo, ConfirmationState, PersonRef } from '@/types'

const STATE_BADGE: Record<ConfirmationState, string> = {
  pending: 'bg-teal-100 text-teal-800',
  confirmed: 'bg-green-100 text-green-800',
  disputed: 'bg-amber-100 text-amber-800',
  auto_closed: 'bg-gray-100 text-gray-700',
  head_closed: 'bg-blue-100 text-blue-800',
  superseded: 'bg-gray-100 text-gray-700',
}

const MAIL_TEXT: Record<string, string> = {
  sent: 'text-green-700',
  failed: 'text-red-700',
  pending: 'text-amber-700',
  none: 'text-gray-600',
}

function personName(p: PersonRef | null) {
  return p ? `${p.first_name} ${p.last_name}` : null
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-700">{children}</dd>
    </div>
  )
}

/**
 * The latest "ask the requester to confirm" on a completed ticket: where it
 * stands, the completion notes, whether the email went out, and the actions
 * staff have (resend the email; a Department Head can close for the requester).
 */
export default function ConfirmationPanel({
  confirmation,
  canResend,
  resending = false,
  onResend,
  canClose,
  onCloseOnBehalf,
}: {
  confirmation: ConfirmationInfo
  canResend: boolean
  resending?: boolean
  onResend?: () => void
  canClose: boolean
  onCloseOnBehalf?: () => void
}) {
  const c = confirmation
  const mail = c.mail
  const answeredVia = channelLabel(c.channel)

  return (
    <section aria-labelledby="confirmation-heading" className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="confirmation-heading" className="text-sm font-semibold text-gray-800">
          Requester confirmation
        </h2>
        <span className={`${badgeBase} ${STATE_BADGE[c.state] ?? STATE_BADGE.superseded}`}>
          {confirmationStateLabel(c.state)}
        </span>
      </div>

      {c.state === 'disputed' && c.dispute_reason && (
        <div role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">The requester says the work isn&apos;t done</p>
          <p className="mt-1 whitespace-pre-wrap">{c.dispute_reason}</p>
          <p className="mt-1 text-xs text-amber-800">The ticket is back In-progress with the same technician.</p>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Row label="Completed by">
          {[personName(c.completed_by), formatDateTimeText(c.completed_at)].filter(Boolean).join(' · ')}
        </Row>
        <Row label="Requester email">
          <RequesterEmail email={c.requester_email} />
        </Row>
        <Row label="Email status">
          <span className={`font-medium ${MAIL_TEXT[mail.status] ?? MAIL_TEXT.none}`}>{mailStatusText(mail)}</span>
          {typeof mail.attempts === 'number' && mail.attempts > 0 && (
            <span className="text-gray-500">{` · ${mail.attempts} ${mail.attempts === 1 ? 'attempt' : 'attempts'}`}</span>
          )}
          {mail.sent_at && <span className="text-gray-500">{` · sent ${formatDateTimeText(mail.sent_at)}`}</span>}
          {mail.status === 'failed' && mail.error && (
            <span className="mt-0.5 block break-words text-xs text-red-700">{mail.error}</span>
          )}
        </Row>
        {c.state === 'pending' && c.auto_close_at && (
          <Row label="Closes automatically">{formatDateTimeText(c.auto_close_at)}</Row>
        )}
        {c.responded_at && (
          <Row label="Answered">
            {formatDateTimeText(c.responded_at)}
            {answeredVia ? ` · via ${answeredVia}` : ''}
          </Row>
        )}
        <Row label="Survey">
          {c.survey?.submitted
            ? `Submitted${c.survey.submitted_at ? ` ${formatDateTimeText(c.survey.submitted_at)}` : ''}`
            : <span className="text-gray-500">Not submitted</span>}
        </Row>
      </dl>

      {c.completion_notes && (
        <dl className="mt-3">
          <Row label="Completion notes">
            <span className="whitespace-pre-wrap">{c.completion_notes}</span>
          </Row>
        </dl>
      )}

      <SurveyResults survey={c.survey} />

      {(canResend || canClose) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          {canResend && (
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className={`${btnSecondary} ${btnSm} whitespace-nowrap`}
            >
              <Mail size={12} aria-hidden="true" />
              {resending ? 'Sending…' : 'Resend email'}
            </button>
          )}
          {canClose && (
            <button
              type="button"
              onClick={onCloseOnBehalf}
              className={`${btnSuccessOutline} ${btnSm} whitespace-nowrap`}
            >
              <UserCheck size={12} aria-hidden="true" />
              Close on behalf of requester
            </button>
          )}
        </div>
      )}
    </section>
  )
}
