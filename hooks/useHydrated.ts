'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// false on the server and during hydration, true once the client has taken
// over. Use it to keep a form's submit button disabled until the JS handler
// is attached: before that, a native submit would send the fields to the
// server (and with GET, into the URL).
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
