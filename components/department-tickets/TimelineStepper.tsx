import { Pencil, Printer, XCircle } from 'lucide-react'
import { DateActivity } from '@/types'
import { falseAlarmTimelineSequence, fullTimelineSequence, type TimelineStep } from '@/lib/styles'
import { isRejectedNow, latestActivity } from '@/lib/falseAlarm'
import { currentDispute } from '@/lib/confirmation'

// Rejections, reopens, completions and the requester's replies can repeat, so
// the steps show the latest entry of each category and the full back-and-forth
// is listed under the stepper. A completion only appears there when it carries
// notes (the steps already show when it happened).
const HISTORY_CATEGORY = /False Alarm|Reopened|Confirmed|Disputed|Auto-closed/

// Blank job orders: printed first, then either filled in (and a normal ticket
// from there) or voided.
const PRINTED_STEP: TimelineStep = { match: 'Blank JO Printed', label: 'Blank JO Printed', bg: 'bg-slate-100 text-slate-600', icon: Printer }
const FILLED_IN_STEP: TimelineStep = { match: 'Filled In', label: 'Filled In Date', bg: 'bg-blue-100 text-blue-600', icon: Pencil }
const VOID_STEP: TimelineStep = { match: 'Void', label: 'Void Date', bg: 'bg-gray-200 text-gray-600', icon: XCircle }

function timelineSequence(activities: DateActivity[], rejected: boolean): TimelineStep[] {
  const has = (match: string) => !!latestActivity(activities, match)
  if (!has(PRINTED_STEP.match)) return rejected ? falseAlarmTimelineSequence : fullTimelineSequence
  const base = rejected ? falseAlarmTimelineSequence : fullTimelineSequence
  // Not filled in yet: nothing of the normal request path has happened.
  if (!has(FILLED_IN_STEP.match) && !has('Requested')) {
    return [PRINTED_STEP, ...(has(VOID_STEP.match) ? [VOID_STEP] : []), ...(rejected ? base.filter(step => step.match === 'False Alarm') : [])]
  }
  return [PRINTED_STEP, ...(has(FILLED_IN_STEP.match) ? [FILLED_IN_STEP] : []), ...base]
}

const TONES = {
  violet: 'bg-violet-50 text-violet-900',
  green: 'bg-green-50 text-green-900',
  amber: 'bg-amber-50 text-amber-900',
  gray: 'bg-gray-100 text-gray-800',
  teal: 'bg-teal-50 text-teal-900',
} as const

function describeEntry(entry: DateActivity): { title: string; tone: keyof typeof TONES; remarkLabel: string } {
  const category = entry.date_category.category
  const by = entry.user ? ` by ${entry.user}` : ''
  if (category.includes('Reopened')) return { title: `Reopened${by}`, tone: 'green', remarkLabel: 'Reason' }
  if (category.includes('False Alarm')) {
    return { title: `Rejected as false alarm${by}`, tone: 'violet', remarkLabel: 'Reason' }
  }
  if (category.includes('Disputed')) return { title: 'Disputed by the requester', tone: 'amber', remarkLabel: 'Reason' }
  if (category.includes('Confirmed')) {
    return { title: entry.user ? `Confirmed by ${entry.user}` : 'Confirmed by the requester', tone: 'green', remarkLabel: 'Note' }
  }
  if (category.includes('Auto-closed')) return { title: 'Closed automatically', tone: 'gray', remarkLabel: 'Note' }
  return { title: `Completed${by}`, tone: 'teal', remarkLabel: 'Action taken' }
}

function historyOf(activities: DateActivity[] | undefined): DateActivity[] {
  return (activities ?? [])
    .map((a, index) => ({ a, index }))
    .filter(
      ({ a }) =>
        HISTORY_CATEGORY.test(a.date_category.category) ||
        (a.date_category.category.includes('Completed') && !!a.remarks)
    )
    .sort((x, y) => Date.parse(x.a.created_at) - Date.parse(y.a.created_at) || x.index - y.index)
    .map(({ a }) => a)
}

export default function TimelineStepper({ activities }: { activities: DateActivity[] }) {
  // A request that is a false alarm right now ends there (no Assigned/Completed
  // steps); once reopened it follows the normal path again.
  const rejected = isRejectedNow(activities)
  const sequence = timelineSequence(activities, rejected)
  // A requester's dispute sends the ticket back to work: it isn't completed again until the next completion.
  const disputed = !!currentDispute(activities)
  const steps = sequence.map(step => {
    const activity = step.match === 'Completed' && disputed ? undefined : latestActivity(activities, step.match)
    return activity ? { ...step, activity } : { ...step, activity: null }
  })
  const history = historyOf(activities)

  const hasAnyActivity = steps.some(s => s.activity)
  if (!hasAnyActivity) {
    return <p className="text-sm text-gray-500">No timeline activity yet</p>
  }

  return (
    <>
    {/* Stacked (vertical) below sm, horizontal stepper from sm up */}
    <div className="flex flex-col items-start sm:flex-row sm:justify-center">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1
        const reached = !!step.activity

        const dateStr = step.activity
        ? new Date(step.activity.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null
      const timeStr = step.activity
        ? new Date(step.activity.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
        : null

        return (
          <div key={step.match} className="flex flex-col sm:flex-row sm:items-start">
            <div className="flex items-start gap-3 sm:flex-col sm:items-center sm:gap-0 sm:w-28 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 sm:mb-1 ${
                  reached ? step.bg : 'bg-gray-100 text-gray-500'
                }`}
              >
                <step.icon size={12} aria-hidden="true" />
              </div>
              <div className="flex flex-col min-w-0 text-left sm:items-center sm:text-center sm:w-full">
                {reached ? (
                  <>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      {dateStr} {timeStr}
                    </p>
                    <p className="text-xs text-gray-600 leading-tight truncate w-full">
                      {step.activity!.user ?? '—'}
                    </p>
                    <p className="text-xs font-semibold text-gray-800 leading-tight">
                      {step.label}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-gray-500 leading-tight">Pending</p>
                    <p className="hidden sm:block text-xs text-gray-500 leading-tight">&nbsp;</p>
                    <p className="text-xs font-medium text-gray-500 leading-tight">
                      {step.label}
                    </p>
                  </>
                )}
              </div>
            </div>
            {!isLast && (
              <div
                className={`shrink-0 w-px h-4 ml-3 sm:ml-0 sm:w-6 sm:h-px sm:mt-3 ${
                  reached ? 'bg-gray-300' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
    {history.length > 0 && (
      <ul aria-label="Ticket history" className="mt-3 space-y-2">
        {history.map(entry => {
          const { title, tone, remarkLabel } = describeEntry(entry)
          const when = new Date(entry.created_at)
          return (
            <li key={entry.id} className={`rounded-lg px-3 py-2 text-sm ${TONES[tone]}`}>
              <p className="font-medium">
                {title}
                <span className="font-normal opacity-80">
                  {' · '}
                  {when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                  {when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </p>
              {entry.remarks && (
                <p className="mt-0.5">
                  <span className="font-medium">{`${remarkLabel}: `}</span>
                  <span className="whitespace-pre-wrap">{entry.remarks}</span>
                </p>
              )}
            </li>
          )
        })}
      </ul>
    )}
    </>
  )
}