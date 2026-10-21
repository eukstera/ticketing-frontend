import { getErrorMessage, isApiError } from '@/lib/api'

/** The route is missing (404) or does not accept this method (405). */
export function isUnavailable(err: unknown): boolean {
  return isApiError(err) && (err.status === 404 || err.status === 405)
}

export const UNAVAILABLE_COPY = "This section isn't available on the server yet."

// Admin screens add one rule on top of the app-wide getErrorMessage: a missing
// admin route (404/405, e.g. the BE hasn't shipped it yet) reads as "section
// not available" rather than the generic copy. Everything else (5xx, network,
// framework text filtering, API-authored 409/422 messages) is getErrorMessage's.
export function safeErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isUnavailable(err)) return UNAVAILABLE_COPY
  return getErrorMessage(err, fallback)
}
