import { describe, expect, it } from 'vitest'
import { ADMIN_PER_PAGE, buildQuery, toPaginator } from '@/lib/admin'

describe('toPaginator', () => {
  it('wraps a bare array (e.g. GET /roles) as a single page', () => {
    expect(toPaginator([{ id: 1 }, { id: 2 }])).toEqual({
      current_page: 1,
      last_page: 1,
      total: 2,
      per_page: ADMIN_PER_PAGE,
      data: [{ id: 1 }, { id: 2 }],
    })
  })

  it('keeps the fields the UI relies on from a full Laravel paginator and ignores the rest', () => {
    const laravel = {
      data: [{ id: 5 }],
      current_page: 2,
      last_page: 4,
      per_page: 15,
      total: 55,
      from: 16,
      to: 30,
      first_page_url: 'x',
      links: [{ url: null, label: '&laquo; Previous', active: false }],
      path: 'http://api/admin/users',
    }
    expect(toPaginator(laravel)).toEqual({
      current_page: 2,
      last_page: 4,
      per_page: 15,
      total: 55,
      data: [{ id: 5 }],
    })
  })

  it('gives an empty first page for a missing payload', () => {
    expect(toPaginator(undefined)).toMatchObject({ current_page: 1, last_page: 1, total: 0, data: [] })
    expect(toPaginator(null).data).toEqual([])
  })

  it('derives total from data when the paginator omits it', () => {
    expect(toPaginator({ data: [1, 2, 3] }).total).toBe(3)
  })
})

describe('buildQuery', () => {
  it('returns an empty string when there is nothing to send', () => {
    expect(buildQuery({})).toBe('')
    expect(buildQuery({ a: undefined, b: null, c: '' })).toBe('')
  })

  it('skips empty values but keeps 0', () => {
    expect(buildQuery({ page: 1, status: undefined, search: '', min: 0 })).toBe('?page=1&min=0')
  })

  it('url-encodes values', () => {
    const qs = buildQuery({ search: 'a&b c' })
    expect(qs).toBe('?search=a%26b+c')
    expect(new URLSearchParams(qs).get('search')).toBe('a&b c')
  })
})
