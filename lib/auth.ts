import { api, isApiError } from '@/lib/api'
import { LoginForm, User } from '@/types'

// User as returned by /login and /me. role/department/designation are optional
// so users stored before the contract change still parse.
export interface AuthUser extends User {
  role?: { id: number; name: string }
  department?: { id: number; name: string }
  designation?: { id: number; name: string }
}

interface LoginResult {
  success: boolean
  message: string
  result: { user: AuthUser; token: string; expires_at: string }
}

// Roles are compared by NAME, never id.
export const ADMIN_ROLE_NAME = 'Department Head'
/** Read-only on its own department's tickets: no ticket actions, no commenting. */
export const ENCODER_ROLE_NAME = 'Encoder'

// localStorage has no same-tab change event, so writes here notify subscribers
// (useSyncExternalStore) through a custom event; the native 'storage' event
// covers other tabs.
const AUTH_EVENT = 'auth-change'

function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function subscribeAuth(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(AUTH_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(AUTH_EVENT, onChange)
  }
}

// Raw string snapshot: useSyncExternalStore compares with Object.is, so it must
// be a primitive. Parsing happens in useUser.
export function getUserRaw(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('user')
}

export function saveToken(token: string) {
  localStorage.setItem('token', token)
  notifyAuthChange()
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function removeToken() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  notifyAuthChange()
}

export function saveUser(user: object) {
  localStorage.setItem('user', JSON.stringify(user))
  notifyAuthChange()
}

export function getUser(): AuthUser | null {
  const raw = getUserRaw()
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role?.name === ADMIN_ROLE_NAME
}

export function isEncoder(user: AuthUser | null | undefined): boolean {
  return user?.role?.name === ENCODER_ROLE_NAME
}

// Refreshes the stored user with role/department/designation from GET /me.
// Best-effort: on 404 (endpoint not live yet) or a network error the existing
// stored user is kept. A 401 is handled globally by api.ts.
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await api.get<{ success: boolean; result: { user: AuthUser } }>('/me')
    if (res.success && res.result?.user) {
      saveUser(res.result.user)
      return res.result.user
    }
  } catch (err) {
    if (isApiError(err) && err.status !== 404 && err.status !== 0) {
      console.error('Failed to refresh user from /me', err)
    }
  }
  return getUser()
}

// Best-effort server-side revoke (POST /logout revokes the current token), then always clear local state.
export async function logout(): Promise<void> {
  try {
    await api.post('/logout', {})
  } catch {
    // Offline, 404 or already-expired token: still log out locally.
  }
  removeToken()
}

export async function login(form: LoginForm) {
  const res = await api.post<LoginResult>('/login', form)
  if (res.success && res.result.token && res.result.user) {
    saveToken(res.result.token)
    saveUser(res.result.user)
    await fetchMe()
  }
  return res
}
