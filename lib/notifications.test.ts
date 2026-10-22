// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewTicket } from '@/lib/newTickets'

const STORAGE_KEY = 'ticket-notifications'

const ticket = (id: number, over: Partial<NewTicket> = {}): NewTicket => ({
  id,
  ticket_number: `10-${String(id).padStart(3, '0')}-2026`,
  department_id: 1,
  department: 'IT',
  subject: `Subject ${id}`,
  name_of_area: null,
  priority: null,
  requester: 'Ana Reyes',
  created_at: '2026-10-22T08:00:00+08:00',
  ...over,
})

// The store is a module singleton, so each test gets a fresh copy.
async function load() {
  vi.resetModules()
  return import('@/lib/notifications')
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('notification store', () => {
  it('starts empty', async () => {
    const n = await load()
    expect(n.getNotifications()).toEqual([])
    expect(n.unreadCount(n.getNotifications())).toBe(0)
  })

  it('lists the newest ticket first even though the API sends oldest first', async () => {
    const n = await load()
    n.addNotifications([ticket(5), ticket(6), ticket(7)])
    expect(n.getNotifications().map(x => x.id)).toEqual([7, 6, 5])
    n.addNotifications([ticket(8)])
    expect(n.getNotifications().map(x => x.id)).toEqual([8, 7, 6, 5])
    expect(n.unreadCount(n.getNotifications())).toBe(4)
  })

  it('keeps ticket number, subject, requester and creation time; fills a missing subject', async () => {
    const n = await load()
    n.addNotifications([ticket(5, { subject: null, requester: null })])
    expect(n.getNotifications()[0]).toEqual({
      id: 5,
      ticket_number: '10-005-2026',
      subject: '(No subject)',
      requester: null,
      created_at: '2026-10-22T08:00:00+08:00',
      read: false,
    })
  })

  it('ignores tickets it already has and does not notify for them', async () => {
    const n = await load()
    n.addNotifications([ticket(5)])
    n.markRead(5)
    const listener = vi.fn()
    n.subscribeNotifications(listener)
    n.addNotifications([ticket(5)])
    expect(listener).not.toHaveBeenCalled()
    expect(n.getNotifications()).toHaveLength(1)
    expect(n.getNotifications()[0].read).toBe(true)
  })

  it('caps the list, dropping the oldest', async () => {
    const n = await load()
    n.addNotifications(Array.from({ length: n.MAX_NOTIFICATIONS + 5 }, (_, i) => ticket(i + 1)))
    const ids = n.getNotifications().map(x => x.id)
    expect(ids).toHaveLength(n.MAX_NOTIFICATIONS)
    expect(ids[0]).toBe(n.MAX_NOTIFICATIONS + 5)
    expect(ids).not.toContain(1)
  })

  it('marks one as read, then all as read', async () => {
    const n = await load()
    n.addNotifications([ticket(1), ticket(2), ticket(3)])
    n.markRead(2)
    expect(n.getNotifications().find(x => x.id === 2)?.read).toBe(true)
    expect(n.unreadCount(n.getNotifications())).toBe(2)
    n.markAllRead()
    expect(n.unreadCount(n.getNotifications())).toBe(0)
    expect(n.getNotifications()).toHaveLength(3)
  })

  it('returns the same snapshot until something changes, and notifies subscribers once per change', async () => {
    const n = await load()
    n.addNotifications([ticket(1)])
    const before = n.getNotifications()
    const listener = vi.fn()
    const unsubscribe = n.subscribeNotifications(listener)

    n.markRead(999) // unknown id
    n.markAllRead()
    n.markAllRead() // second one has nothing to do
    expect(listener).toHaveBeenCalledTimes(1)
    expect(n.getNotifications()).not.toBe(before)

    unsubscribe()
    n.addNotifications([ticket(2)])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('clears everything (logout)', async () => {
    const n = await load()
    n.addNotifications([ticket(1), ticket(2)])
    n.clearNotifications()
    expect(n.getNotifications()).toEqual([])
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual([])
  })
})

describe('sessionStorage mirror', () => {
  it('keeps unread state across a reload', async () => {
    let n = await load()
    n.addNotifications([ticket(1), ticket(2)])
    n.markRead(1)

    n = await load()
    expect(n.getNotifications().map(x => [x.id, x.read])).toEqual([
      [2, false],
      [1, true],
    ])
  })

  it('ignores junk or malformed stored data', async () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json')
    expect((await load()).getNotifications()).toEqual([])

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }))
    expect((await load()).getNotifications()).toEqual([])

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'x' }, null, 5]))
    expect((await load()).getNotifications()).toEqual([])
  })

  it('still works when storage throws (private mode / blocked site data)', async () => {
    const n = await load()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => n.addNotifications([ticket(1)])).not.toThrow()
    expect(n.getNotifications()).toHaveLength(1)

    const fresh = await load()
    expect(fresh.getNotifications()).toEqual([])
  })
})
