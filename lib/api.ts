import { getToken, removeToken } from '@/lib/auth'

const DEV_FALLBACK_URL = 'http://ticketing-api.test/api'
const IS_DEV = process.env.NODE_ENV === 'development'

// Resolved per request (not at module load) so a missing prod env var surfaces
// as a request error instead of breaking the build's prerender step.
function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (url) return url
  if (process.env.NODE_ENV === 'production') {
    console.error('NEXT_PUBLIC_API_URL is not set; refusing to call the API.')
    throw new ApiError(0, 'API URL is not configured.')
  }
  return DEV_FALLBACK_URL
}

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly success = false as const
  readonly status: number
  readonly errors?: FieldErrors

  constructor(status: number, message: string, errors?: FieldErrors) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  403: "You don't have permission to do that.",
  409: "This ticket's status changed, refresh and try again.",
  429: 'Too many attempts, wait a minute and try again.',
}

/**
 * Friendly text for any thrown value. Prefers the server's message, then a
 * status-based message, then the caller's fallback.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof ApiError) {
    return err.message || STATUS_MESSAGES[err.status] || fallback
  }
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
  return new ApiError(
    res.status,
    b.message || `Server responded with ${res.status}`,
    b.errors
  )
}

// An expired/revoked token (BE tokens last 7 days). Login itself legitimately
// returns 401 for bad credentials, so it is exempt.
function handleUnauthorized(endpoint: string) {
  if (endpoint === '/login') return
  if (typeof window === 'undefined') return
  removeToken()
  window.location.replace('/')
}

async function send(endpoint: string, options: RequestInit): Promise<Response> {
  const res = await fetch(`${getBaseUrl()}${endpoint}`, options)
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
  filename: string
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
  if (!filename) {
    throw new ApiError(res.status, 'Server did not provide a filename for the download.')
  }
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
