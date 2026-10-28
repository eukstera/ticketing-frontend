import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { AuthUser } from '@/lib/auth'
import type { ConfirmationInfo, DateActivity, DepartmentTicket } from '@/types'

const state = vi.hoisted(() => ({ user: null as unknown }))
vi.mock('@/hooks/useUser', () => ({ useUser: () => state.user }))

import ActionCell from '@/components/department-tickets/ActionCell'
import ActionInfo from '@/components/department-tickets/ActionInfo'
import StatusCell from '@/components/department-tickets/StatusCell'
import TimelineStepper from '@/components/department-tickets/TimelineStepper'
import ConfirmationPanel from '@/components/ConfirmationPanel'
import CompleteModal from '@/components/CompleteModal'
import CloseOnBehalfModal from '@/components/CloseOnBehalfModal'
import RequesterEmail from '@/components/ui/RequesterEmail'
import { buildStatusPills } from '@/components/tickets/pills'
import { STATUS_STYLES } from '@/lib/styles'

const staff = { id: 7, department_id: 1, role: { id: 2, name: 'Normal User' } } as AuthUser
const otherStaff = { id: 8, department_id: 3, role: { id: 2, name: 'Normal User' } } as AuthUser
const head = { id: 1, department_id: 2, role: { id: 1, name: 'Department Head' } } as AuthUser
const noop = () => {}

const ticket = (status: string, over: Record<string, unknown> = {}) => ({
  id: 5,
  status,
  department_id: 1,
  assigned_activity: null,
  requester_email: 'req@example.com',
  ...over,
})

function actions(user: AuthUser | null, t: ReturnType<typeof ticket>, withHandlers = true) {
  state.user = user
  return renderToString(
    <ActionCell
      ticket={t as never}
      ticketNumber="10-005-2026"
      onTake={noop}
      onAssign={noop}
      onMarkComplete={noop}
      onFalseAlarm={noop}
      onReopen={noop}
      onDownloadJo={noop}
      onResend={withHandlers ? noop : undefined}
      onCloseOnBehalf={withHandlers ? noop : undefined}
    />
  )
}

beforeEach(() => {
  state.user = null
})

describe('Pending Confirmation status badge', () => {
  it('has its own colour and stays on one line', () => {
    const badges = Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.badge])
    expect(STATUS_STYLES['Pending Confirmation'].badge).toContain('teal')
    expect(badges.filter(([, b]) => b === STATUS_STYLES['Pending Confirmation'].badge)).toHaveLength(1)
    const html = renderToString(<StatusCell ticket={{ status: 'Pending Confirmation' } as DepartmentTicket} />)
    for (const cls of ['whitespace-nowrap', 'inline-flex', 'shrink-0']) expect(html).toContain(cls)
    expect(html).toContain('>Pending Confirmation<')
  })
})

describe('Pending Confirmation filter pill', () => {
  it('appears as its own tab with its colour and count, next to the others', () => {
    const pills = buildStatusPills([
      { id: null, label: 'All', count: 10 },
      { id: 2, label: 'In-progress', count: 3 },
      { id: 6, label: 'Pending Confirmation', count: 4 },
      { id: 3, label: 'Completed', count: 3 },
    ])
    const pending = pills.find(p => p.label === 'Pending Confirmation')!
    expect(pending).toMatchObject({ value: '6', count: 4 })
    expect(pending.color).toContain('teal')
    expect(pills.filter(p => p.value !== null).reduce((n, p) => n + p.count, 0)).toBe(pills[0].count)
  })
})

describe('actions on a Pending Confirmation ticket', () => {
  it('offers handling staff Resend email and Download JO, but no Take, Assign, Complete or False alarm', () => {
    const html = actions(staff, ticket('Pending Confirmation'))
    expect(html).toContain('Resend email')
    expect(html).toContain('Download JO')
    for (const gone of ['Take ticket', 'Assign', 'Complete', 'False alarm', 'Reopen', 'Close for requester']) {
      expect(html).not.toContain(gone)
    }
  })

  it('offers a Department Head "Close for requester" on top', () => {
    const html = actions(head, ticket('Pending Confirmation'))
    expect(html).toContain('Close for requester')
    expect(html).toContain('Close ticket 10-005-2026 on behalf of the requester')
    expect(html).toContain('Resend email')
  })

  it('lets a head close it even when there is no email (nothing to resend)', () => {
    const html = actions(head, ticket('Pending Confirmation', { requester_email: null }))
    expect(html).toContain('Close for requester')
    expect(html).not.toContain('Resend email')
  })

  it('never offers closing to the handling staff', () => {
    expect(actions(staff, ticket('Pending Confirmation'))).not.toContain('Close for requester')
  })

  it('shows staff of another department nothing but a dash', () => {
    const html = actions(otherStaff, ticket('Pending Confirmation'))
    expect(html).not.toContain('<button')
    expect(html).toContain('—')
  })

  it('has no resend/close buttons when the page gives no handlers', () => {
    const html = actions(head, ticket('Pending Confirmation'), false)
    expect(html).not.toContain('Resend email')
    expect(html).not.toContain('Close for requester')
    expect(html).toContain('Download JO')
  })

  it('disables Resend while it is being sent', () => {
    state.user = staff
    const html = renderToString(
      <ActionCell ticket={ticket('Pending Confirmation') as never} onResend={noop} resending />
    )
    expect(html).toContain('Sending…')
    expect(html).toMatch(/<button[^>]*\sdisabled=""/)
  })

  it('does not show Resend/Close on other statuses, and In-progress still has Complete', () => {
    for (const status of ['Open', 'In-progress', 'Completed', 'Overdue', 'False Alarm']) {
      const html = actions(head, ticket(status, { assigned_activity: status === 'In-progress' ? { id: 1, created_at: '', user: 'A', user_id: 7 } : null }))
      expect(html).not.toContain('Resend email')
      expect(html).not.toContain('Close for requester')
    }
    const inProgress = actions(staff, ticket('In-progress', { assigned_activity: { id: 1, created_at: '', user: 'A', user_id: 7 } }))
    expect(inProgress).toContain('Complete')
  })
})

describe('requester email', () => {
  it('is a mailto link with the address encoded', () => {
    const html = renderToString(<RequesterEmail email="a.b+c@example.com" />)
    expect(html).toContain('href="mailto:a.b%2Bc%40example.com"')
    expect(html).toContain('>a.b+c@example.com<')
  })

  it('cannot smuggle mail headers through the address', () => {
    const html = renderToString(<RequesterEmail email="x@example.com?cc=boss@example.com" />)
    expect(html).not.toMatch(/href="mailto:[^"]*\?cc=/)
  })

  it('has a clear empty state', () => {
    for (const email of [null, undefined, '']) {
      expect(renderToString(<RequesterEmail email={email} />)).toContain('No email provided')
    }
  })
})

describe('Info column', () => {
  const act = (id: number, category: string, created_at: string, remarks?: string, user: string | null = 'Ana Tech'): DateActivity => ({
    id,
    ticket_id: 5,
    date_category_id: 1,
    user_id: 1,
    status: 1,
    created_at,
    date_category: { id: 1, category },
    user,
    remarks,
  })
  const requested = act(1, 'Requested Date', '2026-10-22T07:00:00Z', undefined, 'Req Uester')
  const completed = act(2, 'Completed Date', '2026-10-22T09:00:00Z', 'Replaced the faulty switch')
  const disputed = act(3, 'Disputed Date', '2026-10-22T10:00:00Z', 'Still no network', null)

  const info = (status: string, activities: DateActivity[], over: Record<string, unknown> = {}) =>
    renderToString(<ActionInfo ticket={{ status, date_activities: activities, ...over } as unknown as DepartmentTicket} />)

  it('shows a pending ticket as awaiting confirmation, with who completed it and the notes', () => {
    const out = info('Pending Confirmation', [requested, completed])
    expect(out).toContain('Awaiting requester confirmation')
    expect(out).toContain('Ana Tech')
    expect(out).toContain('Action taken: ')
    expect(out).toContain('Replaced the faulty switch')
  })

  it('shows the requester email, or "No email provided", when the server sends the field', () => {
    expect(info('Pending Confirmation', [completed], { requester_email: 'req@example.com' })).toContain('mailto:req%40example.com')
    expect(info('Open', [requested], { requester_email: null })).toContain('No email provided')
  })

  it('shows no email line from an older server that has no such field', () => {
    const out = info('Pending Confirmation', [completed])
    expect(out).not.toContain('No email provided')
    expect(out).not.toContain('Email:')
  })

  it('shows the requester’s dispute under an In-progress ticket until it is completed again', () => {
    const assigned = { id: 1, created_at: '2026-10-22T08:00:00Z', user: 'Ana Tech', user_id: 7 }
    const out = info('In-progress', [requested, completed, disputed], { assigned_activity: assigned })
    expect(out).toContain('Disputed by requester:')
    expect(out).toContain('Still no network')

    const again = act(4, 'Completed Date', '2026-10-22T11:00:00Z', 'Fixed the cable too')
    expect(info('In-progress', [requested, completed, disputed, again], { assigned_activity: assigned })).not.toContain(
      'Disputed by requester'
    )
  })
})

describe('timeline history for completion and confirmation', () => {
  const act = (id: number, category: string, created_at: string, remarks?: string, user: string | null = 'Ana Tech'): DateActivity => ({
    id,
    ticket_id: 5,
    date_category_id: 1,
    user_id: 1,
    status: 1,
    created_at,
    date_category: { id: 1, category },
    user,
    remarks,
  })
  const requested = act(1, 'Requested Date', '2026-10-22T07:00:00Z', undefined, 'Req Uester')
  const assigned = act(2, 'Assigned Date', '2026-10-22T08:00:00Z')
  const completed1 = act(3, 'Completed Date', '2026-10-22T09:00:00Z', 'Replaced the faulty switch')
  const disputed1 = act(4, 'Disputed Date', '2026-10-22T10:00:00Z', 'Still no network', null)
  const completed2 = act(5, 'Completed Date', '2026-10-22T11:00:00Z', 'Also replaced the cable')
  const disputed2 = act(6, 'Disputed Date', '2026-10-22T12:00:00Z', 'Printer offline', null)
  const confirmed = act(7, 'Confirmed Date', '2026-10-22T13:00:00Z', 'All good', null)

  const out = (activities: DateActivity[]) => renderToString(<TimelineStepper activities={activities} />)

  it('shows the completion notes in the history, with the Completed step reached', () => {
    const html = out([requested, assigned, completed1])
    expect(html).toContain('Ticket history')
    expect(html).toContain('Completed by Ana Tech')
    expect(html).toContain('Action taken: ')
    expect(html).toContain('Replaced the faulty switch')
  })

  it('does not list a plain completion without notes (the steps already show it)', () => {
    const html = out([requested, assigned, act(3, 'Completed Date', '2026-10-22T09:00:00Z')])
    expect(html).not.toContain('Ticket history')
  })

  it('shows a dispute, and puts the Completed step back to pending until it is completed again', () => {
    const html = out([requested, assigned, completed1, disputed1])
    expect(html).toContain('Disputed by the requester')
    expect(html).toContain('Still no network')
    // the Completed step reads "Pending" again: the only dated "Completed Date" label is gone
    expect(html).toMatch(/Pending[\s\S]*Completed Date/)
  })

  it('tolerates repeated completions and disputes, listing all of them in order', () => {
    const html = out([disputed2, completed2, requested, completed1, assigned, disputed1])
    const order = ['Replaced the faulty switch', 'Still no network', 'Also replaced the cable', 'Printer offline'].map(t =>
      html.indexOf(t)
    )
    expect(order.every(i => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html.match(/Disputed by the requester/g)).toHaveLength(2)
    expect(html.match(/Completed by Ana Tech/g)).toHaveLength(2)
  })

  it('shows the confirmation, with the requester’s note', () => {
    const html = out([requested, assigned, completed1, confirmed])
    expect(html).toContain('Confirmed by the requester')
    expect(html).toContain('Note: ')
    expect(html).toContain('All good')
  })

  it('names the head when a head closed it for the requester', () => {
    const byHead = act(7, 'Confirmed Date', '2026-10-22T13:00:00Z', 'Requester has no email', 'Head Person')
    expect(out([requested, assigned, completed1, byHead])).toContain('Confirmed by Head Person')
  })

  it('shows an automatic close', () => {
    const auto = act(8, 'Auto-closed Date', '2026-11-21T09:00:00Z', 'No reply in 30 days', null)
    const html = out([requested, assigned, completed1, auto])
    expect(html).toContain('Closed automatically')
    expect(html).toContain('No reply in 30 days')
  })
})

describe('ConfirmationPanel', () => {
  const base: ConfirmationInfo = {
    state: 'pending',
    completion_notes: 'Replaced the faulty switch.',
    completed_by: { id: 7, first_name: 'Ana', last_name: 'Tech' },
    completed_at: '2026-10-22T09:00:00Z',
    auto_close_at: '2026-11-21T09:00:00Z',
    channel: null,
    responded_at: null,
    dispute_reason: null,
    requester_email: 'req@example.com',
    mail: { status: 'sent', attempts: 1, sent_at: '2026-10-22T09:01:00Z', error: null },
    survey: { submitted: false, submitted_at: null },
  }
  const panel = (over: Partial<ConfirmationInfo> = {}, flags: { canResend?: boolean; canClose?: boolean; resending?: boolean } = {}) =>
    renderToString(
      <ConfirmationPanel
        confirmation={{ ...base, ...over }}
        canResend={flags.canResend ?? false}
        canClose={flags.canClose ?? false}
        resending={flags.resending}
        onResend={noop}
        onCloseOnBehalf={noop}
      />
    )

  it('shows a pending confirmation: state, notes, who completed it, email, mail status and the auto-close date', () => {
    const html = panel()
    expect(html).toContain('Waiting for the requester to confirm')
    expect(html).toContain('Replaced the faulty switch.')
    expect(html).toContain('Ana Tech')
    expect(html).toContain('mailto:req%40example.com')
    expect(html).toContain('Email sent')
    expect(html).toContain('1 attempt')
    expect(html).toContain('Closes automatically')
    expect(html).toContain('Not submitted')
  })

  it('shows a failed email with its attempts and error', () => {
    const html = panel({ mail: { status: 'failed', attempts: 3, sent_at: null, error: 'SMTP connection refused' } })
    expect(html).toContain('Email failed')
    expect(html).toContain('3 attempts')
    expect(html).toContain('SMTP connection refused')
  })

  it('does not show an error for an email that was sent', () => {
    expect(panel({ mail: { status: 'sent', error: 'old error' } })).not.toContain('old error')
  })

  it('shows "No email provided" when there is nowhere to send it', () => {
    const html = panel({ requester_email: null, mail: { status: 'none', attempts: 0 } })
    expect(html).toContain('No email provided')
    expect(html).toContain('No email sent')
  })

  it('shows a dispute prominently with its reason and that the ticket is back in progress', () => {
    const html = panel({ state: 'disputed', dispute_reason: 'Still no network', responded_at: '2026-10-22T10:00:00Z', channel: 'email' })
    expect(html).toContain('Disputed by the requester')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Still no network')
    expect(html).toContain('back In-progress')
    expect(html).toContain('via the email link')
    expect(html).not.toContain('Closes automatically')
  })

  it('shows a confirmation with the survey and where it came from', () => {
    const html = panel({
      state: 'confirmed',
      channel: 'email',
      responded_at: '2026-10-22T12:00:00Z',
      survey: { submitted: true, submitted_at: '2026-10-22T12:05:00Z' },
    })
    expect(html).toContain('Confirmed by the requester')
    expect(html).toContain('via the email link')
    expect(html).toContain('Submitted')
    expect(html).not.toContain('Closes automatically')
  })

  it('names a close by a head and an automatic close', () => {
    expect(panel({ state: 'head_closed', channel: 'head' })).toContain('Closed by a Department Head')
    expect(panel({ state: 'auto_closed', channel: 'auto' })).toContain('Closed automatically')
  })

  it('shows Resend email and Close on behalf only when allowed', () => {
    const none = panel()
    expect(none).not.toContain('Resend email')
    expect(none).not.toContain('Close on behalf')

    const both = panel({}, { canResend: true, canClose: true })
    expect(both).toContain('Resend email')
    expect(both).toContain('Close on behalf of requester')

    expect(panel({}, { canResend: true })).not.toContain('Close on behalf')
    expect(panel({}, { canClose: true })).not.toContain('Resend email')
  })

  it('shows a pending state on Resend while it is sending', () => {
    const html = panel({}, { canResend: true, resending: true })
    expect(html).toContain('Sending…')
    expect(html).toMatch(/<button[^>]*\sdisabled=""/)
  })
})

describe('Complete and Close dialogs', () => {
  const complete = (props: Partial<React.ComponentProps<typeof CompleteModal>> = {}) =>
    renderToString(
      <CompleteModal isOpen ticketId={5} ticketNumber="10-005-2026" onClose={noop} onSubmit={async () => {}} {...props} />
    )

  it('requires completion notes: a required, labelled textarea capped at 2000, with a counter', () => {
    const out = complete()
    expect(out).toContain('Action taken')
    expect(out).toMatch(/<textarea[^>]*maxLength="2000"/i)
    expect(out).toMatch(/<textarea[^>]*required/i)
    expect(out).toMatch(/>0(<!-- -->)?\/(<!-- -->)?2000</)
    expect(out).toContain('Complete ticket')
  })

  it('says the ticket is not closed yet and where the confirmation email goes', () => {
    const out = complete({ requesterEmail: 'req@example.com' })
    expect(out).toContain('not closed yet')
    expect(out).toContain('req@example.com')
  })

  it('warns when there is no email, and says a head must close it', () => {
    const out = complete({ requesterEmail: null })
    expect(out).toContain('No email provided')
    expect(out).toContain('Department Head')
  })

  it('stays quiet about email when it is not known', () => {
    const out = complete({ requesterEmail: undefined })
    expect(out).not.toContain('confirmation email goes to')
    expect(out).not.toContain('No email provided')
  })

  it('renders nothing while closed', () => {
    expect(complete({ isOpen: false })).toBe('')
  })

  it('the close dialog needs a reason of 5-500 characters and says it is recorded as a head closing it', () => {
    const out = renderToString(
      <CloseOnBehalfModal isOpen ticketId={5} ticketNumber="10-005-2026" requesterEmail={null} onClose={noop} onSubmit={async () => {}} />
    )
    expect(out).toContain('Close on behalf of the requester')
    expect(out).toMatch(/<textarea[^>]*maxLength="500"/i)
    expect(out).toMatch(/<textarea[^>]*required/i)
    expect(out).toContain('closed by a Department Head')
    expect(out).toContain('No email provided')
    expect(out).toContain('Close ticket')
  })
})
