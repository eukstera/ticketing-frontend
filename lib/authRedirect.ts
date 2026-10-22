// Pure helpers for where the auth guard sends people: to login (remembering the
// page they wanted) and back again after signing in. No React, no side effects.

export const LOGIN_PATH = '/'
export const DEFAULT_LANDING = '/dashboard'
const NEXT_PARAM = 'next'
const MAX_PATH_LENGTH = 2000
// Only used to parse; it never leaves this file.
const PARSE_BASE = 'http://return-path.invalid'

/**
 * A "next" value is only honoured when it is a same-origin path: it must start
 * with a single "/", so "//evil.com", "/\evil.com", "https://evil.com" and
 * "javascript:..." are all refused. Returns path + query (the hash is dropped),
 * or null when it isn't safe or points at login itself.
 */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_PATH_LENGTH) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null
  // Backslashes and control characters are treated as slashes or stripped by some browsers.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null

  let url: URL
  try {
    url = new URL(raw, PARSE_BASE)
  } catch {
    return null
  }
  if (url.origin !== PARSE_BASE) return null
  if (url.pathname === LOGIN_PATH) return null
  return `${url.pathname}${url.search}`
}

/** "/" for no return path, otherwise "/?next=<encoded path>". */
export function loginUrl(returnTo?: string | null): string {
  const next = safeNextPath(returnTo)
  return next ? `${LOGIN_PATH}?${NEXT_PARAM}=${encodeURIComponent(next)}` : LOGIN_PATH
}

/** Where to go after signing in: the ?next= page when it is safe, else the dashboard. `search` is location.search. */
export function postLoginPath(search: string): string {
  return safeNextPath(new URLSearchParams(search).get(NEXT_PARAM)) ?? DEFAULT_LANDING
}

/** The page the browser is on, path + query. Client only. */
export function currentLocationPath(): string {
  return `${window.location.pathname}${window.location.search}`
}

export type GuardDecision = { action: 'wait' } | { action: 'allow' } | { action: 'redirect'; to: string }

/**
 * What a protected page should do.
 * - hydrated=false: the stored token can't be read yet (server snapshot), so
 *   an empty token means "unknown", not "signed out". Wait.
 * - a token: leave the URL alone.
 * - no token and none seen since the page opened: a cold load / refresh with no
 *   session, so go to login and remember the page.
 * - the token disappeared while the page was open (logout, expired): plain
 *   login, so signing in again isn't thrown back to a page the user just left.
 */
export function decideGuard(input: {
  hydrated: boolean
  hasToken: boolean
  hadToken: boolean
  path: string
}): GuardDecision {
  if (!input.hydrated) return { action: 'wait' }
  if (input.hasToken) return { action: 'allow' }
  return { action: 'redirect', to: input.hadToken ? LOGIN_PATH : loginUrl(input.path) }
}
