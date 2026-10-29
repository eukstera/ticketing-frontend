import { describe, expect, it } from 'vitest'
import type { AuthUser } from '@/lib/auth'
import { canFillBlank, isValidEmail, requestedAtError, toApiDateTime, toLocalInput } from '@/lib/fillBlank'

const user = (department_id: number, roleName?: string) =>
  ({ id: 1, department_id, role: roleName ? { id: 1, name: roleName } : undefined }) as AuthUser

describe('canFillBlank', () => {
  it('is for IT staff and IT Heads', () => {
    expect(canFillBlank(user(1, 'Staff'))).toBe(true)
    expect(canFillBlank(user(1, 'Department Head'))).toBe(true)
  })
  it('is never for Encoders, other departments or nobody', () => {
    expect(canFillBlank(user(1, 'Encoder'))).toBe(false)
    expect(canFillBlank(user(2, 'Department Head'))).toBe(false)
    expect(canFillBlank(null)).toBe(false)
  })
})

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
