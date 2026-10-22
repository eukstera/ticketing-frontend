import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reopenTicket } from '@/lib/tickets'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const reopened = {
  reason: 'Real after all',
  reopened_by: { id: 1, first_name: 'A', last_name: 'B' },
  reopened_at: '2026-10-22T10:00:00Z',
}

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

describe('reopenTicket', () => {
  it('POSTs the trimmed reason to the ticket reopen route', async () => {
    fetchMock.mockResolvedValue(json({ success: true, message: 'Ticket reopened', result: { reopened } }))
    const res = await reopenTicket(42, '  Real after all  ')
    expect(lastRequest()).toEqual({
      path: '/api/tickets/42/reopen',
      method: 'POST',
      body: { reason: 'Real after all' },
    })
    expect(res.result.reopened.reason).toBe('Real after all')
  })

  it('sends no reason at all when it is blank (the reason is optional)', async () => {
    fetchMock.mockImplementation(async () => json({ success: true, message: 'Ticket reopened', result: { reopened } }))
    await reopenTicket(42)
    expect(lastRequest().body).toEqual({})
    await reopenTicket(42, '   ')
    expect(lastRequest().body).toEqual({})
  })

  it('surfaces the 403 message for anyone who is not a Department Head', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'Only Department Heads can reopen a ticket.' }, 403)
    )
    await expect(reopenTicket(42)).rejects.toMatchObject({
      status: 403,
      message: 'Only Department Heads can reopen a ticket.',
    })
  })

  it.each(['This ticket is already open.', 'Only false-alarm tickets can be reopened.'])(
    'surfaces the 409 message "%s"',
    async message => {
      fetchMock.mockImplementation(async () => json({ success: false, message }, 409))
      await expect(reopenTicket(42)).rejects.toMatchObject({ status: 409, message })
    }
  )

  it('surfaces the 422 reason error', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'Invalid', errors: { reason: ['The reason must be at least 3 characters.'] } }, 422)
    )
    await expect(reopenTicket(42, 'ab')).rejects.toMatchObject({
      status: 422,
      errors: { reason: ['The reason must be at least 3 characters.'] },
    })
  })
})
