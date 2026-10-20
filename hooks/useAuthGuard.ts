'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { fetchMe, getToken, subscribeAuth } from '@/lib/auth'

// Refresh role/department from GET /me once per page load, not on every
// navigation (the guard mounts on every protected page).
let refreshedThisLoad = false

// Client-side route guard. Returns true once a token is present; pages should
// render nothing while it is false. Redirects to '/' (the login page) when
// unauthenticated, including when the token is cleared later (logout / 401).
export function useAuthGuard(): boolean {
  const router = useRouter()
  const token = useSyncExternalStore(subscribeAuth, getToken, () => null)
  const authed = !!token

  useEffect(() => {
    if (!authed) {
      router.replace('/')
      return
    }
    if (!refreshedThisLoad) {
      refreshedThisLoad = true
      fetchMe()
    }
  }, [authed, router])

  return authed
}
