import { DashboardStats } from '@/lib/dashboard'
import { useRouter } from 'next/navigation'

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

  return (
    <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {(stats ?? []).map((pill) => {
          return (
            <button
              key={pill.priority_id}
              onClick={() => {
                sessionStorage.setItem('ticketStatusFilter', JSON.stringify({type: 'priority', level: pill.level}))
                router.push('/tickets')
              }}
              className="whitespace-nowrap rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600 transition hover:border-gray-400"
            >
              {pill.level}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-sm text-gray-500">Default date is by current month</span>
        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none sm:w-auto"
        />
      </div>
    </div>
  )
}