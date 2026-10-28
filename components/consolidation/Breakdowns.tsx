// "By status" and "By priority" as div bars (no chart library).
import { barWidth } from '@/lib/format'
import { formatCount } from '@/lib/consolidation'
import { PRIORITY_FALLBACK, PRIORITY_STYLES, STATUS_FALLBACK, STATUS_STYLES } from '@/lib/styles'
import type { LabelCount } from '@/types/consolidation'

function BreakdownCard({
  title,
  rows,
  barClass,
}: {
  title: string
  rows: LabelCount[]
  barClass: (label: string) => string
}) {
  const max = Math.max(0, ...rows.map(r => r.count))
  const summary = rows.map(r => `${r.label}: ${r.count}`).join(', ')
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-800">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No data</p>
      ) : (
        <ul role="img" aria-label={`${title}. ${summary}`} className="space-y-3">
          {rows.map(r => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-gray-700">{r.label}</span>
                <span className="font-medium tabular-nums text-gray-900">{formatCount(r.count)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100" aria-hidden="true">
                <div className={`h-2 rounded-full ${barClass(r.label)}`} style={{ width: `${barWidth(r.count, max)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Breakdowns({ byStatus, byPriority }: { byStatus: LabelCount[]; byPriority: LabelCount[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <BreakdownCard title="By status" rows={byStatus} barClass={l => (STATUS_STYLES[l] ?? STATUS_FALLBACK).solid} />
      <BreakdownCard title="By priority" rows={byPriority} barClass={l => (PRIORITY_STYLES[l] ?? PRIORITY_FALLBACK).solid} />
    </div>
  )
}
