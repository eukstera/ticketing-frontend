const DEEP_LINK_KEY = 'ticketStatusFilter'

interface DeepLinkFilter {
  type: 'status' | 'priority'
  level: string
}

// The dashboard cards stash a one-shot filter in sessionStorage before
// navigating to the ticket lists. Reading is side-effect free so it is safe in
// a lazy useState initializer (StrictMode runs those twice); clear it
// separately, from an effect, once it has been applied.
export function readDeepLinkFilter(): DeepLinkFilter | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(DEEP_LINK_KEY)
    return raw ? (JSON.parse(raw) as DeepLinkFilter) : null
  } catch {
    return null
  }
}

export function clearDeepLinkFilter() {
  try {
    sessionStorage.removeItem(DEEP_LINK_KEY)
  } catch {
    // storage unavailable; nothing to clear
  }
}
