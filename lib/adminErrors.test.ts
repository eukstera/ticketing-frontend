import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK_MESSAGE, SERVER_MESSAGE } from '@/lib/api'
import { UNAVAILABLE_COPY, isUnavailable, safeErrorMessage } from '@/lib/adminErrors'

const LARAVEL_405 = 'The GET method is not supported for route api/admin/users. Supported methods: POST.'

describe('isUnavailable', () => {
  it('is true for 404 and 405 only', () => {
    expect(isUnavailable(new ApiError(404, 'x'))).toBe(true)
    expect(isUnavailable(new ApiError(405, LARAVEL_405))).toBe(true)
    expect(isUnavailable(new ApiError(403, 'x'))).toBe(false)
    expect(isUnavailable(new ApiError(500, 'x'))).toBe(false)
    expect(isUnavailable(new Error('x'))).toBe(false)
  })
})

describe('safeErrorMessage', () => {
  it('shows the admin copy for a missing route and never the Laravel 405 text', () => {
    for (const status of [404, 405]) {
      const msg = safeErrorMessage(new ApiError(status, LARAVEL_405))
      expect(msg).toBe(UNAVAILABLE_COPY)
      expect(msg).not.toMatch(/GET method|route|Supported methods/i)
    }
  })

  it('delegates everything else to getErrorMessage: 5xx and network get app-wide copy', () => {
    for (const status of [500, 502, 503]) {
      expect(safeErrorMessage(new ApiError(status, 'SQLSTATE[HY000]: General error'))).toBe(SERVER_MESSAGE)
    }
    expect(safeErrorMessage(new ApiError(0, 'API URL is not configured.'))).toBe(NETWORK_MESSAGE)
    expect(safeErrorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_MESSAGE)
  })

  it('passes through messages the API wrote on purpose (409, 422) but filters framework text', () => {
    expect(safeErrorMessage(new ApiError(409, '3 active users hold this role'))).toBe('3 active users hold this role')
    expect(safeErrorMessage(new ApiError(422, 'The email has already been taken.'))).toBe(
      'The email has already been taken.'
    )
    expect(safeErrorMessage(new ApiError(400, 'Class "App\Models\Foo" not found'))).not.toMatch(/Class/)
  })

  it('uses the fallback for unknown non-API errors', () => {
    expect(safeErrorMessage('boom')).toBe('Something went wrong. Try again.')
    expect(safeErrorMessage('boom', 'custom')).toBe('custom')
  })
})
