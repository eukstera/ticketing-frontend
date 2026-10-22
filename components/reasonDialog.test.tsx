// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import CloseOnBehalfModal from '@/components/CloseOnBehalfModal'
import CompleteModal from '@/components/CompleteModal'
import { ApiError } from '@/lib/api'

let container: HTMLDivElement
let root: Root | null = null
const onClose = vi.fn()
const onSubmit = vi.fn()

function renderComplete() {
  act(() => {
    root = createRoot(container)
    root.render(<CompleteModal isOpen ticketId={5} ticketNumber="10-005-2026" onClose={onClose} onSubmit={onSubmit} />)
  })
}

const textarea = () => document.querySelector<HTMLTextAreaElement>('textarea')!
const form = () => document.querySelector<HTMLFormElement>('form')!
const submitButton = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!
const alerts = () => Array.from(document.querySelectorAll('[role="alert"]')).map(el => el.textContent)

function type(text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  act(() => {
    setter.call(textarea(), text)
    textarea().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submit() {
  await act(async () => {
    form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

beforeEach(() => {
  onClose.mockReset()
  onSubmit.mockReset()
  onSubmit.mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container.remove()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Complete dialog (completion notes are required)', () => {
  it('will not send notes that are too short, and says why', async () => {
    renderComplete()
    type('too short')
    await submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(alerts().join(' ')).toMatch(/at least 10 characters/)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('will not send empty notes', async () => {
    renderComplete()
    await submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(alerts().join(' ')).toMatch(/Enter the completion notes/)
  })

  it('sends the trimmed notes for the ticket and closes on success', async () => {
    renderComplete()
    type('   Replaced the faulty switch.   ')
    await submit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(5, 'Replaced the faulty switch.')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the live counter', () => {
    renderComplete()
    type('Replaced it.')
    expect(document.body.textContent).toMatch(/12\/2000/)
  })

  it('ignores a second submit while the first is still running (no double completion)', async () => {
    let finish: () => void = () => {}
    onSubmit.mockImplementation(() => new Promise<void>(resolve => (finish = resolve)))
    renderComplete()
    type('Replaced the faulty switch.')
    await submit()
    await submit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(submitButton().disabled).toBe(true)
    expect(submitButton().textContent).toContain('Completing…')

    await act(async () => finish())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the API’s notes error under the box and stays open', async () => {
    onSubmit.mockRejectedValue(new ApiError(422, 'Invalid', { notes: ['The notes must be at least 10 characters.'] }))
    renderComplete()
    type('Replaced the faulty switch.')
    await submit()
    expect(alerts()).toContain('The notes must be at least 10 characters.')
    expect(onClose).not.toHaveBeenCalled()
    expect(submitButton().disabled).toBe(false)
  })

  it('shows a 409 (already waiting for confirmation) in a banner and stays open', async () => {
    onSubmit.mockRejectedValue(new ApiError(409, "This ticket is already waiting for the requester's confirmation."))
    renderComplete()
    type('Replaced the faulty switch.')
    await submit()
    expect(alerts()).toContain("This ticket is already waiting for the requester's confirmation.")
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows friendly copy for a server error, never raw text', async () => {
    onSubmit.mockRejectedValue(new ApiError(500, 'SQLSTATE[HY000] stack trace'))
    renderComplete()
    type('Replaced the faulty switch.')
    await submit()
    expect(alerts().join(' ')).not.toMatch(/SQLSTATE/)
    expect(alerts()).toHaveLength(1)
  })

  it('clears a shown error as soon as the user types again', async () => {
    renderComplete()
    type('short')
    await submit()
    expect(alerts()).toHaveLength(1)
    type('Replaced the faulty switch.')
    expect(alerts()).toHaveLength(0)
  })
})

describe('Close on behalf dialog (reason required, 5..500)', () => {
  function renderClose() {
    act(() => {
      root = createRoot(container)
      root.render(<CloseOnBehalfModal isOpen ticketId={5} ticketNumber="10-005-2026" onClose={onClose} onSubmit={onSubmit} />)
    })
  }

  it('needs at least 5 characters', async () => {
    renderClose()
    type('nope')
    await submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(alerts().join(' ')).toMatch(/at least 5 characters/)
  })

  it('sends the trimmed reason and closes', async () => {
    renderClose()
    type('  Requester has no email address.  ')
    await submit()
    expect(onSubmit).toHaveBeenCalledWith(5, 'Requester has no email address.')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the 403 for a non-head in a banner', async () => {
    onSubmit.mockRejectedValue(new ApiError(403, "Only Department Heads can close a ticket on the requester's behalf."))
    renderClose()
    type('Requester has no email address.')
    await submit()
    expect(alerts()).toContain("Only Department Heads can close a ticket on the requester's behalf.")
    expect(onClose).not.toHaveBeenCalled()
  })
})
