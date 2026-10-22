import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/lib/auth'
import { canReceiveTicketAlarm, describeNewTickets, getNewTickets, type NewTicket } from '@/lib/newTickets'

const fetchMock = vi.fn()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function ticket(id: number, subject = 'Printer down'): NewTicket {
  return {
    id,
    ticket_number: `10-00${id}-2026`,
    department_id: 1,
    department: 'IT',
    subject,
    name_of_area: null,
    priority: null,
    requester: null,
    created_at: '2026-10-22T08:00:00+08:00',
  }
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

describe('getNewTickets', () => {
  it('sends no after_id for the first (baseline) poll', async () => {
    fetchMock.mockResolvedValue(json({ success: true, result: { tickets: [], latest_id: 41, has_more: false } }))
    const res = await getNewTickets()
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.pathname).toBe('/api/tickets/new')
    expect(url.searchParams.has('after_id')).toBe(false)
    expect(res).toEqual({ tickets: [], latest_id: 41, has_more: false })
  })

  it('sends after_id=0 (a valid cursor), not nothing', async () => {
    fetchMock.mockResolvedValue(json({ success: true, result: { tickets: [], latest_id: 0, has_more: false } }))
    await getNewTickets(0)
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('after_id')).toBe('0')
  })

  it('returns the tickets and has_more as sent', async () => {
    fetchMock.mockResolvedValue(
      json({ success: true, result: { tickets: [ticket(42), ticket(43)], latest_id: 43, has_more: true } })
    )
    const res = await getNewTickets(41)
    expect(res.tickets.map(t => t.id)).toEqual([42, 43])
    expect(res).toMatchObject({ latest_id: 43, has_more: true })
  })

  it('tolerates a malformed result by keeping the cursor and returning nothing', async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    expect(await getNewTickets(7)).toEqual({ tickets: [], latest_id: 7, has_more: false })
  })

  it('rejects with the API status on 403 and 422', async () => {
    fetchMock.mockImplementation(async () => json({ success: false, message: 'Forbidden' }, 403))
    await expect(getNewTickets()).rejects.toMatchObject({ status: 403 })
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'Invalid', errors: { after_id: ['must be an integer'] } }, 422)
    )
    await expect(getNewTickets(-1)).rejects.toMatchObject({ status: 422 })
  })
})

describe('canReceiveTicketAlarm', () => {
  const user = (over: Partial<AuthUser>) => ({ id: 1, department_id: 2, ...over }) as AuthUser

  it('allows IT department users and Department Heads only', () => {
    expect(canReceiveTicketAlarm(user({ department_id: 1 }))).toBe(true)
    expect(canReceiveTicketAlarm(user({ role: { id: 2, name: 'Department Head' } }))).toBe(true)
    expect(canReceiveTicketAlarm(user({ role: { id: 1, name: 'Normal User' } }))).toBe(false)
    expect(canReceiveTicketAlarm(null)).toBe(false)
    expect(canReceiveTicketAlarm(undefined)).toBe(false)
  })
})

describe('describeNewTickets', () => {
  it('names a single ticket', () => {
    expect(describeNewTickets([ticket(5, 'No network')])).toBe('New ticket 10-005-2026: No network')
  })

  it('clips a long subject for the compact toast, but not by default', () => {
    const long = 'x'.repeat(100)
    expect(describeNewTickets([ticket(5, long)], 20)).toBe(`New ticket 10-005-2026: ${'x'.repeat(19)}…`)
    expect(describeNewTickets([ticket(5, long)])).toContain(long)
  })

  it('copes with a null or blank subject', () => {
    expect(describeNewTickets([{ ...ticket(5), subject: null }])).toBe('New ticket 10-005-2026: (No subject)')
    expect(describeNewTickets([{ ...ticket(5), subject: '  ' }])).toBe('New ticket 10-005-2026: (No subject)')
  })

  it('summarises a batch with the count and the first ticket', () => {
    expect(describeNewTickets([ticket(5, 'No network'), ticket(6), ticket(7)])).toBe(
      '3 new tickets, starting with 10-005-2026: No network'
    )
  })
})
