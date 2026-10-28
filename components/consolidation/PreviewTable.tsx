// The paged preview of the consolidated tickets.
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { DASH, formatSurvey } from '@/lib/consolidation'
import { formatDateTimeText, formatDuration } from '@/lib/format'
import { PRIORITY_FALLBACK, PRIORITY_STYLES, statusBadgeClass } from '@/lib/styles'
import type { ConsolidationTicket } from '@/types/consolidation'

const TH = 'px-4 py-3 text-left text-xs font-medium text-gray-500'

function nameParts(full: string | null) {
  const [first = '', ...rest] = (full ?? '').trim().split(/\s+/)
  return { first, last: rest.join(' ') }
}

export function SlaCell({ value }: { value: boolean | null }) {
  if (value === null) return <span>{DASH}</span>
  return value ? (
    <span className="inline-flex items-center gap-1 text-green-700">
      <Check size={14} aria-hidden="true" />
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-700">
      <X size={14} aria-hidden="true" />
      No
    </span>
  )
}

export default function PreviewTable({
  tickets,
  refreshing,
}: {
  tickets: ConsolidationTicket[]
  /** A page change is loading: dim the rows instead of swapping to a skeleton. */
  refreshing?: boolean
}) {
  return (
    <div
      aria-busy={refreshing || undefined}
      className={`overflow-x-auto rounded-xl border border-gray-200 bg-white transition-opacity ${refreshing ? 'opacity-60' : ''}`}
    >
      <table className="w-full min-w-[960px] text-sm">
        <caption className="sr-only">Consolidated tickets</caption>
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th scope="col" className={`${TH} sticky left-0 bg-gray-50`}>Ticket no.</th>
            <th scope="col" className={TH}>Requested</th>
            <th scope="col" className={TH}>Requester</th>
            <th scope="col" className={TH}>Concern type</th>
            <th scope="col" className={TH}>Priority</th>
            <th scope="col" className={TH}>Status</th>
            <th scope="col" className={TH}>Handled by</th>
            <th scope="col" className={`${TH} text-right`}>Resolution time</th>
            <th scope="col" className={TH}>Within SLA</th>
            <th scope="col" className={TH}>Survey</th>
            <th scope="col" className={TH}>Action taken</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(t => {
            const handler = nameParts(t.handled_by)
            const priority = t.priority ? (PRIORITY_STYLES[t.priority] ?? PRIORITY_FALLBACK) : null
            return (
              <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="sticky left-0 bg-white px-4 py-3">
                  <Link href={`/tickets/${t.id}`} className="font-medium text-blue-700 hover:underline">
                    {t.ticket_number}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDateTimeText(t.requested_at)}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-800">{t.requester || DASH}</p>
                  {t.requesting_area && <p className="text-xs text-gray-500">{t.requesting_area}</p>}
                </td>
                <td className="px-4 py-3 text-gray-700">{t.concern_type || DASH}</td>
                <td className="px-4 py-3">
                  {t.priority && priority ? (
                    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${priority.pill}`}>
                      {t.priority}
                    </span>
                  ) : (
                    DASH
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`${statusBadgeClass(t.status)} px-2.5`}>{t.status}</span>
                </td>
                <td className="px-4 py-3">
                  {t.handled_by ? (
                    <span className="flex items-center gap-2">
                      <Avatar firstName={handler.first} lastName={handler.last} size="sm" />
                      <span className="text-gray-800">{t.handled_by}</span>
                    </span>
                  ) : (
                    DASH
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatDuration(t.resolution_minutes)}</td>
                <td className="px-4 py-3"><SlaCell value={t.within_sla} /></td>
                <td className="px-4 py-3 tabular-nums text-gray-700">{formatSurvey(t.survey_score)}</td>
                <td className="px-4 py-3 text-gray-700">
                  {t.action_taken ? (
                    <span className="block max-w-[16rem] truncate" title={t.action_taken}>
                      {t.action_taken}
                    </span>
                  ) : (
                    DASH
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
