// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/lib/auth'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  user: null as unknown,
  create: vi.fn(),
  save: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.user }))
vi.mock('@/components/Toast', () => ({ toast: mocks.toast }))
vi.mock('@/lib/tickets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/tickets')>()
  return { ...actual, createBlankJobOrder: mocks.create }
})
vi.mock('@/lib/jobOrder', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/jobOrder')>()
  return { ...actual, fetchAndSaveJobOrder: mocks.save }
})

import ActionCell from '@/components/department-tickets/ActionCell'
import StatusCell from '@/components/department-tickets/StatusCell'
import VoidModal from '@/components/VoidModal'
import { usePrintBlankJobOrder } from '@/hooks/usePrintBlankJobOrder'

const staff = { id: 7, department_id: 1, role: { id: 2, name: 'Normal User' } } as AuthUser
const head = { id: 8, department_id: 1, role: { id: 1, name: 'Department Head' } } as AuthUser
const otherStaff = { id: 9, department_id: 2, role: { id: 2, name: 'Normal User' } } as AuthUser
const encoder = { id: 10, department_id: 1, role: { id: 4, name: 'Encoder' } } as AuthUser

const noop = () => {}
const row = (status: string) => ({ id: 5, status, department_id: 1, assigned_activity: null })

function actions(user: AuthUser | null, status: string, over: { downloadingJo?: boolean } = {}) {
  mocks.user = user
  return renderToString(
    <ActionCell
      ticket={row(status)}
      ticketNumber="10-005-2026"
      onTake={noop}
      onAssign={noop}
      onMarkComplete={noop}
      onFalseAlarm={noop}
      onDownloadJo={noop}
      onVoid={noop}
      {...over}
    />
  )
}

describe('ActionCell: Blank rows', () => {
  it('offers Fill in, Reprint JO, Void and False alarm, in that order, and nothing else', () => {
    const html = actions(staff, 'Blank')
    const labels = [
      'Fill in ticket 10-005-2026',
      'Reprint blank job order 10-005-2026',
      'Void ticket 10-005-2026',
      'Mark ticket 10-005-2026 as false alarm',
    ]
    const at = labels.map(l => html.indexOf(l))
    expect(at.every(i => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const gone of ['Take ticket', 'Assign', 'Complete', 'Download JO']) expect(html).not.toContain(gone)
    expect(html).toContain('href="/tickets/5/fill"')
  })

  it('works for heads too, and shows "Printing…" while a reprint runs', () => {
    expect(actions(head, 'Blank')).toContain('Void ticket')
    const busy = actions(staff, 'Blank', { downloadingJo: true })
    expect(busy).toContain('Printing…')
    expect(busy).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Reprint blank job order/)
  })

  it('shows only the dash to encoders, and no actions to other departments', () => {
    expect(actions(encoder, 'Blank')).toContain('—')
    expect(actions(encoder, 'Blank')).not.toContain('Fill in')
    expect(actions(otherStaff, 'Blank')).not.toContain('Fill in')
  })
})

describe('ActionCell: Void rows', () => {
  it('has no actions for anyone', () => {
    for (const user of [staff, head, encoder, otherStaff]) {
      const html = actions(user, 'Void')
      expect(html).toContain('—')
      expect(html).not.toContain('<button')
    }
  })
})

describe('StatusCell for Void', () => {
  it('shows the reason as a title on the pill', () => {
    const ticket = {
      status: 'Void',
      void_activity: { user: 'A B', created_at: '', remarks: 'Printed by mistake' },
    }
    const html = renderToString(<StatusCell ticket={ticket as never} />)
    expect(html).toContain('title="Voided: Printed by mistake"')
  })
})

describe('VoidModal', () => {
  it('renders nothing while closed', () => {
    expect(renderToString(<VoidModal isOpen={false} ticketId={5} onClose={noop} onSubmit={async () => {}} />)).toBe('')
  })
})

describe('usePrintBlankJobOrder', () => {
  let container: HTMLDivElement
  let root: Root | null = null
  let hook: ReturnType<typeof usePrintBlankJobOrder>

  function Probe() {
    const value = usePrintBlankJobOrder()
    useEffect(() => {
      hook = value
    })
    return null
  }

  const created = { result: { ticket: { id: 9, ticket_number: '10-045-2026', status: 'Blank' } } }

  beforeEach(() => {
    mocks.create.mockReset()
    mocks.save.mockReset()
    mocks.toast.mockReset()
    mocks.create.mockResolvedValue(created)
    mocks.save.mockResolvedValue({ ok: true, filename: 'JO.pdf' })
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
      root.render(<Probe />)
    })
  })

  afterEach(() => {
    act(() => root?.unmount())
    root = null
    container.remove()
  })

  it('reserves, downloads the PDF and names the number the API returned', async () => {
    let ok = false
    await act(async () => {
      ok = await hook.print()
    })
    expect(ok).toBe(true)
    expect(mocks.save.mock.calls[0][0]).toBe(9)
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ ticketNumber: '10-045-2026', format: 'pdf' })
    expect(mocks.toast).toHaveBeenCalledWith('Ticket number 10-045-2026 reserved. Blank job order downloaded.')
  })

  it('points to Reprint when the number was reserved but the download failed', async () => {
    mocks.save.mockResolvedValue({ ok: false, kind: 'error', message: 'nope' })
    let ok = false
    await act(async () => {
      ok = await hook.print()
    })
    expect(ok).toBe(true)
    expect(mocks.toast).toHaveBeenCalledWith(
      `Ticket number 10-045-2026 was reserved, but the PDF wasn't downloaded. Use "Reprint JO" on that row.`,
      'error',
      8000
    )
  })

  it('shows the reserve failure and downloads nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.create.mockRejectedValue(new Error('Blank job orders can only be printed by the IT department.'))
    let ok = true
    await act(async () => {
      ok = await hook.print()
    })
    expect(ok).toBe(false)
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.toast.mock.calls[0][1]).toBe('error')
  })

  it('burns only one number on a double click', async () => {
    let release: (v: unknown) => void = () => {}
    mocks.create.mockReturnValue(new Promise(resolve => (release = resolve)))
    await act(async () => {
      const first = hook.print()
      const second = hook.print()
      expect(await second).toBe(false)
      release(created)
      await first
    })
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })
})
