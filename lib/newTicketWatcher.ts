import { isAbortError, isApiError } from '@/lib/api'
import type { NewTicket, NewTicketsResult } from '@/lib/newTickets'

export const POLL_VISIBLE_MS = 20_000
// A hidden tab is where the alarm matters most, so it keeps polling; browsers
// throttle its timers anyway, so ask for no more than they would allow.
export const POLL_HIDDEN_MS = 30_000
export const MAX_BACKOFF_MS = 5 * 60_000
// has_more re-polls immediately, but never loops forever on a misbehaving API.
const MAX_CHAIN = 5

export interface WatcherDeps {
  fetchNew: (afterId: number | undefined, signal: AbortSignal) => Promise<NewTicketsResult>
  onNew: (tickets: NewTicket[]) => void
  hasToken: () => boolean
  isHidden: () => boolean
  /** Subscribe to login/logout; returns an unsubscribe. */
  subscribeAuth: (onChange: () => void) => () => void
}

/**
 * Polls for new tickets. The first poll sends no after_id and only records the
 * baseline (no alarm for tickets that existed at load). Errors are silent and
 * back off; a 401/403 stops it for good. start() is idempotent, so a page that
 * remounts its NavBar keeps the same baseline.
 */
export function createNewTicketWatcher(deps: WatcherDeps) {
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null
  let unsubscribeAuth: (() => void) | null = null
  let lastId: number | null = null
  let failures = 0
  let chain = 0

  function schedule(ms: number) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(tick, ms)
  }

  function stop() {
    running = false
    if (timer) clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
    unsubscribeAuth?.()
    unsubscribeAuth = null
    // The next start (after login) records a fresh baseline.
    lastId = null
    failures = 0
    chain = 0
  }

  async function tick() {
    if (!running) return
    if (!deps.hasToken()) return stop()

    const current = new AbortController()
    controller = current
    try {
      const res = await deps.fetchNew(lastId ?? undefined, current.signal)
      if (!running || current.signal.aborted) return

      failures = 0
      const isBaseline = lastId === null
      // Never move the cursor backwards.
      lastId = Math.max(lastId ?? 0, res.latest_id)

      if (!isBaseline && res.tickets.length > 0) {
        try {
          deps.onNew(res.tickets)
        } catch (err) {
          console.error(err)
        }
      }

      if (res.has_more && ++chain < MAX_CHAIN) return schedule(0)
      chain = 0
      schedule(deps.isHidden() ? POLL_HIDDEN_MS : POLL_VISIBLE_MS)
    } catch (err) {
      if (!running || isAbortError(err)) return
      // Not allowed (403) or signed out (401, which api.ts already handles): no point retrying.
      if (isApiError(err) && (err.status === 401 || err.status === 403)) return stop()
      failures++
      chain = 0
      schedule(Math.min(POLL_VISIBLE_MS * 2 ** failures, MAX_BACKOFF_MS))
    }
  }

  function start() {
    if (running) return
    running = true
    unsubscribeAuth = deps.subscribeAuth(() => {
      if (!deps.hasToken()) stop()
    })
    void tick()
  }

  return { start, stop, isRunning: () => running }
}
