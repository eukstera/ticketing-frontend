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
