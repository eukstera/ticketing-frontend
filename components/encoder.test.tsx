import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ENCODER_ROLE_NAME, isEncoder, type AuthUser } from '@/lib/auth'
import { canAssign } from '@/lib/assign'
import { canCompleteTicket } from '@/lib/complete'
import { canCloseOnBehalf, canResendConfirmation } from '@/lib/confirmation'
import { canMarkFalseAlarm, canReopen } from '@/lib/falseAlarm'
import { canDownloadJobOrder } from '@/lib/jobOrder'

const state = vi.hoisted(() => ({ user: null as unknown }))
vi.mock('@/hooks/useUser', () => ({ useUser: () => state.user }))

import ActionCell from '@/components/department-tickets/ActionCell'
import CommentThread from '@/components/comments/CommentThread'

const encoder = { id: 7, department_id: 1, role: { id: 4, name: ENCODER_ROLE_NAME } } as AuthUser
const staff = { id: 7, department_id: 1, role: { id: 2, name: 'Normal User' } } as AuthUser

const noop = () => {}
const taken = { id: 7, created_at: '', user: 'Enc', user_id: 7 }
const ticket = (status: string, assigned_activity: typeof taken | null = null) => ({
  id: 5,
  status,
  department_id: 1,
  assigned_activity,
  requester_email: 'a@b.test',
})

function actions(user: AuthUser | null, t: ReturnType<typeof ticket>) {
  state.user = user
  return renderToString(
    <ActionCell
      ticket={t}
      ticketNumber="10-005-2026"
      onTake={noop}
      onAssign={noop}
      onMarkComplete={noop}
      onFalseAlarm={noop}
      onReopen={noop}
      onResend={noop}
      onCloseOnBehalf={noop}
      onDownloadJo={noop}
    />
  )
}

beforeEach(() => {
  state.user = null
})

describe('isEncoder', () => {
  it('matches the Encoder role by name only', () => {
    expect(isEncoder(encoder)).toBe(true)
    expect(isEncoder(staff)).toBe(false)
    expect(isEncoder(null)).toBe(false)
    expect(isEncoder(undefined)).toBe(false)
    expect(isEncoder({ ...staff, role: undefined } as AuthUser)).toBe(false)
  })
})

describe('encoders get false from every action predicate', () => {
  it('canAssign, canCompleteTicket, canMarkFalseAlarm, canReopen, canCloseOnBehalf, canResendConfirmation', () => {
    expect(canAssign(ticket('Open'), encoder)).toBe(false)
    expect(canCompleteTicket(ticket('In-progress', taken), encoder)).toBe(false)
    for (const status of ['Open', 'In-progress', 'Overdue']) {
      expect(canMarkFalseAlarm(ticket(status, taken), encoder)).toBe(false)
    }
    expect(canReopen({ status: 'False Alarm' }, encoder)).toBe(false)
    expect(canCloseOnBehalf({ status: 'Pending Confirmation' }, encoder)).toBe(false)
    expect(canResendConfirmation(ticket('Pending Confirmation'), encoder)).toBe(false)
  })

  it('staff of the same department keep the ones they had', () => {
    expect(canMarkFalseAlarm(ticket('Open'), staff)).toBe(true)
    expect(canResendConfirmation(ticket('Pending Confirmation'), staff)).toBe(true)
    expect(canCompleteTicket(ticket('In-progress', taken), staff)).toBe(true)
  })

  it('job order download stays available to an encoder of the handling department', () => {
    expect(canDownloadJobOrder({ status: 'Open', department_id: 1 }, encoder)).toBe(true)
    expect(canDownloadJobOrder({ status: 'Open', department_id: 2 }, encoder)).toBe(false)
  })
})

describe('ActionCell for an encoder', () => {
  it.each(['Open', 'In-progress', 'Overdue', 'Pending Confirmation', 'False Alarm'])(
    'offers no ticket action on a %s ticket',
    status => {
      const html = actions(encoder, ticket(status, status === 'In-progress' ? taken : null))
      for (const label of ['Take ticket', 'Assign', 'Complete', 'False alarm', 'Reopen', 'Close for requester', 'Resend email']) {
        expect(html).not.toContain(label)
      }
    }
  )

  it('still offers Download JO on an Open IT ticket', () => {
    const html = actions(encoder, ticket('Open'))
    expect(html).toContain('Download JO')
    expect(html).not.toContain('Take ticket')
  })
})

describe('CommentThread for an encoder', () => {
  const comments = [
    {
      id: 1,
      comment: 'Looks good',
      created_at: '2026-10-22T08:00:00Z',
      updated_at: '2026-10-22T08:00:00Z',
      user: { id: 7, first_name: 'Eve', last_name: 'Coder' },
    },
  ] as never

  function thread(user: AuthUser) {
    state.user = user
    return renderToString(<CommentThread ticketId={5} initialComments={comments} />)
  }

  it('shows the comments but no form and no edit/delete controls', () => {
    const html = thread(encoder)
    expect(html).toContain('Looks good')
    expect(html).not.toContain('New comment')
    expect(html).not.toContain('Submit')
    expect(html).not.toContain('Edit comment by')
    expect(html).not.toContain('Delete comment by')
  })

  it('keeps the form and the author controls for other users', () => {
    const html = thread(staff)
    expect(html).toContain('New comment')
    expect(html).toContain('Edit comment by Eve')
    expect(html).toContain('Delete comment by Eve')
  })
})
