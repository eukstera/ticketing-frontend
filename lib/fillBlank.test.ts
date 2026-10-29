import { describe, expect, it } from 'vitest'
import { isValidEmail, requestedAtError, toApiDateTime, toLocalInput } from '@/lib/fillBlank'

describe('date helpers', () => {
  it('formats a datetime-local value for the API and back', () => {
    expect(toApiDateTime('2026-10-28T14:30')).toBe('2026-10-28 14:30')
    expect(toLocalInput(new Date(2026, 9, 28, 4, 5))).toBe('2026-10-28T04:05')
  })

  it('validates the requested date', () => {
    const now = new Date(2026, 9, 28, 12, 0)
    expect(requestedAtError('', now)).toMatch(/Enter the date/)
    expect(requestedAtError('2026-10-28T12:01', now)).toBe("The requested date can't be in the future.")
    expect(requestedAtError('2026-10-28T12:00', now)).toBeNull()
    expect(requestedAtError('2026-10-01T08:00', now)).toBeNull()
  })

  it('validates emails loosely', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail(' a@b.co ')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
  })
})
