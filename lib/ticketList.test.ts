import { describe, expect, it } from 'vitest'
import { optionalSlaLabel } from '@/lib/format'
import {
  DEFAULT_PER_PAGE,
  EMPTY_LIST_PARAMS,
  PriorityCount,
  StatusCount,
  TicketListParams,
  buildListQuery,
  coerceSla,
  hasActiveFilters,
  normalizeListResponse,
  normalizePriorityCounts,
  normalizeStatusCounts,
  parseListParams,
  resolveLegacyFilters,
  serializeListParams,
  type RawTicketListResponse,
} from '@/lib/ticketList'

const parse = (qs: string) => parseListParams(new URLSearchParams(qs))
const params = (patch: Partial<TicketListParams> = {}): TicketListParams => ({ ...EMPTY_LIST_PARAMS, ...patch })

describe('parseListParams', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parse('')).toEqual(EMPTY_LIST_PARAMS)
  })

  it.each(['0', '-1', 'abc', '2.5'])('falls back to page 1 for page=%s', page => {
    expect(parse(`page=${page}`).page).toBe(1)
  })

  it.each(['0', '101', 'x'])('falls back to the default page size for per_page=%s', perPage => {
    expect(parse(`per_page=${perPage}`).per_page).toBe(DEFAULT_PER_PAGE)
  })

  it('accepts per_page at the 1..100 bounds', () => {
    expect(parse('per_page=1').per_page).toBe(1)
    expect(parse('per_page=100').per_page).toBe(100)
  })

  it('ignores an unknown sort/dir and a malformed date', () => {
    const p = parse('sort=nope&dir=sideways&date_from=2026-1-1&date_to=tomorrow')
    expect(p.sort).toBe(EMPTY_LIST_PARAMS.sort)
    expect(p.dir).toBe(EMPTY_LIST_PARAMS.dir)
    expect(p.date_from).toBeNull()
    expect(p.date_to).toBeNull()
  })

  it('reads ids, search and valid dates', () => {
    const p = parse('status_id=3&priority_id=2&search=printer&date_from=2026-10-01&date_to=2026-10-20&sort=priority&dir=asc')
    expect(p).toMatchObject({
      status_id: 3,
      priority_id: 2,
      search: 'printer',
      date_from: '2026-10-01',
      date_to: '2026-10-20',
      sort: 'priority',
      dir: 'asc',
    })
  })

  it('turns non-integer ids into null', () => {
    const p = parse('status_id=abc&priority_id=')
    expect(p.status_id).toBeNull()
    expect(p.priority_id).toBeNull()
  })
})

describe('serializeListParams', () => {
  it('omits defaults', () => {
    expect(serializeListParams(EMPTY_LIST_PARAMS)).toBe('')
  })

  it('round-trips a fully populated set of params', () => {
    const p = params({
      page: 3,
      per_page: 25,
      search: 'a b&c',
      status_id: 2,
      priority_id: 4,
      date_from: '2026-10-01',
      date_to: '2026-10-31',
      sort: 'ticket_number',
      dir: 'asc',
    })
    expect(parse(serializeListParams(p))).toEqual(p)
  })

  it('only emits a legacy label while no id is set', () => {
    expect(serializeListParams(params({ status: 'Open' }))).toBe('status=Open')
    expect(serializeListParams(params({ status: 'Open', status_id: 1 }))).toBe('status_id=1')
    expect(serializeListParams(params({ priority: 'High' }))).toBe('priority=High')
    expect(serializeListParams(params({ priority: 'High', priority_id: 5 }))).toBe('priority_id=5')
  })
})

describe('hasActiveFilters', () => {
  it('is false for the defaults and true for any filter', () => {
    expect(hasActiveFilters(EMPTY_LIST_PARAMS)).toBe(false)
    expect(hasActiveFilters(params({ search: 'x' }))).toBe(true)
    expect(hasActiveFilters(params({ status_id: 1 }))).toBe(true)
    expect(hasActiveFilters(params({ priority: 'High' }))).toBe(true)
    expect(hasActiveFilters(params({ date_to: '2026-10-01' }))).toBe(true)
  })

  it('ignores paging and sorting', () => {
    expect(hasActiveFilters(params({ page: 4, per_page: 50, sort: 'status', dir: 'asc' }))).toBe(false)
  })
})

describe('normalizeStatusCounts', () => {
  it('passes the array shape through, including the null-id "All" entry', () => {
    const arr: StatusCount[] = [
      { id: null, label: 'All', count: 9 },
      { id: 1, label: 'Open', count: 4 },
    ]
    expect(normalizeStatusCounts(arr)).toBe(arr)
  })

  it('converts the old Record shape into legacy entries with negative ids', () => {
    expect(normalizeStatusCounts({ All: 9, Open: 4, Completed: 5 })).toEqual([
      { id: null, label: 'All', count: 9 },
      { id: -2, label: 'Open', count: 4, legacy: true },
      { id: -3, label: 'Completed', count: 5, legacy: true },
    ])
  })

  it('tolerates a missing payload', () => {
    expect(normalizeStatusCounts(undefined as unknown as Record<string, number>)).toEqual([])
  })
})

describe('normalizePriorityCounts', () => {
  it('passes the new array shape through', () => {
    const arr: PriorityCount[] = [{ id: 7, level: 'High', sla_days: 2, count: 3 }]
    expect(normalizePriorityCounts(arr)).toBe(arr)
  })

  it('converts the old Record shape, taking SLA days from the lookup (default 0)', () => {
    expect(normalizePriorityCounts({ High: 3, Low: 1 }, { High: 2 })).toEqual([
      { id: -1, level: 'High', sla_days: 2, count: 3, legacy: true },
      { id: -2, level: 'Low', sla_days: 0, count: 1, legacy: true },
    ])
  })
})

describe('normalizeListResponse', () => {
  it('normalizes both counts from a legacy response', () => {
    const res = {
      message: 'ok',
      result: {
        ticket: { data: [], current_page: 1, last_page: 1, total: 0, per_page: 10 },
        status_counts: { All: 1, Open: 1 },
        priority_counts: { High: 1 },
        priority_sla: { High: 2 },
      },
    } as unknown as RawTicketListResponse

    const out = normalizeListResponse(res)
    expect(out.statusCounts.map(s => s.label)).toEqual(['All', 'Open'])
    expect(out.priorityCounts[0]).toMatchObject({ level: 'High', sla_days: 2, legacy: true })
    expect(out.tickets).toEqual(res.result.ticket)
  })

  it('coerces a string priority_sla on list rows to a number', () => {
    const row = (priority_sla: unknown) => ({ id: 1, priority_sla })
    const res = {
      message: 'ok',
      result: {
        ticket: {
          data: [row('10'), row('1'), row(3), row(null), row(undefined), row('abc')],
          current_page: 1, last_page: 1, total: 6, per_page: 10,
        },
        status_counts: [],
        priority_counts: [],
      },
    } as unknown as RawTicketListResponse

    const slas = normalizeListResponse(res).tickets.data.map(r => r.priority_sla)
    expect(slas).toEqual([10, 1, 3, null, undefined, null])
  })

  it('renders the coerced values as SLA labels ("10" -> 10 days, "1" -> 1 day)', () => {
    expect(optionalSlaLabel(coerceSla('10'))).toBe('SLA 10 days')
    expect(optionalSlaLabel(coerceSla('1'))).toBe('SLA 1 day')
    expect(optionalSlaLabel(coerceSla('0'))).toBe('No SLA')
    expect(optionalSlaLabel(coerceSla(null))).toBeNull()
  })
})

describe('buildListQuery', () => {
  const statusCounts: StatusCount[] = [
    { id: null, label: 'All', count: 5 },
    { id: 1, label: 'Open', count: 2 },
    { id: -3, label: 'Overdue', count: 1, legacy: true },
  ]
  const priorityCounts: PriorityCount[] = [
    { id: 4, level: 'High', sla_days: 2, count: 2 },
    { id: -1, level: 'Low', sla_days: 0, count: 1, legacy: true },
  ]
  const counts = { statusCounts, priorityCounts }

  it('always sends page, per_page, sort and dir', () => {
    const q = buildListQuery(EMPTY_LIST_PARAMS)
    expect(Object.fromEntries(q)).toEqual({
      page: '1',
      per_page: String(DEFAULT_PER_PAGE),
      sort: EMPTY_LIST_PARAMS.sort,
      dir: EMPTY_LIST_PARAMS.dir,
    })
  })

  it('sends ids for real entries', () => {
    const q = buildListQuery(params({ status_id: 1, priority_id: 4 }), counts)
    expect(q.get('status_id')).toBe('1')
    expect(q.get('priority_id')).toBe('4')
    expect(q.has('status')).toBe(false)
    expect(q.has('priority')).toBe(false)
  })

  it('sends the label for legacy entries instead of the synthetic id', () => {
    const q = buildListQuery(params({ status_id: -3, priority_id: -1 }), counts)
    expect(q.get('status')).toBe('Overdue')
    expect(q.get('priority')).toBe('Low')
    expect(q.has('status_id')).toBe(false)
    expect(q.has('priority_id')).toBe(false)
  })

  it('falls back to a deep-link label before the counts have loaded', () => {
    const q = buildListQuery(params({ status: 'Open', priority: 'High' }))
    expect(q.get('status')).toBe('Open')
    expect(q.get('priority')).toBe('High')
  })

  it('is not confused by the "All" entry (id null) matching an unset filter', () => {
    const q = buildListQuery(params(), counts)
    expect(q.has('status')).toBe(false)
    expect(q.has('status_id')).toBe(false)
  })

  it('includes search and dates when set', () => {
    const q = buildListQuery(params({ search: 'x', date_from: '2026-10-01', date_to: '2026-10-02' }))
    expect(q.get('search')).toBe('x')
    expect(q.get('date_from')).toBe('2026-10-01')
    expect(q.get('date_to')).toBe('2026-10-02')
  })
})

describe('resolveLegacyFilters', () => {
  const counts = {
    statusCounts: [
      { id: null, label: 'All', count: 5 },
      { id: 1, label: 'Open', count: 2 },
    ] as StatusCount[],
    priorityCounts: [{ id: 4, level: 'High', sla_days: 2, count: 2 }] as PriorityCount[],
  }

  it('maps deep-link labels to ids and clears the labels', () => {
    expect(resolveLegacyFilters(params({ status: 'Open', priority: 'High' }), counts)).toMatchObject({
      status_id: 1,
      status: null,
      priority_id: 4,
      priority: null,
    })
  })

  it('returns null when there is nothing to resolve', () => {
    expect(resolveLegacyFilters(params({ status_id: 1 }), counts)).toBeNull()
  })

  it('leaves labels with no match alone', () => {
    expect(resolveLegacyFilters(params({ status: 'Nope', priority: 'Nope' }), counts)).toBeNull()
  })

  it('does not resolve a label onto the "All" entry (null id)', () => {
    expect(resolveLegacyFilters(params({ status: 'All' }), counts)).toBeNull()
  })
})
