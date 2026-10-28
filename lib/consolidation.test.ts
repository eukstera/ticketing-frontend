import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/lib/auth'
import {
  activeFilterCount,
  buildQuery,
  canViewConsolidation,
  defaultFilters,
  defaultRange,
  exportConsolidation,
  exportFilename,
  formatCount,
  formatPercent,
  formatScore,
  formatSurvey,
  parseFilters,
  rangeError,
  serializeFilters,
  type ConsolidationFilters,
} from '@/lib/consolidation'

const TODAY = new Date(2026, 9, 28) // 28 Oct 2026
const user = (roleName?: string) => ({ id: 1, role: roleName ? { id: 1, name: roleName } : undefined }) as AuthUser
const sp = (qs: string) => new URLSearchParams(qs)

describe('canViewConsolidation', () => {
  it('allows Encoders and Department Heads', () => {
    expect(canViewConsolidation(user('Encoder'))).toBe(true)
    expect(canViewConsolidation(user('Department Head'))).toBe(true)
  })
  it('denies everyone else', () => {
    expect(canViewConsolidation(user('Staff'))).toBe(false)
    expect(canViewConsolidation(user())).toBe(false)
    expect(canViewConsolidation(null)).toBe(false)
  })
})

describe('defaultRange', () => {
  it('is the last 30 days including today', () => {
    expect(defaultRange(TODAY)).toEqual({ from: '2026-09-29', to: '2026-10-28' })
  })
  it('crosses a year end', () => {
    expect(defaultRange(new Date(2026, 0, 5))).toEqual({ from: '2025-12-07', to: '2026-01-05' })
  })
})

describe('rangeError', () => {
  it('flags From after To', () => {
    expect(rangeError('2026-10-10', '2026-10-01')).toMatch(/on or before/)
  })
  it('accepts equal or ordered dates', () => {
    expect(rangeError('2026-10-01', '2026-10-01')).toBeNull()
    expect(rangeError('2026-10-01', '2026-10-02')).toBeNull()
  })
})

describe('parseFilters / serializeFilters', () => {
  it('an empty URL is the defaults', () => {
    expect(parseFilters(sp(''), TODAY)).toEqual(defaultFilters(TODAY))
    expect(serializeFilters(defaultFilters(TODAY), TODAY)).toBe('')
  })

  it('round-trips every filter, including area names with commas and spaces', () => {
    const f: ConsolidationFilters = {
      basis: 'completed',
      from: '2026-10-01',
      to: '2026-10-15',
      area: ['Ward 3, East', 'ER'],
      status: [1, 3],
      priority: [2],
      type: [4, 5],
      staff: [9],
      page: 3,
    }
    const qs = serializeFilters(f, TODAY)
    expect(parseFilters(sp(qs), TODAY)).toEqual(f)
  })

  it('ignores junk', () => {
    const f = parseFilters(sp('basis=weird&from=nope&to=2026-10-01&status=1,x,-2,1.5,3&page=-4&area=%E0%A4%A'), TODAY)
    expect(f.basis).toBe('requested')
    expect(f.from).toBe(defaultFilters(TODAY).from)
    expect(f.status).toEqual([1, 3])
    expect(f.page).toBe(1)
  })

  it('falls back to the default range when To is before From', () => {
    const f = parseFilters(sp('from=2026-10-10&to=2026-10-01'), TODAY)
    expect(f).toMatchObject(defaultRange(TODAY))
  })

  it('counts active filters', () => {
    expect(activeFilterCount({ ...defaultFilters(TODAY), area: ['A'], status: [1, 2], staff: [3] })).toBe(4)
  })
})

describe('buildQuery', () => {
  const f: ConsolidationFilters = {
    ...defaultFilters(TODAY),
    basis: 'completed',
    area: ['ER'],
    status: [1, 2],
    priority: [3],
    type: [4],
    staff: [5],
    page: 2,
  }

  it('uses the API names and array params, with paging', () => {
    const q = new URLSearchParams(buildQuery(f))
    expect(q.get('date_field')).toBe('completed')
    expect(q.getAll('requesting_area[]')).toEqual(['ER'])
    expect(q.getAll('status_id[]')).toEqual(['1', '2'])
    expect(q.getAll('priority_id[]')).toEqual(['3'])
    expect(q.getAll('concern_type_id[]')).toEqual(['4'])
    expect(q.getAll('staff_id[]')).toEqual(['5'])
    expect(q.get('page')).toBe('2')
    expect(q.get('per_page')).toBe('15')
  })

  it('the export has the same filters and no paging', () => {
    const q = new URLSearchParams(buildQuery(f, { withPage: false }))
    expect(q.has('page')).toBe(false)
    expect(q.has('per_page')).toBe(false)
    expect(q.getAll('status_id[]')).toEqual(['1', '2'])
  })
})

describe('formatting', () => {
  it('null shows as a dash', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatScore(null)).toBe('—')
    expect(formatSurvey(null)).toBe('—')
    expect(formatCount(undefined)).toBe('—')
  })
  it('formats values', () => {
    expect(formatPercent(87.5)).toBe('87.5%')
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatScore(4.25)).toBe('4.3 / 5')
    expect(formatSurvey(4)).toBe('4/5')
    expect(formatCount(12345)).toBe('12,345')
  })
})

describe('exportConsolidation', () => {
  const filters = { ...defaultFilters(TODAY), from: '2026-10-01', to: '2026-10-15', page: 4 }
  const blob = new Blob(['x'])

  it('requests the applied filters without paging and saves under the server filename', async () => {
    const fetchFile = vi.fn().mockResolvedValue({ blob, filename: 'consolidation_2026-10-01_2026-10-15.xlsx' })
    const save = vi.fn().mockReturnValue(true)
    const res = await exportConsolidation(filters, undefined, { fetchFile, save })
    expect(fetchFile.mock.calls[0][0]).toMatch(/^\/reports\/consolidated\/export\?/)
    expect(fetchFile.mock.calls[0][0]).not.toMatch(/page=/)
    expect(save).toHaveBeenCalledWith(blob, 'consolidation_2026-10-01_2026-10-15.xlsx')
    expect(res.saved).toBe(true)
  })

  it('falls back to a generated filename and reports a blocked download', async () => {
    const fetchFile = vi.fn().mockResolvedValue({ blob, filename: null })
    const save = vi.fn().mockReturnValue(false)
    const res = await exportConsolidation(filters, undefined, { fetchFile, save })
    expect(res).toEqual({ saved: false, filename: exportFilename(filters) })
    expect(exportFilename(filters)).toBe('consolidation_2026-10-01_2026-10-15.xlsx')
  })

  it('lets an API failure propagate', async () => {
    const fetchFile = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(exportConsolidation(filters, undefined, { fetchFile, save: vi.fn() })).rejects.toThrow('boom')
  })
})
