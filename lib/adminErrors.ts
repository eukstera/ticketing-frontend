import { isApiError } from '@/lib/api'

/** The route is missing (404) or does not accept this method (405). */
export function isUnavailable(err: unknown): boolean {
  return isApiError(err) && (err.status === 404 || err.status === 405)
}

export const UNAVAILABLE_COPY = "This section isn't available on the server yet."

// Admin screens show our own copy for server-side failures instead of whatever
// the server said (Laravel's "The GET method is not supported for route ..."
// and stack-trace messages are noise to an admin). 4xx messages the API wrote
// on purpose (409 "N active users hold this role", 422 validation) pass through.
// A 401 never gets here for long: api.ts clears the session and redirects.
export function safeErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!isApiError(err)) return fallback
  if (isUnavailable(err)) return UNAVAILABLE_COPY
  if (err.status === 403) return "You don't have permission to do that."
  if (err.status >= 500) return 'The server had a problem. Try again in a moment.'
  // status 0 is our own client-side copy (e.g. "API URL is not configured.")
  return err.message || fallback
}
