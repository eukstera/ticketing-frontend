'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { AuthUser, getUserRaw, subscribeAuth } from '@/lib/auth'

// Hydration-safe read of the stored user: the server snapshot is null, so the
// first client render matches the server and the real value arrives right after.
export function useUser(): AuthUser | null {
  const raw = useSyncExternalStore(subscribeAuth, getUserRaw, () => null)

  return useMemo(() => {
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  }, [raw])
}
