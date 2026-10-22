'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { fetchMe, getToken, subscribeAuth } from '@/lib/auth'
import { currentLocationPath, decideGuard } from '@/lib/authRedirect'
import { useHydrated } from '@/hooks/useHydrated'

// Refresh role/department from GET /me once per page load, not on every
// navigation (the guard mounts on every protected page).
let refreshedThisLoad = false

// Client-side route guard. Returns true once a token is present; pages should
// render nothing while it is false.
//
// While the page hydrates (a refresh), the token reads as null because the
// server snapshot has no localStorage. That is "unknown", not "signed out", so
// the guard waits for `hydrated` before it may redirect; otherwise every
// refresh bounced to login and from there to the dashboard.
// Without a session it goes to login remembering this page (?next=); if the
// token goes away while the page is open (logout, expiry) it goes to plain login.
export function useAuthGuard(): boolean {
  const router = useRouter()
  const hydrated = useHydrated()
  const token = useSyncExternalStore(subscribeAuth, getToken, () => null)
  const authed = !!token
  const hadToken = useRef(false)

  useEffect(() => {
    const decision = decideGuard({
      hydrated,
      hasToken: authed,
      hadToken: hadToken.current,
      path: hydrated ? currentLocationPath() : '',
    })
    if (authed) hadToken.current = true

    if (decision.action === 'redirect') {
      router.replace(decision.to)
    } else if (decision.action === 'allow' && !refreshedThisLoad) {
      refreshedThisLoad = true
      fetchMe()
    }
  }, [hydrated, authed, router])

  return authed
}
