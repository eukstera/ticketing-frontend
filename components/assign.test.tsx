import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { AuthUser } from '@/lib/auth'
import { canAssign } from '@/lib/assign'

const state = vi.hoisted(() => ({ user: null as unknown }))
vi.mock('@/hooks/useUser', () => ({ useUser: () => state.user }))

import ActionCell from '@/components/department-tickets/ActionCell'

const head = { id: 1, department_id: 1, role: { id: 1, name: 'Department Head' } } as AuthUser
const otherHead = { id: 2, department_id: 2, role: { id: 1, name: 'Department Head' } } as AuthUser
const staff = { id: 7, department_id: 1, role: { id: 2, name: 'Normal User' } } as AuthUser

const noop = () => {}
const ticket = (status = 'Open') => ({ id: 5, status, department_id: 1, assigned_activity: null })

function actions(user: AuthUser | null, status = 'Open') {
  state.user = user
  return renderToString(
    <ActionCell ticket={ticket(status)} ticketNumber="10-005-2026" onTake={noop} onAssign={noop} />
  )
}

beforeEach(() => {
  state.user = null
})

describe('canAssign', () => {
  it('is true only for a Department Head of the handling department', () => {
    expect(canAssign(ticket(), head)).toBe(true)
    expect(canAssign(ticket(), staff)).toBe(false)
    expect(canAssign(ticket(), otherHead)).toBe(false)
    expect(canAssign(ticket(), null)).toBe(false)
    expect(canAssign(ticket(), undefined)).toBe(false)
  })
})

describe('ActionCell: Assign button', () => {
  it('shows for the handling department head, next to Take ticket', () => {
    const html = actions(head)
    expect(html).toContain('Assign ticket 10-005-2026')
    expect(html).toContain('Take ticket')
  })

  it('is hidden from staff of the handling department, who can still take', () => {
    const html = actions(staff)
    expect(html).not.toContain('Assign')
    expect(html).toContain('Take ticket')
  })

  it('is hidden from a head of another department and from signed-out visitors', () => {
    expect(actions(otherHead)).not.toContain('Assign')
    expect(actions(null)).not.toContain('Assign')
  })
})

describe('ActionCell: Complete button', () => {
  const taken = { id: 5, status: 'In-progress', department_id: 1, assigned_activity: { id: 1, created_at: '', user: 'Ana', user_id: 7 } }
  const render = (user: AuthUser | null, t: typeof taken | ReturnType<typeof ticket> = taken) => {
    state.user = user
    return renderToString(<ActionCell ticket={t} ticketNumber="10-005-2026" onMarkComplete={noop} />)
  }

  it('is shown to the assignee only', () => {
    expect(render(staff)).toContain('Complete ticket 10-005-2026')
  })

  it('is hidden from other staff of the department, heads who did not take it and other departments', () => {
    expect(render({ ...staff, id: 8 } as AuthUser)).not.toContain('Complete ticket')
    expect(render(head)).not.toContain('Complete ticket')
    expect(render(otherHead)).not.toContain('Complete ticket')
  })

  it('is shown to a head who took the ticket', () => {
    expect(render({ ...head, id: 7 } as AuthUser)).toContain('Complete ticket')
  })

  it('is hidden on an unassigned ticket', () => {
    expect(render(staff, ticket('In-progress'))).not.toContain('Complete ticket')
  })
})
