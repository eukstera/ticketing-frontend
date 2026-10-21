import { describe, expect, it } from 'vitest'
import { AdminListParams, parseAdminParams, serializeAdminParams } from '@/lib/adminList'

const parse = (qs: string, keys: string[] = []) => parseAdminParams(new URLSearchParams(qs), keys)

describe('parseAdminParams', () => {
  it('returns defaults for an empty query string', () => {
    expect(parse('')).toEqual({ page: 1, search: '', status: 'all', filters: {} })
  })

  it('reads page, search, status and only the declared filter keys', () => {
    expect(parse('page=3&search=ann&status=inactive&department_id=2&other=9', ['department_id'])).toEqual({
      page: 3,
      search: 'ann',
      status: 'inactive',
      filters: { department_id: '2' },
    })
  })

  it.each(['0', '-2', 'abc', '1.5', ''])('falls back to page 1 for page=%s', page => {
    expect(parse(`page=${page}`).page).toBe(1)
  })

  it('falls back to status=all for unknown values', () => {
    expect(parse('status=deleted').status).toBe('all')
  })

  it('ignores empty filter values', () => {
    expect(parse('department_id=', ['department_id']).filters).toEqual({})
  })
})

describe('serializeAdminParams', () => {
  const base: AdminListParams = { page: 1, search: '', status: 'all', filters: {} }

  it('omits every default, so the URL stays clean', () => {
    expect(serializeAdminParams(base)).toBe('')
  })

  it('omits status=all but keeps active and inactive', () => {
    expect(serializeAdminParams({ ...base, status: 'all' })).not.toContain('status')
    expect(serializeAdminParams({ ...base, status: 'active' })).toBe('status=active')
    expect(serializeAdminParams({ ...base, status: 'inactive' })).toBe('status=inactive')
  })

  it('omits page 1 and includes later pages', () => {
    expect(serializeAdminParams({ ...base, page: 1 })).toBe('')
    expect(serializeAdminParams({ ...base, page: 4 })).toBe('page=4')
  })

  it('encodes search text and drops empty filters', () => {
    const qs = serializeAdminParams({ ...base, search: 'a&b c', filters: { department_id: '', x: '5' } })
    expect(new URLSearchParams(qs).get('search')).toBe('a&b c')
    expect(qs).not.toContain('department_id')
    expect(qs).toContain('x=5')
  })
})

describe('round-trip', () => {
  it('parse(serialize(p)) gives p back', () => {
    const p: AdminListParams = {
      page: 2,
      search: 'jane doe',
      status: 'active',
      filters: { department_id: '1' },
    }
    expect(parse(serializeAdminParams(p), ['department_id'])).toEqual(p)
  })
})
