import { describe, expect, it } from 'vitest'
import { DEFAULT_LANDING, decideGuard, loginUrl, postLoginPath, safeNextPath } from '@/lib/authRedirect'

describe('safeNextPath', () => {
  it('keeps same-origin paths with their query string', () => {
    expect(safeNextPath('/tickets')).toBe('/tickets')
    expect(safeNextPath('/tickets?status_id=2&page=3&search=printer')).toBe('/tickets?status_id=2&page=3&search=printer')
    expect(safeNextPath('/tickets/42')).toBe('/tickets/42')
    expect(safeNextPath('/admin/users?status=inactive')).toBe('/admin/users?status=inactive')
    expect(safeNextPath('/profile')).toBe('/profile')
  })

  it('drops the hash (the server never sees it)', () => {
    expect(safeNextPath('/tickets?page=2#top')).toBe('/tickets?page=2')
  })

  it.each([
    ['an absolute URL', 'https://evil.example/phish'],
    ['a protocol-relative URL', '//evil.example'],
    ['a protocol-relative URL with a backslash', '/\\evil.example'],
    ['a backslash anywhere', '/tickets\\..\\evil'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['a relative path with no leading slash', 'tickets'],
    ['a scheme after a slash trick', '/\t/evil.example'],
    ['a newline', '/tickets\n/evil'],
    ['a NUL byte', '/tickets\u0000'],
    ['an empty string', ''],
    ['a very long value', '/' + 'a'.repeat(2500)],
  ])('refuses %s', (_name, value) => {
    expect(safeNextPath(value)).toBeNull()
  })

  it('refuses non-strings', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath(42)).toBeNull()
    expect(safeNextPath(['/tickets'])).toBeNull()
  })

  it('refuses the login page itself (no redirect loop)', () => {
    expect(safeNextPath('/')).toBeNull()
    expect(safeNextPath('/?next=%2Ftickets')).toBeNull()
  })

  it('leaves encoded slashes encoded, so they stay a path on this site', () => {
    expect(safeNextPath('/%2F%2Fevil.example')).toBe('/%2F%2Fevil.example')
  })
})

describe('loginUrl', () => {
  it('is plain login when there is nothing to come back to', () => {
    expect(loginUrl()).toBe('/')
    expect(loginUrl('')).toBe('/')
    expect(loginUrl('/')).toBe('/')
  })

  it('encodes the page, query string included', () => {
    const url = loginUrl('/tickets?status_id=2&page=3')
    expect(url).toBe('/?next=%2Ftickets%3Fstatus_id%3D2%26page%3D3')
    expect(new URL(url, 'http://x').searchParams.get('next')).toBe('/tickets?status_id=2&page=3')
  })

  it('never puts an unsafe target in the login URL', () => {
    expect(loginUrl('//evil.example')).toBe('/')
    expect(loginUrl('https://evil.example')).toBe('/')
  })
})

describe('postLoginPath', () => {
  it('returns to the remembered page', () => {
    expect(postLoginPath('?next=%2Ftickets%2F42')).toBe('/tickets/42')
    expect(postLoginPath('?next=%2Ftickets%3Fstatus_id%3D2%26page%3D3')).toBe('/tickets?status_id=2&page=3')
  })

  it('round-trips with loginUrl', () => {
    const search = loginUrl('/admin/users?status=inactive&page=2').slice(1)
    expect(postLoginPath(search)).toBe('/admin/users?status=inactive&page=2')
  })

  it('falls back to the dashboard with no ?next=', () => {
    expect(postLoginPath('')).toBe(DEFAULT_LANDING)
    expect(postLoginPath('?other=1')).toBe(DEFAULT_LANDING)
  })

  it.each(['?next=https%3A%2F%2Fevil.example', '?next=%2F%2Fevil.example', '?next=javascript%3Aalert(1)', '?next=%2F'])(
    'ignores an unsafe ?next= (%s)',
    search => {
      expect(postLoginPath(search)).toBe(DEFAULT_LANDING)
    }
  )
})

describe('decideGuard', () => {
  const path = '/tickets?page=3'

  it('waits while hydrating, even with no token visible yet', () => {
    expect(decideGuard({ hydrated: false, hasToken: false, hadToken: false, path: '' })).toEqual({ action: 'wait' })
    expect(decideGuard({ hydrated: false, hasToken: true, hadToken: false, path: '' })).toEqual({ action: 'wait' })
  })

  it('leaves the URL alone on a valid session', () => {
    expect(decideGuard({ hydrated: true, hasToken: true, hadToken: false, path })).toEqual({ action: 'allow' })
    expect(decideGuard({ hydrated: true, hasToken: true, hadToken: true, path })).toEqual({ action: 'allow' })
  })

  it('goes to login with the return path when there is truly no session', () => {
    expect(decideGuard({ hydrated: true, hasToken: false, hadToken: false, path })).toEqual({
      action: 'redirect',
      to: '/?next=%2Ftickets%3Fpage%3D3',
    })
  })

  it('goes to plain login when the session ended while the page was open', () => {
    expect(decideGuard({ hydrated: true, hasToken: false, hadToken: true, path })).toEqual({
      action: 'redirect',
      to: '/',
    })
  })
})
