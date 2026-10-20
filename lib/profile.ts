import { api } from './api'
import type { AuthUser } from './auth'

// Spec: TicketingSystem-API/CHANGES.md "My profile". Both routes are throttled
// to 10/min per user (429).

export interface UpdateProfilePayload {
  first_name?: string // max 100
  last_name?: string // max 100
}

export function updateProfile(payload: UpdateProfilePayload) {
  return api.patch<{ result: { user: AuthUser } }>('/me', payload)
}

export interface ChangePasswordPayload {
  current_password: string
  password: string // min 8, mixed case and a number, different from the current one
  password_confirmation: string
}

// A wrong current_password is a 422 with errors.current_password. Success
// revokes the user's OTHER tokens; the current token stays valid.
export function changePassword(payload: ChangePasswordPayload) {
  return api.patch<{ result: Record<string, never> }>('/me/password', payload)
}

export const PASSWORD_MIN_LENGTH = 8

export interface PasswordRule {
  id: string
  label: string
  test: (password: string, current: string) => boolean
}

// Mirrors the BE rule set; used for both the live checklist and submit-time validation.
export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: pw => pw.length >= PASSWORD_MIN_LENGTH },
  { id: 'case', label: 'Upper and lower case letters', test: pw => /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
  { id: 'number', label: 'At least one number', test: pw => /\d/.test(pw) },
  { id: 'different', label: 'Different from your current password', test: (pw, current) => pw !== '' && pw !== current },
]

/** First unmet rule as a message, or null when the password is acceptable. */
export function validateNewPassword(password: string, current: string): string | null {
  const failed = PASSWORD_RULES.find(rule => !rule.test(password, current))
  return failed ? `Password rule not met: ${failed.label.toLowerCase()}.` : null
}
