import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { AuthUser } from '@/lib/auth'

const state = vi.hoisted(() => ({ user: null as unknown }))
vi.mock('@/hooks/useUser', () => ({ useUser: () => state.user }))

import ActionCell from '@/components/department-tickets/ActionCell'

const staff = { id: 7, department_id: 1, role: { id: 2, name: 'Normal User' } } as AuthUser
const otherStaff = { id: 8, department_id: 3, role: { id: 2, name: 'Normal User' } } as AuthUser
const itHead = { id: 2, department_id: 1, role: { id: 1, name: 'Department Head' } } as AuthUser
const otherHead = { id: 1, department_id: 2, role: { id: 1, name: 'Department Head' } } as AuthUser

const noop = () => {}
// The classes contain "disabled:" variants, so look for the attribute itself.
const DISABLED_ATTR = /\sdisabled=""/
const ticket = (status: string, department_id = 1, assigned = false) => ({
  id: 5,
  status,
  department_id,
  assigned_activity: assigned ? { id: 1, created_at: '', user: 'Ana', user_id: 7 } : null,
})

function render(user: AuthUser | null, t: ReturnType<typeof ticket>, extra: { downloadingJo?: boolean; withHandler?: boolean } = {}) {
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
      onDownloadJo={extra.withHandler === false ? undefined : noop}
      downloadingJo={extra.downloadingJo}
    />
  )
}

beforeEach(() => {
  state.user = null
})

describe('Download JO button visibility', () => {
  it.each([
    ['Open', false],
    ['Overdue', false],
    ['In-progress', true],
    ['Completed', true],
  ])('shows on an IT %s ticket for its department staff', (status, assigned) => {
    const html = render(staff, ticket(status, 1, assigned))
    expect(html).toContain('Download JO')
    expect(html).toContain('Download job order 10-005-2026')
  })

  it('sits next to Take ticket / False alarm on an open ticket (Assign is for heads)', () => {
    const html = render(staff, ticket('Open'))
    for (const label of ['Take ticket', 'False alarm', 'Download JO']) expect(html).toContain(label)
    expect(html).not.toContain('Assign')
  })

  it('sits next to Complete on an in-progress ticket the user took', () => {
    const html = render(staff, ticket('In-progress', 1, true))
    expect(html).toContain('Complete')
    expect(html).toContain('Download JO')
  })

  it('is the only thing left on a completed ticket', () => {
    const html = render(staff, ticket('Completed'))
    expect(html).toContain('Download JO')
    expect(html).not.toContain('—')
  })

  it.each(['Open', 'In-progress', 'Overdue', 'Pending Confirmation', 'Completed'])('shows a Department Head %s tickets of the IT department', status => {
    expect(render(otherHead, ticket(status, 1, status === 'In-progress'))).toContain('Download JO')
    expect(render(itHead, ticket(status, 1, status === 'In-progress'))).toContain('Download JO')
  })

  it('a head who is not in the department gets the job order without Take or Assign', () => {
    const html = render(otherHead, ticket('Open'))
    expect(html).toContain('Download JO')
    expect(html).not.toContain('Take ticket')
  })

  it('is hidden on a False Alarm ticket, for staff and heads alike (the head still gets Reopen)', () => {
    expect(render(staff, ticket('False Alarm'))).not.toContain('Download JO')
    const head = render(otherHead, ticket('False Alarm'))
    expect(head).not.toContain('Download JO')
    expect(head).toContain('Reopen')
  })

  it('is hidden on Engineering tickets (IT form only), even for the Engineering staff or a head', () => {
    const engineeringStaff = { ...staff, department_id: 2 } as AuthUser
    expect(render(engineeringStaff, ticket('Open', 2))).not.toContain('Download JO')
    expect(render(otherHead, ticket('Open', 2))).not.toContain('Download JO')
  })

  it('is hidden from staff of another department and from signed-out visitors', () => {
    expect(render(otherStaff, ticket('Open'))).not.toContain('Download JO')
    expect(render(null, ticket('Open'))).not.toContain('Download JO')
  })

  it('is hidden when the page gives no download handler', () => {
    expect(render(staff, ticket('Open'), { withHandler: false })).not.toContain('Download JO')
  })
})

describe('Download JO button style and state', () => {
  const button = (html: string) => html.match(/<button[^>]*aria-label="Download job order[^"]*"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? ''

  it('is a small, one-line, neutral outline button with an icon', () => {
    const html = button(render(staff, ticket('Open')))
    expect(html).toContain('border-gray-300')
    expect(html).toContain('!text-xs')
    expect(html).toContain('whitespace-nowrap')
    expect(html).toContain('<svg')
    expect(html).not.toMatch(DISABLED_ATTR)
  })

  it('is disabled and says so while the download runs', () => {
    const html = button(render(staff, ticket('Open'), { downloadingJo: true }))
    expect(html).toMatch(DISABLED_ATTR)
    expect(html).toContain('Downloading…')
    expect(html).not.toContain('Download JO')
  })

  it('leaves Take ticket usable while a job order downloads', () => {
    const html = render(staff, ticket('Open'), { downloadingJo: true })
    const take = html.match(/<button[^>]*aria-label="Take ticket[^"]*"[^>]*>/)?.[0] ?? ''
    expect(take).not.toMatch(DISABLED_ATTR)
  })
})
