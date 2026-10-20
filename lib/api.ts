export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://ticketing-api.test/api'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

// For endpoints that return a binary file (e.g. a generated .docx) instead of
// JSON. Mirrors `request`'s auth/header handling but skips the `res.json()`
// parse — that would blow up on a binary body — and hands back the raw
// Response so the caller can read it as a blob and inspect headers like
// Content-Disposition for the filename.
async function requestBlob(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    // Error responses from this API are JSON even when the success response
    // is binary, so try to parse a real message before falling back.
    let errorBody: unknown
    try {
      errorBody = await res.json()
    } catch {
      errorBody = { message: `Server responded with ${res.status}` }
    }
    throw errorBody
  }
  return res
}

export const api = {
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),

  get: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'GET' }),

  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  getBlob: (endpoint: string, accept?: string) =>
    requestBlob(endpoint, {
      method: 'GET',
      headers: accept ? { Accept: accept } : undefined,
    }),
}