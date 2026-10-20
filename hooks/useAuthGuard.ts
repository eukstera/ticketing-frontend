'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, subscribeAuth } from '@/lib/auth'

// Client-side route guard. Returns true once a token is present; pages should
// render nothing while it is false. Redirects to '/' (the login page) when
// unauthenticated, including when the token is cleared later (logout / 401).
export function useAuthGuard(): boolean {
  const router = useRouter()
  const token = useSyncExternalStore(subscribeAuth, getToken, () => null)
  const authed = !!token

  useEffect(() => {
    if (!authed) router.replace('/')
  }, [authed, router])

  return authed
}
