import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError } from '@/lib/api'

// api.ts keeps module state (one-time warning), so each test gets a fresh copy.
async function load() {
  vi.resetModules()
  return import('@/lib/api')
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('error helpers', () => {
  it('isApiError is a function that recognises ApiError only', async () => {
    const { isApiError, ApiError } = await load()
    expect(typeof isApiError).toBe('function')
    expect(isApiError(new ApiError(422, 'bad', { email: ['x'] }))).toBe(true)
    expect(isApiError(new Error('plain'))).toBe(false)
    expect(isApiError({ status: 422 })).toBe(false)
    expect(isApiError(null)).toBe(false)
  })

  it('getErrorMessage prefers the API message, then the fallback', async () => {
    const { getErrorMessage, ApiError } = await load()
    expect(getErrorMessage(new ApiError(409, 'Already done'))).toBe('Already done')
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('fallback')
  })

  it('shows the deliberate message of a 503 envelope, and nothing else from 5xx', async () => {
    const { getErrorMessage, ApiError, SERVER_MESSAGE } = await load()
    const msg =
      'PDF generation is not available on this server (missing PHP extension: gd). Ask the system administrator to enable it.'
    expect(getErrorMessage(new ApiError(503, msg))).toBe(msg)
    // no envelope message (proxy / maintenance page)
    expect(getErrorMessage(new ApiError(503, 'Server responded with 503', undefined, false))).toBe(SERVER_MESSAGE)
    // framework text and bare status text
    expect(getErrorMessage(new ApiError(503, 'SQLSTATE[HY000]: General error'))).toBe(SERVER_MESSAGE)
    expect(getErrorMessage(new ApiError(503, 'Service Unavailable'))).toBe(SERVER_MESSAGE)
    // other 5xx keep the generic copy even with a message
    expect(getErrorMessage(new ApiError(500, msg))).toBe(SERVER_MESSAGE)
    expect(getErrorMessage(new ApiError(502, msg))).toBe(SERVER_MESSAGE)
  })

  it('hides framework text for 405, 5xx, network and non-JSON failures', async () => {
    const { getErrorMessage, ApiError, NETWORK_MESSAGE, SERVER_MESSAGE, NOT_AVAILABLE_MESSAGE } = await load()
    const laravel405 = 'The GET method is not supported for route api/admin/users. Supported methods: POST.'
    expect(getErrorMessage(new ApiError(405, laravel405))).toBe(NOT_AVAILABLE_MESSAGE)
    expect(getErrorMessage(new ApiError(500, 'SQLSTATE[42S02]: Base table not found'))).toBe(SERVER_MESSAGE)
    expect(getErrorMessage(new ApiError(503, 'Service Unavailable'))).toBe(SERVER_MESSAGE)
    expect(getErrorMessage(new ApiError(0, 'Network error', undefined, false))).toBe(NETWORK_MESSAGE)
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_MESSAGE)
    // non-JSON body: our placeholder text is never shown
    expect(getErrorMessage(new ApiError(404, 'Server responded with 404', undefined, false))).toBe(
      "We couldn't find what you were looking for."
    )
  })

  it('keeps preferring the API message for 401/403/404/409/422/429', async () => {
    const { getErrorMessage, ApiError } = await load()
    for (const status of [401, 403, 404, 409, 422, 429]) {
      expect(getErrorMessage(new ApiError(status, 'Written for users'))).toBe('Written for users')
    }
  })

  it('does not show framework internals even inside a 4xx', async () => {
    const { getErrorMessage, ApiError } = await load()
    expect(getErrorMessage(new ApiError(404, 'The route api/nope could not be found.'))).toBe(
      "We couldn't find what you were looking for."
    )
    expect(getErrorMessage(new ApiError(404, 'No query results for model [App\Models\Ticket] 9'))).toBe(
      "We couldn't find what you were looking for."
    )
  })

  it('catches namespaced class paths and vendor paths in 4xx messages', async () => {
    const { getErrorMessage, ApiError } = await load()
    const fallback = "We couldn't find what you were looking for."
    expect(getErrorMessage(new ApiError(404, String.raw`Call to App\Models\Ticket failed`))).toBe(fallback)
    expect(getErrorMessage(new ApiError(404, String.raw`in vendor/laravel/framework`))).toBe(fallback)
    expect(getErrorMessage(new ApiError(422, 'The email has already been taken.'))).toBe('The email has already been taken.')
  })

  it('turns a rejected fetch into a status-0 ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const { api, getErrorMessage, NETWORK_MESSAGE } = await load()
    const err = await api.get('/me').catch(e => e)
    expect(err).toMatchObject({ status: 0 })
    expect(getErrorMessage(err)).toBe(NETWORK_MESSAGE)
  })

  it('marks API-written messages as fromServer and placeholders as not', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    const { api } = await load()
    const err = await api.get('/x').catch(e => e)
    expect(err).toMatchObject({ status: 502, fromServer: false })
  })

  it('isAbortError detects AbortError DOMExceptions', async () => {
    const { isAbortError } = await load()
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true)
    expect(isAbortError(new Error('x'))).toBe(false)
  })
})

describe('base URL', () => {
  it('falls back to http://localhost:8000/api and warns only once in dev', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => jsonResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { api } = await load()

    await api.get('/me')
    await api.get('/me')

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/me')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('uses NEXT_PUBLIC_API_URL when set, without warning', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://192.168.117.86:8000/api')
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => jsonResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { api } = await load()

    await api.get('/me')

    expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.117.86:8000/api/me')
    expect(warn).not.toHaveBeenCalled()
  })

  it('fails loudly in production when it is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { api, ApiError } = await load()

    await expect(api.get('/me')).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('request errors', () => {
  it('maps a 422 body to ApiError with field errors', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Invalid', errors: { email: ['Required'] } }, 422)))
    const { api, isApiError } = await load()

    const err = (await api.post('/login', {}).catch(e => e)) as ApiError
    expect(isApiError(err)).toBe(true)
    expect(err.status).toBe(422)
    expect(err.errors).toEqual({ email: ['Required'] })
  })

  it('turns a non-JSON error page into an ApiError, not a SyntaxError', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    const { api, isApiError } = await load()

    const err = (await api.get('/tickets').catch(e => e)) as ApiError
    expect(isApiError(err)).toBe(true)
    expect(err.status).toBe(502)
  })

  it('throws when a 200 response carries success:false', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: false, message: 'Nope' })))
    const { api } = await load()

    await expect(api.get('/x')).rejects.toMatchObject({ message: 'Nope' })
  })
})
