import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeTicketOnBehalf, markTicketComplete, resendConfirmation } from '@/lib/tickets'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { path: new URL(url).pathname, method: init.method, body: JSON.parse(init.body as string) }
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('markTicketComplete (notes are required now)', () => {
  const ok = {
    success: true,
    message: "Ticket completed and sent for the requester's confirmation",
    result: {
      confirmation: {
        state: 'pending',
        completed_at: '2026-10-22T09:00:00Z',
        auto_close_at: '2026-11-21T09:00:00Z',
        requester_email: 'req@example.com',
        mail: { status: 'pending' },
      },
    },
  }

  it('POSTs the trimmed notes to the ticket complete route', async () => {
    fetchMock.mockResolvedValue(json(ok))
    const res = await markTicketComplete(42, '  Replaced the faulty switch.  ')
    expect(lastRequest()).toEqual({
      path: '/api/tickets/42/complete',
      method: 'POST',
      body: { notes: 'Replaced the faulty switch.' },
    })
    expect(res.result.confirmation.mail.status).toBe('pending')
  })

  it('never sends an empty body (the old call is rejected by the API)', async () => {
    fetchMock.mockImplementation(async () => json(ok))
    await markTicketComplete(42, 'Replaced the faulty switch.')
    expect(lastRequest().body).toHaveProperty('notes')
  })

  it('surfaces the 422 notes error', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'Invalid', errors: { notes: ['The notes must be at least 10 characters.'] } }, 422)
    )
    await expect(markTicketComplete(42, 'short')).rejects.toMatchObject({
      status: 422,
      errors: { notes: ['The notes must be at least 10 characters.'] },
    })
  })

  it.each([
    "This ticket is already waiting for the requester's confirmation.",
    "This ticket's status changed, refresh and try again.",
  ])('surfaces the 409 message "%s"', async message => {
    fetchMock.mockImplementation(async () => json({ success: false, message }, 409))
    await expect(markTicketComplete(42, 'Replaced the faulty switch.')).rejects.toMatchObject({ status: 409, message })
  })

  it('surfaces a 403 for someone who may not complete it', async () => {
    fetchMock.mockImplementation(async () => json({ success: false, message: 'Forbidden' }, 403))
    await expect(markTicketComplete(42, 'Replaced the faulty switch.')).rejects.toMatchObject({ status: 403 })
  })
})

describe('closeTicketOnBehalf (Department Heads)', () => {
  it('POSTs the trimmed reason to the confirmation close route', async () => {
    fetchMock.mockResolvedValue(json({ success: true, message: 'Closed', result: { confirmation: { state: 'head_closed' } } }))
    await closeTicketOnBehalf(42, '  Requester has no email.  ')
    expect(lastRequest()).toEqual({
      path: '/api/tickets/42/confirmation/close',
      method: 'POST',
      body: { reason: 'Requester has no email.' },
    })
  })

  it('surfaces the 403, 409 and 422 messages', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: "Only Department Heads can close a ticket on the requester's behalf." }, 403)
    )
    await expect(closeTicketOnBehalf(42, 'No email on file')).rejects.toMatchObject({
      status: 403,
      message: "Only Department Heads can close a ticket on the requester's behalf.",
    })

    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'This ticket is not waiting for confirmation.' }, 409)
    )
    await expect(closeTicketOnBehalf(42, 'No email on file')).rejects.toMatchObject({
      status: 409,
      message: 'This ticket is not waiting for confirmation.',
    })

    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'Invalid', errors: { reason: ['The reason must be at least 5 characters.'] } }, 422)
    )
    await expect(closeTicketOnBehalf(42, 'abc')).rejects.toMatchObject({
      status: 422,
      errors: { reason: ['The reason must be at least 5 characters.'] },
    })
  })
})

describe('resendConfirmation', () => {
  it('POSTs an empty body to the confirmation resend route', async () => {
    fetchMock.mockResolvedValue(json({ success: true, message: 'Queued', result: { confirmation: { state: 'pending' } } }))
    await resendConfirmation(42)
    expect(lastRequest()).toEqual({
      path: '/api/tickets/42/confirmation/resend',
      method: 'POST',
      body: {},
    })
  })

  it.each(['This ticket has no requester email.', 'This ticket is not waiting for confirmation.'])(
    'surfaces the 409 message "%s"',
    async message => {
      fetchMock.mockImplementation(async () => json({ success: false, message }, 409))
      await expect(resendConfirmation(42)).rejects.toMatchObject({ status: 409, message })
    }
  )
})
