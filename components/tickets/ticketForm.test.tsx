// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const push = vi.fn()
const replace = vi.fn()
const back = vi.fn()
const toastMock = vi.fn()
const fillBlankTicket = vi.fn()
const createTicket = vi.fn()
let currentUser: Record<string, unknown>

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, back }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('@/components/NavBar', () => ({ default: () => null }))
vi.mock('@/components/Toast', () => ({ toast: (...args: unknown[]) => toastMock(...args) }))
vi.mock('@/hooks/useAuthGuard', () => ({ useAuthGuard: () => true }))
vi.mock('@/hooks/useUser', () => ({ useUser: () => currentUser }))
vi.mock('@/lib/lookups', () => ({
  getPriorities: () =>
    Promise.resolve({ result: { priorities: [{ id: 3, level: 'Urgent', sla_days: 1 }, { id: 4, level: 'Simple', sla_days: 5 }] } }),
  getConcernTypes: () =>
    Promise.resolve({ result: { concern_types: [{ id: 1, label: 'Software' }, { id: 2, label: 'Hardware' }] } }),
}))
vi.mock('@/lib/employees', () => ({
  getEmployees: () =>
    Promise.resolve({
      result: {
        users: [
          { id: 5, department_id: 1, first_name: 'Ana', last_name: 'Cruz', designation: 'Staff' },
          { id: 6, department_id: 1, first_name: 'Ben', last_name: 'Reyes', designation: 'Staff' },
        ],
      },
    }),
}))
vi.mock('@/lib/fillBlank', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/fillBlank')>()),
  fillBlankTicket: (...args: unknown[]) => fillBlankTicket(...args),
}))
vi.mock('@/lib/tickets', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/tickets')>()),
  createTicket: (...args: unknown[]) => createTicket(...args),
}))

import TicketForm from '@/components/tickets/TicketForm'
import { ApiError } from '@/lib/api'

const staffUser = { id: 5, first_name: 'Ana', last_name: 'Cruz', department_id: 1, role: { id: 2, name: 'Staff' } }
const headUser = { id: 9, first_name: 'Hal', last_name: 'Head', department_id: 1, role: { id: 1, name: 'Department Head' } }

let container: HTMLDivElement
let root: Root | null = null

async function render(ui: React.ReactElement) {
  await act(async () => {
    root = createRoot(container)
    root.render(ui)
  })
  await act(async () => {}) // let the lookups resolve
}

const fillMode = <TicketForm mode="fill" ticket={{ id: 7, ticket_number: '10-007-2026' }} />
const $ = <T extends Element = HTMLElement>(sel: string) => container.querySelector<T>(sel)

function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}

function click(el: Element | null) {
  act(() => {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

const byText = (text: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes(text)) ?? null

async function submit() {
  await act(async () => {
    $('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

/** Fills every required field with valid values (Software concern, no devices needed). */
function fillValid(over: { requestedAt?: string } = {}) {
  setValue($<HTMLInputElement>('#f-requestor')!, '  Maria Santos ')
  setValue($<HTMLInputElement>('#f-requested_at')!, over.requestedAt ?? '2020-10-20T09:30')
  click(byText('Software'))
  setValue($<HTMLSelectElement>('#f-name_of_area')!, 'Pharmacy')
  setValue($<HTMLInputElement>('#f-area_supervisor')!, 'Jane Doe')
  setValue($<HTMLTextAreaElement>('#f-remarks')!, 'PC will not boot')
  click(byText('Urgent'))
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  currentUser = staffUser
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container.remove()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('TicketForm in fill mode', () => {
  it('shows the reserved number read-only, and "Save ticket"', async () => {
    await render(fillMode)
    const block = $('[aria-labelledby="f-ticket_number-label"]')!
    expect(block.textContent).toBe('10-007-2026')
    expect(block.tagName).toBe('DIV')
    expect(container.textContent).toContain('Reserved')
    expect($('h1')!.textContent).toBe('Fill in ticket')
    expect(byText('Save ticket')).not.toBeNull()
    expect(byText('Submit Ticket')).toBeNull()
  })

  it('flags an empty requester and date before calling the API', async () => {
    await render(fillMode)
    await submit()
    expect($('#f-requestor-error')!.textContent).toMatch(/requester/i)
    expect($('#f-requested_at-error')).not.toBeNull()
    expect(document.activeElement?.id).toBe('f-requestor')
    expect(fillBlankTicket).not.toHaveBeenCalled()
  })

  it('rejects a requested date in the future', async () => {
    await render(fillMode)
    fillValid({ requestedAt: '2999-01-01T00:00' })
    await submit()
    expect($('#f-requested_at-error')!.textContent).toBe("The requested date can't be in the future.")
    expect(fillBlankTicket).not.toHaveBeenCalled()
  })

  it('requires a device when the concern is Hardware', async () => {
    await render(fillMode)
    fillValid()
    click(byText('Hardware'))
    await submit()
    expect($('#f-devices-error')!.textContent).toBe('Add at least one device.')
    expect(fillBlankTicket).not.toHaveBeenCalled()
  })

  it('rejects a malformed requester email', async () => {
    await render(fillMode)
    fillValid()
    setValue($<HTMLInputElement>('#f-requestor_email')!, 'not-an-email')
    await submit()
    expect($('#f-requestor_email-error')).not.toBeNull()
    expect(fillBlankTicket).not.toHaveBeenCalled()
  })

  it('sends the mapped payload and goes to the ticket', async () => {
    fillBlankTicket.mockResolvedValue({ result: { ticket: { id: 7, ticket_number: '10-007-2026' } } })
    await render(fillMode)
    fillValid()
    await submit()
    expect(fillBlankTicket).toHaveBeenCalledTimes(1)
    const [id, payload] = fillBlankTicket.mock.calls[0]
    expect(id).toBe(7)
    expect(payload).toEqual({
      requested_at: '2020-10-20 09:30',
      requestor: 'Maria Santos',
      area_supervisor: 'Jane Doe',
      type_of_concern: 'Software',
      name_of_area: 'Pharmacy',
      remarks: 'PC will not boot',
      priority: 3,
    })
    expect(toastMock).toHaveBeenCalledWith('Ticket 10-007-2026 saved')
    expect(push).toHaveBeenCalledWith('/tickets/7')
  })

  it('includes the optional email, assignee and Hardware devices when given', async () => {
    fillBlankTicket.mockResolvedValue({ result: { ticket: { id: 7, ticket_number: '10-007-2026' } } })
    await render(fillMode)
    fillValid()
    click(byText('Hardware'))
    setValue($<HTMLInputElement>('#f-devices\\.0\\.type')!, 'Monitor')
    setValue($<HTMLInputElement>('#f-requestor_email')!, 'maria@example.com')
    setValue($<HTMLSelectElement>('#f-assigned_user')!, '5')
    await submit()
    expect(fillBlankTicket.mock.calls[0][1]).toMatchObject({
      type_of_concern: 'Hardware',
      devices: [{ type: 'Monitor', quantity: 1 }],
      requestor_email: 'maria@example.com',
      assigned_user: 5,
    })
  })

  it('shows 422 errors on the matching controls and keeps the input', async () => {
    fillBlankTicket.mockRejectedValue(
      new ApiError(422, 'Invalid', { requestor: ['The requestor is too long.'], requested_at: ['Must be now or earlier.'] })
    )
    await render(fillMode)
    fillValid()
    await submit()
    expect($('#f-requestor-error')!.textContent).toBe('The requestor is too long.')
    expect($('#f-requested_at-error')!.textContent).toBe('Must be now or earlier.')
    expect(document.activeElement?.id).toBe('f-requestor')
    expect($<HTMLInputElement>('#f-requestor')!.value).toBe('  Maria Santos ')
    expect(push).not.toHaveBeenCalled()
  })

  it('redirects to the ticket with a toast on 409 (already filled in)', async () => {
    fillBlankTicket.mockRejectedValue(new ApiError(409, 'Only a blank job order can be filled in.'))
    await render(fillMode)
    fillValid()
    await submit()
    expect(toastMock).toHaveBeenCalledWith('This ticket has already been filled in.', 'error')
    expect(replace).toHaveBeenCalledWith('/tickets/7')
  })

  it('keeps the form and shows a banner on 403', async () => {
    fillBlankTicket.mockRejectedValue(new ApiError(403, 'Only Department Heads can assign tickets.'))
    await render(fillMode)
    fillValid()
    await submit()
    expect($('[role="alert"]')!.textContent).toContain('Only Department Heads can assign tickets.')
    expect(replace).not.toHaveBeenCalled()
  })

  it('offers staff only themselves to assign', async () => {
    currentUser = staffUser
    await render(fillMode)
    const labels = Array.from($<HTMLSelectElement>('#f-assigned_user')!.options).map(o => o.textContent)
    expect(labels).toEqual(['-- Leave unassigned --', 'Ana Cruz'])
  })

  it('offers a Department Head everyone in the department', async () => {
    currentUser = headUser
    await render(fillMode)
    const labels = Array.from($<HTMLSelectElement>('#f-assigned_user')!.options).map(o => o.textContent)
    expect(labels).toEqual(['-- Leave unassigned --', 'Ana Cruz', 'Ben Reyes'])
  })
})

describe('TicketForm in create mode', () => {
  it('is unchanged: no fill-in fields, a required assignee, "Submit Ticket"', async () => {
    await render(<TicketForm mode="create" />)
    expect($('h1')!.textContent).toBe('Create a new support ticket')
    expect($('#f-requestor')).toBeNull()
    expect($('#f-requested_at')).toBeNull()
    expect(byText('Submit Ticket')).not.toBeNull()
    const labels = Array.from($<HTMLSelectElement>('#f-assigned_user')!.options).map(o => o.textContent)
    expect(labels).toEqual(['-- Select Personnel --', 'Ana Cruz', 'Ben Reyes'])
  })

  it('still requires the assignee', async () => {
    await render(<TicketForm mode="create" />)
    await submit()
    expect($('#f-assigned_user-error')).not.toBeNull()
    expect(createTicket).not.toHaveBeenCalled()
  })
})
