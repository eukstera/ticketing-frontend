import { describe, expect, it } from 'vitest'
import type { AuthUser } from '@/lib/auth'
import {
  CLOSE_REASON_MAX,
  NOTES_MAX,
  PENDING_CONFIRMATION_STATUS,
  canCloseOnBehalf,
  canResendConfirmation,
  channelLabel,
  completionMessage,
  confirmationStateLabel,
  currentDispute,
  isPendingConfirmation,
  mailStatusText,
  validateCloseReason,
  validateNotes,
} from '@/lib/confirmation'
import type { DateActivity } from '@/types'

const staff = (over: Partial<AuthUser> = {}) => ({ id: 7, department_id: 1, ...over }) as AuthUser
const head = (departmentId = 2) => staff({ department_id: departmentId, role: { id: 1, name: 'Department Head' } })
const pending = (over: Partial<{ status: string; department_id: number; requester_email: string | null }> = {}) => ({
  status: PENDING_CONFIRMATION_STATUS,
  department_id: 1,
  requester_email: 'req@example.com',
  ...over,
})

describe('validateNotes (required completion notes, 10..2000)', () => {
  it('requires them', () => {
    expect(validateNotes('')).toMatch(/Enter the completion notes/)
    expect(validateNotes('     ')).toMatch(/Enter the completion notes/)
  })

  it('counts trimmed characters against the limits', () => {
    expect(validateNotes('too short')).toMatch(/at least 10/)
    expect(validateNotes('  nine ch  ')).toMatch(/at least 10/)
    expect(validateNotes('a'.repeat(10))).toBeNull()
    expect(validateNotes('a'.repeat(NOTES_MAX))).toBeNull()
    expect(validateNotes('a'.repeat(NOTES_MAX + 1))).toMatch(/at most 2000/)
  })
})

describe('validateCloseReason (required, 5..500)', () => {
  it('requires a reason of 5 to 500 characters', () => {
    expect(validateCloseReason('')).toMatch(/Enter a reason/)
    expect(validateCloseReason('four')).toMatch(/at least 5/)
    expect(validateCloseReason('fives')).toBeNull()
    expect(validateCloseReason('a'.repeat(CLOSE_REASON_MAX))).toBeNull()
    expect(validateCloseReason('a'.repeat(CLOSE_REASON_MAX + 1))).toMatch(/at most 500/)
  })
})

describe('canResendConfirmation', () => {
  it('is offered to handling-department staff and heads while pending with an email', () => {
    expect(canResendConfirmation(pending(), staff())).toBe(true)
    expect(canResendConfirmation(pending(), head(2))).toBe(true)
  })

  it('needs an email address to send to', () => {
    expect(canResendConfirmation(pending({ requester_email: null }), staff())).toBe(false)
    expect(canResendConfirmation(pending({ requester_email: '' }), head())).toBe(false)
    expect(canResendConfirmation({ status: PENDING_CONFIRMATION_STATUS, department_id: 1 }, staff())).toBe(false)
  })

  it('only while a confirmation is pending', () => {
    for (const status of ['Open', 'In-progress', 'Completed', 'Overdue', 'False Alarm']) {
      expect(canResendConfirmation(pending({ status }), staff())).toBe(false)
      expect(canResendConfirmation(pending({ status }), head())).toBe(false)
    }
  })

  it('not for staff of another department, or without a user', () => {
    expect(canResendConfirmation(pending(), staff({ department_id: 3 }))).toBe(false)
    expect(canResendConfirmation(pending(), null)).toBe(false)
    expect(canResendConfirmation(pending(), undefined)).toBe(false)
  })
})

describe('canCloseOnBehalf', () => {
  it('is for Department Heads on a pending confirmation, with or without an email', () => {
    expect(canCloseOnBehalf({ status: PENDING_CONFIRMATION_STATUS }, head())).toBe(true)
    expect(canCloseOnBehalf({ status: PENDING_CONFIRMATION_STATUS }, head(1))).toBe(true)
  })

  it('never for the handling staff, other users or other statuses', () => {
    expect(canCloseOnBehalf({ status: PENDING_CONFIRMATION_STATUS }, staff())).toBe(false)
    expect(canCloseOnBehalf({ status: PENDING_CONFIRMATION_STATUS }, null)).toBe(false)
    for (const status of ['Open', 'In-progress', 'Completed', 'Overdue', 'False Alarm']) {
      expect(canCloseOnBehalf({ status }, head())).toBe(false)
    }
  })
})

describe('status helpers', () => {
  it('recognises the Pending Confirmation status exactly', () => {
    expect(isPendingConfirmation('Pending Confirmation')).toBe(true)
    expect(isPendingConfirmation('Completed')).toBe(false)
    expect(isPendingConfirmation('pending confirmation')).toBe(false)
  })
})

describe('completionMessage', () => {
  const lead = "Ticket completed and sent for the requester's confirmation."

  it('says the email was sent', () => {
    expect(completionMessage({ requester_email: 'r@x.com', mail: { status: 'sent' } })).toBe(
      `${lead} Confirmation email sent to r@x.com.`
    )
  })

  it('says the email is on its way while it is queued', () => {
    expect(completionMessage({ requester_email: 'r@x.com', mail: { status: 'pending' } })).toContain('is on its way')
  })

  it('says a failed email is retried and can be resent, without blocking anything', () => {
    const msg = completionMessage({ requester_email: 'r@x.com', mail: { status: 'failed' } })
    expect(msg).toContain('could not be sent yet')
    expect(msg).toMatch(/retried automatically|resend/)
  })

  it('points to a Department Head when there is no address', () => {
    for (const mail of ['none', 'pending'] as const) {
      expect(completionMessage({ requester_email: null, mail: { status: mail } })).toMatch(
        /no email address.*Department Head can close it/
      )
    }
  })

  it('copes with a missing confirmation (older server)', () => {
    expect(completionMessage(undefined)).toContain('no email address')
    expect(completionMessage(null)).toContain('Department Head')
  })
})

describe('wording', () => {
  it('describes every confirmation state and unknown ones fall back to the raw value', () => {
    expect(confirmationStateLabel('pending')).toBe('Waiting for the requester to confirm')
    expect(confirmationStateLabel('confirmed')).toBe('Confirmed by the requester')
    expect(confirmationStateLabel('disputed')).toBe('Disputed by the requester')
    expect(confirmationStateLabel('auto_closed')).toBe('Closed automatically')
    expect(confirmationStateLabel('head_closed')).toBe('Closed by a Department Head')
    expect(confirmationStateLabel('superseded')).toBeTruthy()
    expect(confirmationStateLabel('something_new' as never)).toBe('something_new')
  })

  it('names where an answer came from', () => {
    expect(channelLabel('email')).toBe('the email link')
    expect(channelLabel('head')).toBe('a Department Head')
    expect(channelLabel(null)).toBeNull()
  })

  it('says what happened to the email', () => {
    expect(mailStatusText({ status: 'sent' })).toBe('Email sent')
    expect(mailStatusText({ status: 'pending' })).toBe('Email queued')
    expect(mailStatusText({ status: 'failed' })).toBe('Email failed')
    expect(mailStatusText({ status: 'none' })).toBe('No email sent')
    expect(mailStatusText(undefined)).toBe('No email sent')
  })
})

describe('currentDispute', () => {
  const act = (id: number, category: string, created_at: string, remarks?: string): DateActivity => ({
    id,
    ticket_id: 1,
    date_category_id: 1,
    user_id: 1,
    status: 1,
    created_at,
    date_category: { id: 1, category },
    user: null,
    remarks,
  })
  const completed1 = act(1, 'Completed Date', '2026-10-22T08:00:00Z', 'Replaced the switch')
  const disputed1 = act(2, 'Disputed Date', '2026-10-22T09:00:00Z', 'Still no network')
  const completed2 = act(3, 'Completed Date', '2026-10-22T10:00:00Z', 'Replaced the cable too')
  const disputed2 = act(4, 'Disputed Date', '2026-10-22T11:00:00Z', 'Printer still offline')

  it('is the requester’s latest word while the work has not been completed again', () => {
    expect(currentDispute([completed1, disputed1])?.remarks).toBe('Still no network')
  })

  it('is answered by completing again', () => {
    expect(currentDispute([completed1, disputed1, completed2])).toBeUndefined()
  })

  it('uses the newest dispute when there are several, whatever order they come in', () => {
    expect(currentDispute([disputed2, completed2, completed1, disputed1])?.remarks).toBe('Printer still offline')
  })

  it('is none when nobody disputed', () => {
    expect(currentDispute([completed1])).toBeUndefined()
    expect(currentDispute(undefined)).toBeUndefined()
  })
})
