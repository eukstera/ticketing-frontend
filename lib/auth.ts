import { api } from '@/lib/api'
import { AuthResponse, LoginForm, RegisterForm } from '@/types'

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

export function getUser() {
  if (typeof window === 'undefined') return null // guards against server-side calls
  const u = localStorage.getItem('user')
  return u ? JSON.parse(u) : null
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export async function login(form: LoginForm){
  const res = await api.post<AuthResponse>('/login', form)
  if(res.success && res.result.token && res.result.user){
    saveToken(res.result.token)
    saveUser(res.result.user)
  }
  return res
}

export async function register(form: RegisterForm){
  const res = await api.post<AuthResponse>('/register', form)
  if(res.success && res.result.token && res.result.user){
    saveToken(res.result.token)
    saveUser(res.result.user)
  }
  return res
}