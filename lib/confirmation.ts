import { isAdmin, isEncoder, type AuthUser } from '@/lib/auth'
import { latestActivity } from '@/lib/falseAlarm'
import type { CompletionResult, ConfirmationInfo, ConfirmationMail, ConfirmationState, DateActivity, DepartmentTicket } from '@/types'

// Completing a ticket no longer closes it: the requester is asked to confirm
// ("Pending Confirmation") until they do, a Department Head closes it for them,
// or it closes itself after a while. Staff-side rules and wording live here.

export const PENDING_CONFIRMATION_STATUS = 'Pending Confirmation'
export const NOTES_MIN = 10
export const NOTES_MAX = 2000
export const CLOSE_REASON_MIN = 5
export const CLOSE_REASON_MAX = 500

export function isPendingConfirmation(status: string): boolean {
  return status === PENDING_CONFIRMATION_STATUS
}

function validateLength(value: string, min: number, max: number, what: string): string | null {
  const length = value.trim().length
  if (length === 0) return `Enter ${what}.`
  if (length < min) return `${capitalize(what)} must be at least ${min} characters.`
  if (length > max) return `${capitalize(what)} must be at most ${max} characters.`
  return null
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Completion notes are required by the API (422 errors.notes). */
export function validateNotes(notes: string): string | null {
  return validateLength(notes, NOTES_MIN, NOTES_MAX, 'the completion notes')
}

/** Closing on the requester's behalf needs a recorded reason (422 errors.reason). */
export function validateCloseReason(reason: string): string | null {
  return validateLength(reason, CLOSE_REASON_MIN, CLOSE_REASON_MAX, 'a reason')
}

type PendingTicket = Pick<DepartmentTicket, 'status' | 'department_id'> & { requester_email?: string | null }

/**
 * "Resend email": handling-department staff and Department Heads, only while a
 * confirmation is pending and there is an address to send it to.
 */
export function canResendConfirmation(ticket: PendingTicket, user: AuthUser | null | undefined): boolean {
  if (!user || isEncoder(user) || !isPendingConfirmation(ticket.status) || !ticket.requester_email) return false
  return user.department_id === ticket.department_id || isAdmin(user)
}

/** "Close on behalf of the requester": Department Heads only, while a confirmation is pending. */
export function canCloseOnBehalf(ticket: Pick<DepartmentTicket, 'status'>, user: AuthUser | null | undefined): boolean {
  return isPendingConfirmation(ticket.status) && isAdmin(user) && !isEncoder(user)
}

export const NO_EMAIL_TEXT = 'No email provided'

export function mailStatusText(mail: ConfirmationMail | undefined | null): string {
  switch (mail?.status) {
    case 'sent':
      return 'Email sent'
    case 'pending':
      return 'Email queued'
    case 'failed':
      return 'Email failed'
    default:
      return 'No email sent'
  }
}

/** The toast after Complete: what happens next, and what to do if the email can't go out. */
export function completionMessage(confirmation: Pick<CompletionResult, 'requester_email' | 'mail'> | undefined | null): string {
  const email = confirmation?.requester_email
  const lead = "Ticket completed and sent for the requester's confirmation."
  if (!email) {
    return `${lead} There is no email address on file, so a Department Head can close it on the requester's behalf.`
  }
  switch (confirmation?.mail.status) {
    case 'sent':
      return `${lead} Confirmation email sent to ${email}.`
    case 'failed':
      return `${lead} The email to ${email} could not be sent yet. It is retried automatically, or you can resend it.`
    case 'none':
      return `${lead} No email was sent. You can resend it.`
    default:
      return `${lead} The confirmation email to ${email} is on its way.`
  }
}

export const CONFIRMATION_STATE_LABELS: Record<ConfirmationState, string> = {
  pending: 'Waiting for the requester to confirm',
  confirmed: 'Confirmed by the requester',
  disputed: 'Disputed by the requester',
  auto_closed: 'Closed automatically',
  head_closed: 'Closed by a Department Head',
  superseded: 'Replaced by a newer request',
}

export function confirmationStateLabel(state: ConfirmationState): string {
  return CONFIRMATION_STATE_LABELS[state] ?? state
}

const CHANNEL_LABELS: Record<NonNullable<ConfirmationInfo['channel']>, string> = {
  email: 'the email link',
  track: 'the Track page',
  head: 'a Department Head',
  auto: 'the automatic close',
}

export function channelLabel(channel: ConfirmationInfo['channel']): string | null {
  return channel ? CHANNEL_LABELS[channel] : null
}

/**
 * The requester's dispute while it is still the latest word: a "Disputed Date"
 * entry newer than the last completion (completing again answers it).
 */
export function currentDispute(activities: DateActivity[] | undefined): DateActivity | undefined {
  const disputed = latestActivity(activities, 'Disputed')
  if (!disputed) return undefined
  const completed = latestActivity(activities, 'Completed')
  return !completed || !(Date.parse(disputed.created_at) < Date.parse(completed.created_at)) ? disputed : undefined
}
