// Eight KPI tiles. Static (not links), so they are plain divs with StatCard's shell.
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCount, formatPercent, formatScore } from '@/lib/consolidation'
import { formatDuration } from '@/lib/format'
import { STATUS_STYLES } from '@/lib/styles'
import type { ConsolidationSummary } from '@/types/consolidation'

const NEUTRAL = 'border-gray-200 bg-white text-gray-900'

// StatusStyle.card includes hover colours meant for links; tiles are static.
function tone(status: string): string {
  return (STATUS_STYLES[status]?.card ?? NEUTRAL).split(' ').filter(c => !c.startsWith('hover:')).join(' ')
}

interface Tile {
  label: string
  /** null renders "—" with a screen-reader "No data". */
  value: string | null
  caption?: string
  className: string
}

export function buildTiles(s: ConsolidationSummary): Tile[] {
  const dash = (text: string) => (text === '—' ? null : text)
  return [
    { label: 'Total tickets', value: formatCount(s.total), className: NEUTRAL },
    { label: 'Completed', value: formatCount(s.completed), className: tone('Completed') },
    { label: 'Within SLA', value: dash(formatPercent(s.within_sla_percent)), className: NEUTRAL },
    { label: 'Avg. resolution time', value: dash(formatDuration(s.avg_resolution_minutes)), className: NEUTRAL },
    { label: 'Overdue', value: formatCount(s.overdue), className: tone('Overdue') },
    {
      label: 'False alarm rate',
      value: dash(formatPercent(s.false_alarm_rate_percent)),
      caption: typeof s.false_alarms === 'number' ? `${formatCount(s.false_alarms)} false alarms` : undefined,
      className: tone('False Alarm'),
    },
    { label: 'Avg. satisfaction', value: dash(formatScore(s.avg_satisfaction)), className: NEUTRAL },
    { label: 'Disputes', value: formatCount(s.disputes), className: NEUTRAL },
  ]
}

const GRID = 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-5'

export function KpiSkeleton() {
  return (
    <div role="status" aria-busy="true" className={GRID}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

export default function KpiTiles({ summary }: { summary: ConsolidationSummary }) {
  return (
    <dl className={GRID}>
      {buildTiles(summary).map(t => (
        <div key={t.label} className={`rounded-xl border px-4 py-4 sm:px-6 sm:py-5 ${t.className}`}>
          <dd className="text-2xl font-semibold sm:text-3xl">
            {t.value ?? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">No data</span>
              </>
            )}
          </dd>
          <dt className="mt-1 text-xs text-gray-700 sm:text-sm">{t.label}</dt>
          {t.caption && <p className="mt-0.5 text-xs text-gray-600">{t.caption}</p>}
        </div>
      ))}
    </dl>
  )
}
