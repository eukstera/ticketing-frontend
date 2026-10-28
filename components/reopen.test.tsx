import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { AuthUser } from '@/lib/auth'
import type { DateActivity, DepartmentTicket } from '@/types'

const state = vi.hoisted(() => ({ user: null as unknown }))
vi.mock('@/hooks/useUser', () => ({ useUser: () => state.user }))

import ActionCell from '@/components/department-tickets/ActionCell'
import ActionInfo from '@/components/department-tickets/ActionInfo'
import TimelineStepper from '@/components/department-tickets/TimelineStepper'
import ReopenModal from '@/components/ReopenModal'
import { getTimerStartDate } from '@/hooks/useElapsedTime'

const head = { id: 1, department_id: 2, role: { id: 1, name: 'Department Head' } } as AuthUser
const itHead = { id: 2, department_id: 1, role: { id: 1, name: 'Department Head' } } as AuthUser
const staff = { id: 7, department_id: 1, role: { id: 2, name: 'Normal User' } } as AuthUser

const noop = () => {}
const row = (status: string) => ({ id: 5, status, department_id: 1, assigned_activity: null })

function actions(user: AuthUser | null, status: string) {
  state.user = user
  return renderToString(
    <ActionCell
      ticket={row(status)}
      ticketNumber="10-005-2026"
      onTake={noop}
      onAssign={noop}
      onMarkComplete={noop}
      onFalseAlarm={noop}
      onReopen={noop}
    />
  )
}

beforeEach(() => {
  state.user = null
})

describe('Reopen button visibility', () => {
  it.each([
    ['a Department Head of another department', head],
    ['the IT Department Head', itHead],
  ])('shows on a False Alarm row for %s', (_name, user) => {
    const html = actions(user, 'False Alarm')
    expect(html).toContain('Reopen')
    expect(html).toContain('Reopen ticket 10-005-2026')
  })

  it('is hidden from the handling department staff', () => {
    const html = actions(staff, 'False Alarm')
    expect(html).not.toContain('Reopen')
    expect(html).not.toContain('<button')
  })

  it('is hidden when signed out', () => {
    expect(actions(null, 'False Alarm')).not.toContain('Reopen')
  })

  it.each(['Open', 'In-progress', 'Completed', 'Overdue'])('is hidden on a %s ticket, even for a head', status => {
    expect(actions(head, status)).not.toContain('Reopen')
  })

  it('stays out of the way when the page gives no onReopen handler', () => {
    state.user = head
    const html = renderToString(<ActionCell ticket={row('False Alarm')} />)
    expect(html).not.toContain('Reopen')
  })

  it('is a small one-line green outline button with an icon', () => {
    const html = actions(head, 'False Alarm')
    const button = html.match(/<button[^>]*aria-label="Reopen ticket[^"]*"[^>]*>/)?.[0] ?? ''
    expect(button).toContain('border-green-500')
    expect(button).toContain('!text-xs')
    expect(button).toContain('whitespace-nowrap')
    expect(html).toContain('<svg')
  })

  it('leaves a reopened (Open, untaken) ticket with its normal Take / False alarm buttons', () => {
    const html = actions(staff, 'Open')
    expect(html).toContain('Take ticket')
    expect(html).not.toContain('Assign')
    expect(html).toContain('False alarm')
    expect(html).not.toContain('Reopen')
  })
})

describe('ReopenModal', () => {
  const html = (extra: Partial<React.ComponentProps<typeof ReopenModal>> = {}) =>
    renderToString(
      <ReopenModal
        isOpen
        ticketId={5}
        ticketNumber="10-005-2026"
        rejectionReason="Duplicate of 10-001-2026"
        rejectedBy="Ben Cruz"
        onClose={noop}
        onSubmit={async () => {}}
        {...extra}
      />
    )

  it('renders nothing while closed', () => {
    expect(renderToString(<ReopenModal isOpen={false} ticketId={5} onClose={noop} onSubmit={async () => {}} />)).toBe('')
  })

  it('names the ticket and shows the original rejection for context', () => {
    const out = html()
    expect(out).toContain('10-005-2026')
    expect(out).toContain('Rejected as a false alarm')
    expect(out).toContain('Ben Cruz')
    expect(out).toContain('Duplicate of 10-001-2026')
  })

  it('has an optional Reason textarea capped at 500 with a counter', () => {
    const out = html()
    expect(out).toMatch(/<textarea[^>]*maxLength="500"/i)
    expect(out).not.toMatch(/<textarea[^>]*required/i)
    expect(out).toContain('Reason (optional)')
    expect(out).toMatch(/>0(<!-- -->)?\/(<!-- -->)?500</)
  })

  it('has Cancel and a Reopen ticket confirm button', () => {
    const out = html()
    expect(out).toContain('Cancel')
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*Reopen ticket/)
  })

  it('works without rejection context', () => {
    const out = html({ rejectionReason: null, rejectedBy: null })
    expect(out).not.toContain('Rejected as a false alarm')
  })
})

describe('history after a reopen', () => {
  const act = (id: number, category: string, created_at: string, remarks?: string, user = 'Ben Cruz'): DateActivity => ({
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
  const requested = act(1, 'Requested Date', '2026-10-22T08:00:00Z', undefined, 'Req Uester')
  const rejected1 = act(2, 'False Alarm Date', '2026-10-22T09:00:00Z', 'Duplicate of 10-001-2026')
  const reopened = act(3, 'Reopened Date', '2026-10-22T10:00:00Z', 'It is a real outage', 'Head Person')
  const rejected2 = act(4, 'False Alarm Date', '2026-10-22T11:30:00Z', 'Wrong department')

  it('returns to the normal timeline once reopened, and keeps the rejection as history', () => {
    const out = renderToString(<TimelineStepper activities={[requested, rejected1, reopened]} />)
    expect(out).toContain('Assigned Date')
    expect(out).toContain('Completed Date')
    expect(out).toContain('Rejected as false alarm by Ben Cruz')
    expect(out).toContain('Duplicate of 10-001-2026')
    expect(out).toContain('Reopened by Head Person')
    expect(out).toContain('It is a real outage')
  })

  it('lists every rejection and reopen in order, and ends at the latest false alarm', () => {
    const out = renderToString(<TimelineStepper activities={[rejected2, reopened, requested, rejected1]} />)
    expect(out).not.toContain('Assigned Date')
    const first = out.indexOf('Duplicate of 10-001-2026')
    const second = out.indexOf('It is a real outage')
    const third = out.indexOf('Wrong department')
    expect(first).toBeGreaterThan(-1)
    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
    expect(out.match(/Rejected as false alarm by/g)).toHaveLength(2)
    expect(out.match(/Reopened by/g)).toHaveLength(1)
  })

  it('shows no history list for a ticket that was never rejected', () => {
    const out = renderToString(<TimelineStepper activities={[requested]} />)
    expect(out).not.toContain('Ticket history')
  })

  it('shows who reopened it, and why, in the Info column', () => {
    const ticket = {
      status: 'Open',
      date_activities: [requested, rejected1, reopened],
      requested_activity: { id: 1, created_at: requested.created_at, user: 'Req Uester', user_id: 9 },
    } as unknown as DepartmentTicket
    const out = renderToString(<ActionInfo ticket={ticket} />)
    expect(out).toContain('Reopened by:')
    expect(out).toContain('Head Person')
    expect(out).toContain('It is a real outage')
    expect(out).not.toContain('Requested by:')
  })

  it('still shows "Requested by" for an Open ticket that was never reopened', () => {
    const ticket = {
      status: 'Open',
      date_activities: [requested],
      requested_activity: { id: 1, created_at: requested.created_at, user: 'Req Uester', user_id: 9 },
    } as unknown as DepartmentTicket
    expect(renderToString(<ActionInfo ticket={ticket} />)).toContain('Requested by:')
  })

  it('restarts the live timer at the reopen', () => {
    const open = { status: 'Open', date_activities: [requested, rejected1, reopened] } as unknown as DepartmentTicket
    expect(getTimerStartDate(open)).toBe(reopened.created_at)
    const neverReopened = { status: 'Open', date_activities: [requested] } as unknown as DepartmentTicket
    expect(getTimerStartDate(neverReopened)).toBe(requested.created_at)
  })
})
