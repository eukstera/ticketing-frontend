import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
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
  it('never leaks the raw Laravel 405 text', () => {
    const msg = safeErrorMessage(new ApiError(405, LARAVEL_405))
    expect(msg).toBe(UNAVAILABLE_COPY)
    expect(msg).not.toMatch(/GET method|route|Supported methods/i)
  })

  it('uses our own copy for 404, 403 and 5xx', () => {
    expect(safeErrorMessage(new ApiError(404, 'No query results for model'))).toBe(UNAVAILABLE_COPY)
    expect(safeErrorMessage(new ApiError(403, 'This action is unauthorized.'))).toBe(
      "You don't have permission to do that."
    )
    for (const status of [500, 502, 503]) {
      const msg = safeErrorMessage(new ApiError(status, 'SQLSTATE[HY000]: General error'))
      expect(msg).toBe('The server had a problem. Try again in a moment.')
    }
  })

  it('passes through the messages the API writes on purpose (409, 422)', () => {
    expect(safeErrorMessage(new ApiError(409, '3 active users hold this role'))).toBe('3 active users hold this role')
    expect(safeErrorMessage(new ApiError(422, 'The email has already been taken.'))).toBe(
      'The email has already been taken.'
    )
  })

  it('keeps our own client-side copy (status 0)', () => {
    expect(safeErrorMessage(new ApiError(0, 'API URL is not configured.'))).toBe('API URL is not configured.')
  })

  it('uses the fallback for non-API errors', () => {
    expect(safeErrorMessage(new TypeError('Failed to fetch'))).toBe('Something went wrong. Try again.')
    expect(safeErrorMessage(new TypeError('x'), 'custom')).toBe('custom')
  })
})
