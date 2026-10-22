import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import type { NewTicket, NewTicketsResult } from '@/lib/newTickets'
import {
  MAX_BACKOFF_MS,
  POLL_HIDDEN_MS,
  POLL_VISIBLE_MS,
  createNewTicketWatcher,
  type WatcherDeps,
} from '@/lib/newTicketWatcher'

const t = (id: number): NewTicket => ({
  id,
  ticket_number: `T-${id}`,
  department_id: 1,
  department: 'IT',
  subject: `s${id}`,
  name_of_area: null,
  priority: null,
  requester: null,
  created_at: '',
})
const result = (latest_id: number, ids: number[] = [], has_more = false): NewTicketsResult => ({
  tickets: ids.map(t),
  latest_id,
  has_more,
})

let token = true
let hidden = false
let authListeners: Array<() => void> = []
const fetchNew = vi.fn<WatcherDeps['fetchNew']>()
const onNew = vi.fn<WatcherDeps['onNew']>()

function make() {
  return createNewTicketWatcher({
    fetchNew,
    onNew,
    hasToken: () => token,
    isHidden: () => hidden,
    subscribeAuth: cb => {
      authListeners.push(cb)
      return () => {
        authListeners = authListeners.filter(l => l !== cb)
      }
    },
  })
}

// Lets the awaited fetch inside tick() settle without advancing timers.
const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  token = true
  hidden = false
  authListeners = []
  fetchNew.mockReset()
  onNew.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('new ticket watcher', () => {
  it('records the baseline on the first poll without alarming', async () => {
    fetchNew.mockResolvedValueOnce(result(40))
    const w = make()
    w.start()
    await flush()

    expect(fetchNew).toHaveBeenCalledTimes(1)
    expect(fetchNew.mock.calls[0][0]).toBeUndefined()
    expect(onNew).not.toHaveBeenCalled()
    w.stop()
  })

  it('sends the saved cursor and alarms for tickets newer than the baseline', async () => {
    fetchNew.mockResolvedValueOnce(result(40)).mockResolvedValueOnce(result(42, [41, 42]))
    const w = make()
    w.start()
    await flush()
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS)

    expect(fetchNew.mock.calls[1][0]).toBe(40)
    expect(onNew).toHaveBeenCalledTimes(1)
    expect(onNew.mock.calls[0][0].map(x => x.id)).toEqual([41, 42])

    fetchNew.mockResolvedValueOnce(result(42))
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS)
    expect(fetchNew.mock.calls[2][0]).toBe(42)
    expect(onNew).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('uses after_id=0 (not a baseline poll) when there were no tickets at load', async () => {
    fetchNew.mockResolvedValueOnce(result(0)).mockResolvedValueOnce(result(1, [1]))
    const w = make()
    w.start()
    await flush()
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS)

    expect(fetchNew.mock.calls[1][0]).toBe(0)
    expect(onNew).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('polls again immediately while has_more is true, alarming per page', async () => {
    fetchNew
      .mockResolvedValueOnce(result(40))
      .mockResolvedValueOnce(result(60, [41], true))
      .mockResolvedValueOnce(result(61, [61]))
    const w = make()
    w.start()
    await flush()
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS)
    // Well under the normal interval: only the immediate has_more re-poll can fire.
    await vi.advanceTimersByTimeAsync(100)

    expect(fetchNew).toHaveBeenCalledTimes(3)
    expect(fetchNew.mock.calls[2][0]).toBe(60)
    expect(onNew).toHaveBeenCalledTimes(2)
    w.stop()
  })

  it('keeps polling in a hidden tab, at the slower interval', async () => {
    hidden = true
    fetchNew.mockResolvedValue(result(5))
    const w = make()
    w.start()
    await flush()
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS)
    expect(fetchNew).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(POLL_HIDDEN_MS - POLL_VISIBLE_MS)
    expect(fetchNew).toHaveBeenCalledTimes(2)
    w.stop()
  })

  it('backs off silently on errors and recovers without losing the cursor', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchNew
      .mockResolvedValueOnce(result(40))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockResolvedValueOnce(result(41, [41]))
    const w = make()
    w.start()
    await flush()

    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS) // fails → next in 2x
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS * 2 - 1)
    expect(fetchNew).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1) // fails again → next in 4x
    expect(fetchNew).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS * 4)
    expect(fetchNew).toHaveBeenCalledTimes(4)
    expect(fetchNew.mock.calls[3][0]).toBe(40)
    expect(onNew).toHaveBeenCalledTimes(1)
    expect(spy).not.toHaveBeenCalled()
    w.stop()
  })

  it('caps the backoff', async () => {
    fetchNew.mockResolvedValueOnce(result(1)).mockRejectedValue(new TypeError('offline'))
    const w = make()
    w.start()
    await flush()
    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS * 20)
    const calls = fetchNew.mock.calls.length
    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS)
    expect(fetchNew.mock.calls.length).toBe(calls + 1)
    w.stop()
  })

  it('stops for good on 403', async () => {
    fetchNew.mockRejectedValue(new ApiError(403, 'Forbidden'))
    const w = make()
    w.start()
    await flush()
    expect(w.isRunning()).toBe(false)
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS * 10)
    expect(fetchNew).toHaveBeenCalledTimes(1)
  })

  it('stops on logout and starts over with a fresh baseline (no alarm for the new session)', async () => {
    fetchNew.mockResolvedValue(result(40))
    const w = make()
    w.start()
    await flush()

    token = false
    authListeners.forEach(l => l())
    expect(w.isRunning()).toBe(false)
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS * 3)
    expect(fetchNew).toHaveBeenCalledTimes(1)

    token = true
    fetchNew.mockResolvedValueOnce(result(90))
    w.start()
    await flush()
    expect(fetchNew.mock.calls[1][0]).toBeUndefined()
    expect(onNew).not.toHaveBeenCalled()
    w.stop()
  })

  it('start is idempotent, so a remounted NavBar does not reset the baseline or double-poll', async () => {
    fetchNew.mockResolvedValue(result(40))
    const w = make()
    w.start()
    w.start()
    await flush()
    expect(fetchNew).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('does not poll without a token', async () => {
    token = false
    const w = make()
    w.start()
    await flush()
    expect(fetchNew).not.toHaveBeenCalled()
    expect(w.isRunning()).toBe(false)
  })

  it('a throwing onNew does not stop the polling', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    onNew.mockImplementation(() => {
      throw new Error('audio blew up')
    })
    fetchNew.mockResolvedValueOnce(result(1)).mockResolvedValueOnce(result(2, [2])).mockResolvedValue(result(2))
    const w = make()
    w.start()
    await flush()
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS * 2)
    expect(fetchNew).toHaveBeenCalledTimes(3)
    w.stop()
  })
})
