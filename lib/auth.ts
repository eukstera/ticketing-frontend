import { api } from '@/lib/api'
import { AuthResponse, LoginForm, RegisterForm } from '@/types'

export function saveToken(token: string) {
  localStorage.setItem('token', token)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function removeToken() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function saveUser(user: object) {
  localStorage.setItem('user', JSON.stringify(user))
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