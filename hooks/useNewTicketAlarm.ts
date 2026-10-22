'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { toast } from '@/components/Toast'
import { getAlarmState, playAlarm, subscribeAlarm, unlockAudio, type AlarmState } from '@/lib/alarm'
import { getToken, subscribeAuth } from '@/lib/auth'
import { addNotifications, clearNotifications } from '@/lib/notifications'
import {
  canReceiveTicketAlarm,
  describeNewTickets,
  getNewTickets,
  type NewTicket,
} from '@/lib/newTickets'
import { createNewTicketWatcher } from '@/lib/newTicketWatcher'
import { useUser } from '@/hooks/useUser'

const TOAST_MS = 6_000
const TOAST_SUBJECT_MAX = 60

// Every new ticket goes on the bell's list. The ding plays once per poll when
// sound is on; the OS notification only when the page isn't in front of the
// user, since the toast already covers that case.
function announce(tickets: NewTicket[]) {
  addNotifications(tickets)
  playAlarm()
  toast(describeNewTickets(tickets, TOAST_SUBJECT_MAX), 'info', TOAST_MS)

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible' && document.hasFocus()) return
  try {
    const n = new Notification(tickets.length === 1 ? 'New ticket' : `${tickets.length} new tickets`, {
      body: describeNewTickets(tickets),
      tag: 'new-ticket',
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}

// One watcher for the whole app: every page mounts its own NavBar, and a
// per-component poller would lose its baseline on each navigation.
let watcher: ReturnType<typeof createNewTicketWatcher> | null = null

function getWatcher() {
  watcher ??= createNewTicketWatcher({
    fetchNew: getNewTickets,
    onNew: announce,
    hasToken: () => !!getToken(),
    isHidden: () => document.visibilityState === 'hidden',
    subscribeAuth,
  })
  return watcher
}

/** Runs the new-ticket poller for eligible users and exposes the sound state for the NavBar bell. */
export function useNewTicketAlarm(): { eligible: boolean; state: AlarmState } {
  const user = useUser()
  const eligible = canReceiveTicketAlarm(user)
  const state = useSyncExternalStore(subscribeAlarm, getAlarmState, () => 'on' as AlarmState)

  // No cleanup on unmount: navigating remounts the NavBar. The watcher stops
  // itself on logout or a 403.
  useEffect(() => {
    if (eligible && getToken()) getWatcher().start()
    else watcher?.stop()
  }, [eligible])

  // The next person to sign in on this browser must not see this list.
  useEffect(() => {
    if (!eligible) return
    return subscribeAuth(() => {
      if (!getToken()) clearNotifications()
    })
  }, [eligible])

  // Browsers only let audio play after a gesture; any first click or keypress
  // unlocks it, so the alarm works after a reload without touching the toggle.
  useEffect(() => {
    if (!eligible) return
    const unlock = () => void unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [eligible])

  return { eligible, state }
}
