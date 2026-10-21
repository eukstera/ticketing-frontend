import { describe, expect, it } from 'vitest'
import { PASSWORD_RULES, validateNewPassword } from './profile'

describe('validateNewPassword', () => {
  it('accepts a password that meets every rule', () => {
    expect(validateNewPassword('Newpass123', 'oldpass')).toBeNull()
  })

  it('reports the first unmet rule with a plain-language message', () => {
    expect(validateNewPassword('Ab1', 'x')).toBe('Password must have at least 8 characters.')
    expect(validateNewPassword('alllowercase1', 'x')).toBe('Password must have upper and lower case letters.')
    expect(validateNewPassword('NoNumbersHere', 'x')).toBe('Password must have at least one number.')
    expect(validateNewPassword('Samepass123', 'Samepass123')).toBe('Password must be different from your current one.')
  })

  it('rejects an empty password', () => {
    expect(validateNewPassword('', '')).not.toBeNull()
  })

  it('exposes one checklist entry per rule', () => {
    expect(PASSWORD_RULES.map(r => r.id)).toEqual(['length', 'case', 'number', 'different'])
  })
})
