import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { AuthUser } from '@/lib/auth'
import type { DateActivity, DepartmentTicket } from '@/types'

const state = vi.hoisted(() => ({ user: null as unknown }))
vi.mock('@/hooks/useUser', () => ({ useUser: () => state.user }))

import ActionCell from '@/components/department-tickets/ActionCell'
import ActionInfo from '@/components/department-tickets/ActionInfo'
import TimelineStepper from '@/components/department-tickets/TimelineStepper'
import FalseAlarmModal from '@/components/FalseAlarmModal'
import StatusCell from '@/components/department-tickets/StatusCell'
import FilterPills from '@/components/department-tickets/FilterPills'
import { buildStatusPills } from '@/components/tickets/pills'
import { STATUS_FALLBACK, STATUS_STYLES, badgeBase, statusBadgeClass } from '@/lib/styles'

const staff = { id: 7, department_id: 1, role: { id: 2, name: 'Normal User' } } as AuthUser
const otherHead = { id: 8, department_id: 2, role: { id: 1, name: 'Department Head' } } as AuthUser

const noop = () => {}
const row = (over: Partial<Pick<DepartmentTicket, 'status' | 'assigned_activity'>> = {}) => ({
  id: 5,
  status: 'Open',
  department_id: 1,
  assigned_activity: null,
  ...over,
})

function actions(user: AuthUser | null, ticket = row()) {
  state.user = user
  return renderToString(
    <ActionCell
      ticket={ticket}
      ticketNumber="10-005-2026"
      onTake={noop}
      onAssign={noop}
      onMarkComplete={noop}
      onFalseAlarm={noop}
    />
  )
}

beforeEach(() => {
  state.user = null
})

describe('ActionCell: False alarm button', () => {
  it('sits next to Take ticket on an untaken open ticket, without Assign for staff', () => {
    const html = actions(staff)
    expect(html).toContain('Take ticket')
    expect(html).not.toContain('Assign')
    expect(html).toContain('False alarm')
    expect(html).toContain('Mark ticket 10-005-2026 as false alarm')
  })

  it('wraps so the buttons never overflow a narrow card', () => {
    expect(actions(staff)).toMatch(/class="flex flex-wrap/)
  })

  it('uses the amber warning style at the small size', () => {
    const html = actions(staff)
    const button = html.match(/<button[^>]*aria-label="Mark ticket[^"]*"[^>]*>/)?.[0] ?? ''
    expect(button).toContain('border-amber-400')
    expect(button).toContain('!text-xs')
  })

  it('gives a Department Head of another department only the False alarm button', () => {
    const html = actions(otherHead)
    expect(html).toContain('False alarm')
    expect(html).not.toContain('Take ticket')
    expect(html).not.toContain('Assign ticket')
  })

  it('is hidden for other departments and signed-out users', () => {
    expect(actions({ ...staff, department_id: 2 } as AuthUser)).toBe('')
    expect(actions(null)).toBe('')
  })

  it('is hidden once the ticket is taken', () => {
    const taken = row({ status: 'In-progress', assigned_activity: { id: 1, created_at: '', user: 'Ana', user_id: 3 } })
    expect(actions(staff, taken)).not.toContain('False alarm')
  })

  it('is offered on an untaken overdue ticket, but not a taken one', () => {
    expect(actions(staff, row({ status: 'Overdue' }))).toContain('False alarm')
    const taken = row({ status: 'Overdue', assigned_activity: { id: 1, created_at: '', user: 'Ana', user_id: 3 } })
    expect(actions(staff, taken)).not.toContain('False alarm')
  })

  it('clears the Action column once rejected', () => {
    const html = actions(staff, row({ status: 'False Alarm' }))
    expect(html).not.toContain('<button')
    expect(html).toContain('—')
  })
})

describe('False Alarm status colour', () => {
  it('has its own colour, different from every other status', () => {
    const badges = Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.badge])
    expect(STATUS_STYLES['False Alarm'].badge).toContain('violet')
    expect(badges.filter(([, b]) => b === STATUS_STYLES['False Alarm'].badge)).toHaveLength(1)
  })
})

describe('FalseAlarmModal', () => {
  const html = () =>
    renderToString(
      <FalseAlarmModal isOpen ticketId={5} ticketNumber="10-005-2026" onClose={noop} onSubmit={async () => {}} />
    )

  it('renders nothing while closed', () => {
    expect(
      renderToString(<FalseAlarmModal isOpen={false} ticketId={5} onClose={noop} onSubmit={async () => {}} />)
    ).toBe('')
  })

  it('says plainly that it rejects the request, and names it', () => {
    expect(html()).toContain('rejects the request')
    expect(html()).toContain('10-005-2026')
  })

  it('has a required, labelled Reason textarea capped at 500 with a live counter', () => {
    const out = html()
    expect(out).toMatch(/<textarea[^>]*maxLength="500"/i)
    expect(out).toMatch(/<textarea[^>]*required/i)
    expect(out).toMatch(/<label[^>]*>[^<]*<span>Reason/)
    // renderToString separates adjacent text nodes with <!-- --> markers
    expect(out).toMatch(/>0(<!-- -->)?\/(<!-- -->)?500</)
  })

  it('has Cancel and a destructive confirm button', () => {
    const out = html()
    expect(out).toContain('Cancel')
    expect(out).toContain('Reject request')
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*bg-red-600/)
  })
})

describe('rejected ticket display', () => {
  const act = (category: string, created_at: string, remarks?: string): DateActivity => ({
    id: 1,
    ticket_id: 5,
    date_category_id: 1,
    user_id: 1,
    status: 1,
    created_at,
    date_category: { id: 1, category },
    user: 'Ben Cruz',
    remarks,
  })
  const activities = [
    act('Requested Date', '2026-10-22T08:00:00Z'),
    act('False Alarm Date', '2026-10-22T09:00:00Z', 'Duplicate of 10-001-2026'),
  ]

  it('ends the timeline at the false alarm and shows the reason', () => {
    const out = renderToString(<TimelineStepper activities={activities} />)
    expect(out).toContain('False Alarm Date')
    expect(out).toContain('Requested Date')
    expect(out).not.toContain('Assigned Date')
    expect(out).not.toContain('Completed Date')
    expect(out).toContain('Reason: ')
    expect(out).toContain('Duplicate of 10-001-2026')
  })

  it('keeps the normal timeline for other tickets', () => {
    const out = renderToString(<TimelineStepper activities={[activities[0]]} />)
    expect(out).toContain('Assigned Date')
    expect(out).toContain('Completed Date')
    expect(out).not.toContain('False Alarm Date')
  })

  it('shows who rejected it and why in the Info column', () => {
    const ticket = { status: 'False Alarm', date_activities: activities } as unknown as DepartmentTicket
    const out = renderToString(<ActionInfo ticket={ticket} />)
    expect(out).toContain('Rejected by:')
    expect(out).toContain('Ben Cruz')
    expect(out).toContain('Duplicate of 10-001-2026')
  })
})

describe('status badges stay on one line', () => {
  const STATUSES = ['Open', 'In-progress', 'Completed', 'Overdue', 'False Alarm', 'Something New']
  const badgeFor = (status: string) =>
    renderToString(<StatusCell ticket={{ status } as unknown as DepartmentTicket} />)

  it.each(STATUSES)('"%s" is nowrap, inline-flex and never shrinks', status => {
    const html = badgeFor(status)
    expect(html).toContain('whitespace-nowrap')
    expect(html).toContain('inline-flex')
    expect(html).toContain('shrink-0')
    expect(html).toContain(`>${status}<`)
  })

  it('gives every status the same size, padding and font as "Open"', () => {
    const sizeOf = (status: string) =>
      (badgeFor(status).match(/class="([^"]*)"/)?.[1] ?? '')
        .split(' ')
        .filter(c => !/^(bg|text)-(?!xs)/.test(c))
        .sort()
        .join(' ')
    const open = sizeOf('Open')
    expect(open).toContain('px-2')
    expect(open).toContain('py-0.5')
    expect(open).toContain('text-xs')
    for (const status of STATUSES) expect(sizeOf(status)).toBe(open)
  })

  it('statusBadgeClass falls back to gray for an unknown status, with the same shape', () => {
    expect(statusBadgeClass('Something New')).toContain(STATUS_FALLBACK.badge)
    expect(statusBadgeClass('False Alarm')).toContain(badgeBase)
  })

  it('filter pills never wrap their label either', () => {
    const html = renderToString(
      <FilterPills
        statusPills={buildStatusPills([
          { id: null, label: 'All', count: 9 },
          { id: 5, label: 'False Alarm', count: 2 },
          { id: 2, label: 'In-progress', count: 3 },
        ])}
        priorityPills={[]}
        statusFilter={null}
        priorityFilter={null}
        onStatusChange={noop}
        onPriorityChange={noop}
      />
    )
    const pills = html.match(/<button[^>]*aria-pressed[^>]*>/g) ?? []
    expect(pills).toHaveLength(3)
    for (const pill of pills) expect(pill).toContain('whitespace-nowrap')
  })
})
