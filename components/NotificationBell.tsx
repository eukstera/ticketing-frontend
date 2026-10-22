'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Bell, BellRing, Volume2, VolumeX } from 'lucide-react'
import { previewAlarm, setAlarmEnabled } from '@/lib/alarm'
import { relativeTime } from '@/lib/format'
import {
  getNotifications,
  getServerNotifications,
  markAllRead,
  markRead,
  subscribeNotifications,
  unreadCount,
} from '@/lib/notifications'
import { useNewTicketAlarm } from '@/hooks/useNewTicketAlarm'

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const BADGE_CAP = 9
const TIME_REFRESH_MS = 30_000

// The click is the user gesture browsers require before audio may play.
function requestNotificationPermission() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Promise.resolve(Notification.requestPermission()).catch(() => {})
    }
  } catch {
    // Notifications unsupported here; the sound and toast still work.
  }
}

/** The NavBar bell for IT staff and Department Heads: unread badge plus a list of new tickets. Also runs the poller. */
export default function NotificationBell() {
  const { eligible, state } = useNewTicketAlarm()
  const items = useSyncExternalStore(subscribeNotifications, getNotifications, getServerNotifications)
  const unread = unreadCount(items)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const headingId = useId()

  // Keep "2m ago" fresh while the panel is open.
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => setNow(Date.now()), TIME_REFRESH_MS)
    return () => clearInterval(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Move focus into the popover so keyboard users land on its content.
  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!eligible) return null

  function toggleOpen() {
    setNow(Date.now())
    setOpen(o => !o)
  }

  function toggleSound() {
    if (state !== 'off') return setAlarmEnabled(false)
    setAlarmEnabled(true)
    void previewAlarm()
    requestNotificationPermission()
  }

  const soundOn = state !== 'off'
  const badge = unread > BADGE_CAP ? `${BADGE_CAP}+` : String(unread)
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, none unread'

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="Notifications"
        className={`relative rounded-lg p-2.5 transition hover:bg-gray-100 ${FOCUS_RING} ${
          unread > 0 ? 'text-blue-600' : 'text-gray-500'
        }`}
      >
        {unread > 0 ? <BellRing size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={headingId}
          tabIndex={-1}
          className="fixed inset-x-4 top-[4.25rem] z-30 rounded-xl border border-gray-200 bg-white shadow-lg focus:outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <h2 id={headingId} className="text-sm font-semibold text-gray-800">
              New tickets
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={soundOn}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition hover:bg-gray-100 ${FOCUS_RING} ${
                  state === 'on-locked' ? 'text-amber-600' : soundOn ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {soundOn ? (
                  <Volume2 size={14} aria-hidden="true" />
                ) : (
                  <VolumeX size={14} aria-hidden="true" />
                )}
                Sound {soundOn ? 'on' : 'off'}
              </button>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className={`rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent ${FOCUS_RING}`}
              >
                Mark all as read
              </button>
            </div>
          </div>

          {state === 'on-locked' && (
            <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              Your browser is blocking sound. Click anywhere on the page to allow it.
            </p>
          )}

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">No new tickets</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {items.map(n => (
                <li key={n.id}>
                  <Link
                    href={`/tickets/${n.id}`}
                    onClick={() => {
                      markRead(n.id)
                      setOpen(false)
                    }}
                    className={`flex items-start gap-3 px-4 py-3 transition hover:bg-gray-50 ${FOCUS_RING} focus-visible:ring-inset ${
                      n.read ? '' : 'bg-blue-50/60'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-blue-600'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm text-gray-800 ${n.read ? '' : 'font-semibold'}`}>
                        {!n.read && <span className="sr-only">Unread: </span>}
                        {n.ticket_number}
                      </span>
                      <span className="line-clamp-2 block text-sm text-gray-600">{n.subject}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {[n.requester, relativeTime(n.created_at, now)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
