import { useId } from 'react'
import { DashboardStats } from '@/lib/dashboard'
import { useRouter } from 'next/navigation'
import { inputAuto } from '@/lib/styles'

export default function DashboardFilters({
  month,
  onMonthChange,
  stats
}: {
  // unused; callers may still pass them
  priorityFilter?: string | null
  onPriorityChange?: (value: string | null) => void
  month: string
  onMonthChange: (value: string) => void
  stats: DashboardStats['priority_stats']
}) {

  const router = useRouter()
  const monthId = useId()
  const pills = stats ?? []

  return (
    <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center lg:justify-between">
      {/* Nothing to link to (e.g. an empty database): skip the row instead of leaving a gap. */}
      {pills.length > 0 && (
        <div role="group" aria-label="View tickets by priority" className="flex flex-wrap items-center gap-2">
          {pills.map((pill) => {
            return (
              <button
                key={pill.priority_id}
                type="button"
                onClick={() => {
                  router.push(`/tickets?priority=${encodeURIComponent(pill.level)}`)
                }}
                className="whitespace-nowrap rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600 transition hover:border-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {pill.level}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 lg:ml-auto">
        <label htmlFor={monthId} className="text-sm text-gray-500">
          Default date is by current month
        </label>
        <input
          id={monthId}
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className={`${inputAuto} !w-full sm:!w-auto`}
        />
      </div>
    </div>
  )
}
