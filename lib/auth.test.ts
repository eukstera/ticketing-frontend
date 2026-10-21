// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// auth.ts talks to the API through lib/api; replace that boundary entirely.
// (lib/api and lib/auth import each other, so importing the real module here
// would pull auth in through the mock.)
const { post, get, ApiError } = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string
    ) {
      super(message)
    }
  }
  return { post: vi.fn(), get: vi.fn(), ApiError }
})
vi.mock('@/lib/api', () => ({
  api: { post, get },
  ApiError,
  isApiError: (e: unknown) => e instanceof ApiError,
}))

import {
  fetchMe,
  getToken,
  getUser,
  getUserRaw,
  isAdmin,
  login,
  logout,
  removeToken,
  saveToken,
  saveUser,
  subscribeAuth,
  type AuthUser,
} from '@/lib/auth'

const user = (patch: Partial<AuthUser> = {}) =>
  ({ id: 1, first_name: 'Jane', last_name: 'Doe', role: { id: 2, name: 'Department Head' }, ...patch }) as AuthUser

beforeEach(() => {
  localStorage.clear()
  post.mockReset()
  get.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getUser', () => {
  it('is null when nothing is stored', () => {
    expect(getUser()).toBeNull()
  })

  it('parses a stored user', () => {
    saveUser(user())
    expect(getUser()?.first_name).toBe('Jane')
  })

  it('returns null instead of throwing on corrupt JSON', () => {
    localStorage.setItem('user', '{not json')
    expect(() => getUser()).not.toThrow()
    expect(getUser()).toBeNull()
  })
})

describe('isAdmin', () => {
  it('is true for the Department Head role name', () => {
    expect(isAdmin(user())).toBe(true)
  })

  it('compares by NAME, never by id', () => {
    expect(isAdmin(user({ role: { id: 2, name: 'Normal User' } }))).toBe(false)
    expect(isAdmin(user({ role: { id: 1, name: 'Department Head' } }))).toBe(true)
  })

  it('is false without a user or role', () => {
    expect(isAdmin(null)).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
    expect(isAdmin(user({ role: undefined }))).toBe(false)
  })
})

describe('storage and subscriptions', () => {
  it('notifies subscribers on save and remove, and stops after unsubscribe', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeAuth(onChange)

    saveToken('abc')
    saveUser(user())
    removeToken()
    expect(onChange).toHaveBeenCalledTimes(3)

    unsubscribe()
    saveToken('def')
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('removeToken clears both the token and the user', () => {
    saveToken('abc')
    saveUser(user())
    expect(getToken()).toBe('abc')
    expect(getUserRaw()).not.toBeNull()

    removeToken()
    expect(getToken()).toBeNull()
    expect(getUserRaw()).toBeNull()
  })
})

describe('fetchMe', () => {
  it('replaces the stored user with the /me payload', async () => {
    saveUser(user({ id: 1, role: { id: 1, name: 'Normal User' } }))
    get.mockResolvedValue({ success: true, result: { user: user() } })

    const me = await fetchMe()

    expect(get).toHaveBeenCalledWith('/me')
    expect(me?.role?.name).toBe('Department Head')
    expect(getUser()?.role?.name).toBe('Department Head')
  })

  it('keeps the stored user when /me is 404 (endpoint not live)', async () => {
    saveUser(user({ first_name: 'Stored' }))
    get.mockRejectedValue(new ApiError(404, 'Not found'))

    const me = await fetchMe()

    expect(me?.first_name).toBe('Stored')
    expect(getUser()?.first_name).toBe('Stored')
  })

  it('keeps the stored user on a network error', async () => {
    saveUser(user({ first_name: 'Stored' }))
    get.mockRejectedValue(new TypeError('Failed to fetch'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await fetchMe())?.first_name).toBe('Stored')
  })
})

describe('login', () => {
  it('stores the token and user, then refreshes from /me', async () => {
    post.mockResolvedValue({
      success: true,
      message: 'ok',
      result: { token: 'tok', user: user({ first_name: 'FromLogin' }), expires_at: '2026-10-27T00:00:00Z' },
    })
    get.mockResolvedValue({ success: true, result: { user: user({ first_name: 'FromMe' }) } })

    await login({ email: 'a@b.c', password: 'secret123' })

    expect(post).toHaveBeenCalledWith('/login', { email: 'a@b.c', password: 'secret123' })
    expect(getToken()).toBe('tok')
    expect(getUser()?.first_name).toBe('FromMe')
  })

  it('stores nothing when the API rejects', async () => {
    post.mockRejectedValue(new ApiError(422, 'Invalid credentials'))

    await expect(login({ email: 'a@b.c', password: 'x' })).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
    expect(getUser()).toBeNull()
  })
})

describe('logout', () => {
  it('calls POST /logout and clears storage', async () => {
    saveToken('tok')
    saveUser(user())
    post.mockResolvedValue({ success: true })

    await logout()

    expect(post).toHaveBeenCalledWith('/logout', {})
    expect(getToken()).toBeNull()
    expect(getUser()).toBeNull()
  })

  it('still clears storage when the request fails', async () => {
    saveToken('tok')
    saveUser(user())
    post.mockRejectedValue(new TypeError('offline'))

    await expect(logout()).resolves.toBeUndefined()

    expect(getToken()).toBeNull()
    expect(getUser()).toBeNull()
  })
})
