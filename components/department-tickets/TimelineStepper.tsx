import { DateActivity } from '@/types'
import { fullTimelineSequence } from '@/lib/styles'

export default function TimelineStepper({ activities }: { activities: DateActivity[] }) {
  const steps = fullTimelineSequence.map(step => {
    const activity = activities?.find(a => a.date_category.category.includes(step.match))
    return activity ? { ...step, activity } : { ...step, activity: null }
  })

  const hasAnyActivity = steps.some(s => s.activity)
  if (!hasAnyActivity) {
    return <p className="text-sm text-gray-500">No timeline activity yet</p>
  }

  return (
    // Stacked (vertical) below sm, horizontal stepper from sm up
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
                {step.icon}
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
  )
}