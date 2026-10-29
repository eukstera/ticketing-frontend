import { getToken, removeToken } from '@/lib/auth'
import { currentLocationPath, loginUrl } from '@/lib/authRedirect'

// `php artisan serve` default. For another device on the LAN set
// NEXT_PUBLIC_API_URL in .env.local (see README).
const DEV_FALLBACK_URL = 'http://localhost:8000/api'
let warnedMissingUrl = false
const IS_DEV = process.env.NODE_ENV === 'development'

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i

/**
 * Lets the app work with or without SSL. A protocol-relative URL
 * (`//host/api`) takes the page's scheme. An http URL for a non-loopback host
 * is upgraded when the page itself is https, since browsers block that as
 * mixed content. Everything else is returned unchanged.
 */
export function matchPageScheme(url: string, pageProtocol?: string, pageHostname?: string): string {
  const protocol = pageProtocol ?? (typeof window !== 'undefined' ? window.location.protocol : undefined)
  const hostname = pageHostname ?? (typeof window !== 'undefined' ? window.location.hostname : undefined)
  // A phone or another PC opening the app by LAN address cannot reach the
  // API at "localhost" (that is the device itself), so follow the page's host.
  if (hostname && !LOOPBACK.test(hostname)) {
    try {
      const parsed = new URL(url, `${protocol ?? 'http:'}//${hostname}`)
      if (LOOPBACK.test(parsed.hostname)) {
        parsed.hostname = hostname
        url = parsed.href
      }
    } catch {
      // not a parseable URL: leave it for fetch to report
    }
  }
  if (url.startsWith('//')) return `${protocol ?? 'http:'}${url}`
  if (protocol === 'https:' && url.startsWith('http://')) {
    try {
      if (!LOOPBACK.test(new URL(url).hostname)) return `https://${url.slice('http://'.length)}`
    } catch {
      // not a parseable URL: leave it for fetch to report
    }
  }
  return url
}

// Resolved per request (not at module load) so a missing prod env var surfaces
// as a request error instead of breaking the build's prerender step.
function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (url) return matchPageScheme(url)
  if (process.env.NODE_ENV === 'production') {
    console.error('NEXT_PUBLIC_API_URL is not set; refusing to call the API.')
    throw new ApiError(0, 'API URL is not configured.', undefined, false)
  }
  if (!warnedMissingUrl) {
    warnedMissingUrl = true
    console.warn(`NEXT_PUBLIC_API_URL is not set; using ${DEV_FALLBACK_URL}. See .env.local.example.`)
  }
  return DEV_FALLBACK_URL
}

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly success = false as const
  readonly status: number
  readonly errors?: FieldErrors
  /**
   * True when `message` was written by the API for the user. False for our own
   * placeholder text (non-JSON body, network failure) so it is never shown.
   */
  readonly fromServer: boolean

  constructor(status: number, message: string, errors?: FieldErrors, fromServer = true) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.fromServer = fromServer
  }
}

export const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again."
export const SERVER_MESSAGE = 'Something went wrong on the server. Please try again.'
export const NOT_AVAILABLE_MESSAGE = "This feature isn't available yet."

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "This ticket's status changed, refresh and try again.",
  429: 'Too many attempts, wait a minute and try again.',
}

// Laravel/PHP internals that must never reach a user, even inside a 4xx.
const FRAMEWORK_MESSAGE =
  /method is not supported|could not be found|no query results|sqlstate|app\\|illuminate|vendor[\\/]|stack trace|class "/i

/**
 * Friendly text for any thrown value. 405, 5xx, network failures and non-JSON
 * bodies always get our own copy (the server text there is framework output).
 * The one exception is a 503 whose JSON envelope carries a deliberate message
 * (e.g. a missing PHP extension for PDF/Excel export): that text is shown, unless
 * it is framework output or just the bare "Service Unavailable" status text.
 * For other statuses the API's own message is preferred, unless it looks like
 * framework output; then a status-based message, then the caller's fallback.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return NETWORK_MESSAGE
    if (err.status === 405) return NOT_AVAILABLE_MESSAGE
    if (
      err.status === 503 &&
      err.fromServer &&
      err.message &&
      !FRAMEWORK_MESSAGE.test(err.message) &&
      !/^service unavailable\.?$/i.test(err.message.trim())
    ) {
      return err.message
    }
    if (err.status >= 500) return SERVER_MESSAGE
    if (err.fromServer && err.message && !FRAMEWORK_MESSAGE.test(err.message)) return err.message
    return STATUS_MESSAGES[err.status] ?? fallback
  }
  // A fetch() that never got a response rejects with a TypeError.
  if (err instanceof TypeError) return NETWORK_MESSAGE
  return fallback
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function baseHeaders(): Record<string, string> {
  const token = getToken()
  return {
    ...(IS_DEV ? { 'ngrok-skip-browser-warning': 'true' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// Reads the body without assuming JSON: 204s, empty bodies and 502 HTML pages
// all come back as null instead of throwing a SyntaxError.
async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function toApiError(res: Response, body: unknown): ApiError {
  const b = (body && typeof body === 'object' ? body : {}) as {
    message?: string
    errors?: FieldErrors
  }
  const fromServer = typeof b.message === 'string' && b.message !== ''
  return new ApiError(
    res.status,
    fromServer ? (b.message as string) : `Server responded with ${res.status}`,
    b.errors,
    fromServer
  )
}

// An expired/revoked token (BE tokens last 7 days). Login itself legitimately
// returns 401 for bad credentials, so it is exempt.
function handleUnauthorized(endpoint: string) {
  if (endpoint === '/login') return
  if (typeof window === 'undefined') return
  removeToken()
  // Keep the page, so signing in again returns to it.
  window.location.replace(loginUrl(currentLocationPath()))
}

async function send(endpoint: string, options: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(`${getBaseUrl()}${endpoint}`, options)
  } catch (err) {
    // No response at all (offline, DNS, CORS, refused). Aborts pass through.
    if (err instanceof TypeError) throw new ApiError(0, 'Network error', undefined, false)
    throw err
  }
  if (res.status === 401) handleUnauthorized(endpoint)
  return res
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await send(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...baseHeaders(),
      ...(options.headers || {}),
    },
  })
  const data = await readBody(res)
  if (!res.ok) throw toApiError(res, data)
  if (data && typeof data === 'object' && (data as { success?: unknown }).success === false) {
    throw toApiError(res, data)
  }
  return data as T
}

export interface BlobResult {
  blob: Blob
  /** null when the server (or a proxy) did not expose Content-Disposition. */
  filename: string | null
}

// "attachment; filename*=UTF-8''My%20Report.docx" or `filename="My Report.docx"`
function parseContentDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = /filename\s*=\s*("([^"]+)"|[^;]+)/i.exec(header)
  return plain ? (plain[2] ?? plain[1]).trim() : null
}

// For endpoints that return a binary file (e.g. a generated .docx). Error
// responses are still JSON, so they are parsed into an ApiError.
async function requestBlob(
  endpoint: string,
  options: RequestInit = {}
): Promise<BlobResult> {
  const res = await send(endpoint, {
    ...options,
    headers: { ...baseHeaders(), ...(options.headers || {}) },
  })
  if (!res.ok) throw toApiError(res, await readBody(res))

  const filename = parseContentDisposition(res.headers.get('Content-Disposition'))
  return { blob: await res.blob(), filename }
}

type Opts = { signal?: AbortSignal }

export const api = {
  post: <T>(endpoint: string, body: unknown, opts?: Opts) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body), signal: opts?.signal }),

  get: <T>(endpoint: string, opts?: Opts) =>
    request<T>(endpoint, { method: 'GET', signal: opts?.signal }),

  patch: <T>(endpoint: string, body: unknown, opts?: Opts) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body), signal: opts?.signal }),

  delete: <T>(endpoint: string, opts?: Opts) =>
    request<T>(endpoint, { method: 'DELETE', signal: opts?.signal }),

  getBlob: (endpoint: string, accept?: string, opts?: Opts) =>
    requestBlob(endpoint, {
      method: 'GET',
      headers: accept ? { Accept: accept } : undefined,
      signal: opts?.signal,
    }),
}
