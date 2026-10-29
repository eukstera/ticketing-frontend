import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

import { buildChips, withoutChip } from '@/components/consolidation/AppliedChips'
import KpiTiles, { buildTiles } from '@/components/consolidation/KpiTiles'
import PreviewTable from '@/components/consolidation/PreviewTable'
import { ExportButton, ReportBody } from '@/components/consolidation/ConsolidationPage'
import { summarizeSelection } from '@/components/ui/MultiSelect'
import { defaultFilters } from '@/lib/consolidation'
import type { ConsolidationReport, ConsolidationSummary, ConsolidationTicket } from '@/types/consolidation'

const summary: ConsolidationSummary = {
  total: 1234,
  completed: 100,
  within_sla_percent: 87.5,
  avg_resolution_minutes: 3120,
  overdue: 3,
  false_alarm_rate_percent: null,
  false_alarms: 0,
  avg_satisfaction: 4.3,
  disputes: 1,
  voided: 7,
}

const ticket = (over: Partial<ConsolidationTicket> = {}): ConsolidationTicket => ({
  id: 7,
  ticket_number: '10-007-2026',
  requested_at: '2026-10-20T03:05:00Z',
  requester: 'Ana Cruz',
  requesting_area: 'Ward 3',
  concern_type: 'Network',
  priority: 'Urgent',
  status: 'Completed',
  handled_by: 'Ben Reyes',
  completed_at: '2026-10-21T03:05:00Z',
  resolution_minutes: 330,
  within_sla: true,
  is_overdue: false,
  survey_score: 4,
  disputed: false,
  action_taken: 'Replaced the switch',
  ...over,
})

const report = (tickets: ConsolidationTicket[], total = tickets.length): ConsolidationReport => ({
  summary,
  breakdowns: { by_status: [{ label: 'Open', count: 2 }], by_priority: [{ label: 'Urgent', count: 1 }] },
  tickets: { data: tickets, current_page: 1, last_page: 1, per_page: 15, total },
})

const body = (over: Partial<Parameters<typeof ReportBody>[0]> = {}) =>
  renderToString(
    <ReportBody data={null} error="" forbidden={false} refreshing={false} onRetry={() => {}} onReset={() => {}} onPage={() => {}} {...over} />
  )

describe('KPI tiles', () => {
  it('shows nine tiles with formatted values, Voided last', () => {
    const html = renderToString(<KpiTiles summary={summary} />)
    expect(buildTiles(summary)).toHaveLength(9)
    expect(buildTiles(summary).at(-1)).toMatchObject({ label: 'Voided', value: '7' })
    expect(html).toContain('1,234')
    expect(html).toContain('87.5%')
    expect(html).toContain('2d 4h')
    expect(html).toContain('4.3 / 5')
  })

  it('renders null as a dash with a screen-reader note', () => {
    const html = renderToString(<KpiTiles summary={summary} />)
    expect(html).toContain('—')
    expect(html).toContain('No data')
    expect(buildTiles(summary).find(t => t.label === 'False alarm rate')?.value).toBeNull()
  })
})

describe('report body states', () => {
  it('loading: skeletons, no data', () => {
    const html = body()
    expect(html).toContain('Loading…')
    expect(html).toContain('aria-busy="true"')
  })

  it('error: a message and Retry', () => {
    const html = body({ error: 'Too many tickets match. Narrow the date range or filters.' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Too many tickets match.')
    expect(html).toContain('Retry')
  })

  it('403: the message without Retry', () => {
    const html = body({ error: 'Only Encoders and Department Heads can view the consolidated report.', forbidden: true })
    expect(html).toContain('Only Encoders and Department Heads')
    expect(html).not.toContain('Retry')
  })

  it('empty: says so and offers Reset filters, tiles still show', () => {
    const html = body({ data: report([], 0) })
    expect(html).toContain('No tickets match these filters')
    expect(html).toContain('Reset filters')
    expect(html).toContain('Total tickets')
  })

  it('rows: shows the count line and a ticket link', () => {
    const html = body({ data: report([ticket()], 1234) })
    expect(html.replace(/<!-- -->/g, '')).toContain('Showing 1 of 1,234 tickets')
    expect(html).toContain('href="/tickets/7"')
    expect(html).toContain('10-007-2026')
  })
})

describe('voided rows and tile', () => {
  it('shows the Voided tile as a dash when the server does not send it', () => {
    const tile = buildTiles({ ...summary, voided: null }).at(-1)
    expect(tile).toMatchObject({ label: 'Voided', value: null })
    expect(buildTiles({ ...summary, voided: undefined }).at(-1)?.value).toBeNull()
  })

  it('renders a Void row: dashes for the empty cells, the Void pill and the reason', () => {
    const html = renderToString(
      <PreviewTable
        tickets={[
          ticket({
            status: 'Void',
            requester: null,
            requesting_area: null,
            concern_type: null,
            priority: null,
            handled_by: null,
            resolution_minutes: null,
            within_sla: null,
            survey_score: null,
            action_taken: null,
            is_void: true,
            void_reason: 'Printed twice by mistake',
            voided_at: '2026-10-21T03:05:00Z',
          }),
        ]}
      />
    )
    expect(html).toContain('>Void<')
    expect(html).toContain('bg-gray-700') // the Void pill
    expect(html).toContain('Voided: Printed twice by mistake')
    expect(html).toContain('text-gray-500')
    expect(html).not.toContain('Replaced the switch')
    // requester, concern, priority, handled by, resolution, SLA and survey are all dashes
    expect((html.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(6)
  })

  it('a Void row without a reason still says it was voided', () => {
    const html = renderToString(<PreviewTable tickets={[ticket({ status: 'Void', is_void: true, void_reason: null })]} />)
    expect(html).toContain('>Voided<')
  })

  it('a null priority renders a dash, not a pill', () => {
    const html = renderToString(<PreviewTable tickets={[ticket({ priority: null })]} />)
    expect(html).not.toContain('border-orange-300')
  })
})

describe('preview table', () => {
  it('shows dashes for an open ticket and a Yes/No with words for SLA', () => {
    const open = renderToString(
      <PreviewTable tickets={[ticket({ status: 'Open', resolution_minutes: null, within_sla: null, survey_score: null, action_taken: null, handled_by: null })]} />
    )
    expect(open).toContain('—')
    expect(renderToString(<PreviewTable tickets={[ticket({ within_sla: false })]} />)).toContain('No')
    expect(renderToString(<PreviewTable tickets={[ticket()]} />)).toContain('Yes')
  })

  it('dims rows while refreshing', () => {
    expect(renderToString(<PreviewTable tickets={[ticket()]} refreshing />)).toContain('opacity-60')
  })

  it('has a sticky first column, a caption and the duration helper', () => {
    const html = renderToString(<PreviewTable tickets={[ticket()]} />)
    expect(html).toContain('sticky left-0')
    expect(html).toContain('Consolidated tickets')
    expect(html).toContain('5h 30m')
  })
})

describe('export button', () => {
  const btn = (over: Partial<Parameters<typeof ExportButton>[0]> = {}) =>
    renderToString(<ExportButton busy={false} slow={false} disabled={false} noMatches={false} onClick={() => {}} {...over} />)

  it('idle', () => {
    const html = btn()
    expect(html).toContain('Export to Excel')
    expect(html).not.toContain('disabled=""')
  })

  it('exporting: busy, disabled, then "Still working…"', () => {
    const html = btn({ busy: true, disabled: true })
    expect(html).toContain('Exporting…')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('disabled=""')
    expect(btn({ busy: true, slow: true, disabled: true })).toContain('Still working…')
  })

  it('no matches: disabled and explained', () => {
    const html = btn({ disabled: true, noMatches: true })
    expect(html).toContain('No tickets match these filters')
    expect(html).toContain('aria-describedby="consolidation-export-note"')
  })
})

describe('applied chips and selection summary', () => {
  it('builds chips from the applied filters and removes one', () => {
    const f = { ...defaultFilters(), status: [1, 2], area: ['ER'] }
    const chips = buildChips(f, { statuses: [{ id: 1, name: 'Open' }, { id: 2, name: 'Completed' }] })
    expect(chips.map(c => c.name)).toEqual(['ER', 'Open', 'Completed'])
    expect(withoutChip(f, chips[1]).status).toEqual([2])
  })

  it('omits id-based chips until the options are ready, keeping area names', () => {
    const f = { ...defaultFilters(), status: [1], staff: [2], area: ['ER'] }
    expect(buildChips(f, {}).map(c => c.name)).toEqual(['ER'])
    expect(buildChips(f, { statuses: [{ id: 1, name: 'Open' }] }).map(c => c.name)).toEqual(['ER', 'Open'])
  })

  it('summarizes: All / the name / N selected', () => {
    const opts = [{ value: 1, label: 'Open' }, { value: 2, label: 'Done' }]
    expect(summarizeSelection(opts, [])).toBe('All')
    expect(summarizeSelection(opts, [2])).toBe('Done')
    expect(summarizeSelection(opts, [1, 2])).toBe('2 selected')
  })
})
