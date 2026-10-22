// @vitest-environment jsdom
import { act } from 'react'
import { hydrateRoot, createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }))
vi.mock('@/lib/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, fetchMe: vi.fn(async () => null) }
})

import { useAuthGuard } from '@/hooks/useAuthGuard'
import { removeToken, saveToken } from '@/lib/auth'

function Page() {
  const authed = useAuthGuard()
  return authed ? <p>protected content</p> : null
}

let container: HTMLDivElement
let root: Root | null = null

function setUrl(path: string) {
  window.history.replaceState(null, '', path)
}

beforeEach(() => {
  replace.mockReset()
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container.remove()
})

// What the browser has on a refresh: HTML rendered on the server (no
// localStorage, so no token), then hydrated on the client where the token exists.
async function refreshWithToken(path: string) {
  setUrl(path)
  const html = renderToString(<Page />)
  container.innerHTML = html
  saveToken('valid-token')
  await act(async () => {
    root = hydrateRoot(container, <Page />)
  })
}

describe('useAuthGuard on a refresh (hydration)', () => {
  it('keeps the URL when a valid session exists: it never redirects while hydrating', async () => {
    await refreshWithToken('/tickets?status_id=2&page=3&search=printer')

    expect(replace).not.toHaveBeenCalled()
    expect(container.textContent).toBe('protected content')
    expect(window.location.pathname + window.location.search).toBe('/tickets?status_id=2&page=3&search=printer')
  })

  it.each(['/tickets/42', '/admin/users?status=inactive', '/profile', '/my-tickets?page=2'])(
    'does not redirect away from %s',
    async path => {
      await refreshWithToken(path)
      expect(replace).not.toHaveBeenCalled()
    }
  )
})

describe('useAuthGuard without a session', () => {
  it('goes to login carrying the page (path and query) to return to', async () => {
    setUrl('/tickets?status_id=2&page=3')
    await act(async () => {
      root = createRoot(container)
      root.render(<Page />)
    })

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/?next=%2Ftickets%3Fstatus_id%3D2%26page%3D3')
    expect(container.textContent).toBe('')
  })

  it('also redirects after hydrating a page that really has no session', async () => {
    setUrl('/admin/users')
    container.innerHTML = renderToString(<Page />)
    await act(async () => {
      root = hydrateRoot(container, <Page />)
    })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/?next=%2Fadmin%2Fusers')
  })

  it('sends a user who logs out to plain login, with no return path', async () => {
    setUrl('/tickets')
    saveToken('valid-token')
    await act(async () => {
      root = createRoot(container)
      root.render(<Page />)
    })
    expect(replace).not.toHaveBeenCalled()

    await act(async () => {
      removeToken()
    })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/')
  })
})
