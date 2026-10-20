import { DateActivity } from '@/types'
import { fullTimelineSequence } from '@/lib/styles'

export default function TimelineStepper({ activities }: { activities: DateActivity[] }) {
  const steps = fullTimelineSequence.map(step => {
    const activity = activities?.find(a => a.date_category.category.includes(step.match))
    return activity ? { ...step, activity } : { ...step, activity: null }
  })

  const hasAnyActivity = steps.some(s => s.activity)
  if (!hasAnyActivity) {
    return <p className="text-sm text-gray-400">No timeline activity yet</p>
  }

  return (
    <div className="flex justify-center">
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
          <div key={step.match} className="flex items-start">
            <div className="flex flex-col items-center w-25 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1 ${
                  reached ? step.bg : 'bg-gray-100 text-gray-300'
                }`}
              >
                {step.icon}
              </div>
              {reached ? (
                <>
                  <p className="text-[11px] text-gray-400 text-center leading-tight">
                    {dateStr} {timeStr}
                  </p>
                  <p className="text-xs text-gray-600 text-center leading-tight truncate w-full">
                    {step.activity!.user ?? '—'}
                  </p>
                  <p className="text-xs font-semibold text-gray-800 text-center leading-tight">
                    {step.label}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-gray-300 text-center leading-tight">Pending</p>
                  <p className="text-xs text-gray-300 text-center leading-tight">&nbsp;</p>
                  <p className="text-xs font-medium text-gray-300 text-center leading-tight">
                    {step.label}
                  </p>
                </>
              )}
            </div>
            {!isLast && (
              <div className={`w-6 h-px shrink-0 mt-3 ${reached ? 'bg-gray-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}