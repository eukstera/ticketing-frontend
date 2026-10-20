import { DashboardStats } from '@/lib/dashboard'
import { PRIORITY_COLOR_MAP } from '@/lib/styles'
import { PRIORITY_COLOR_MAP_FALLBACK_COLORS } from '@/lib/styles'


export default function PriorityStatistics({ stats }: { stats: DashboardStats['priority_stats'] }) {
  const max = Math.max(...stats.map((s) => s.count), 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <h3 className="text-base font-semibold text-gray-800">Priority Statistics</h3>
      <div className="mt-5 space-y-4">
        {stats.length === 0 ? (
          <p className="text-sm text-gray-400">No priority data available.</p>
        ) : (
          stats.map((row, i) => {
            const color = PRIORITY_COLOR_MAP[row.level] ?? PRIORITY_COLOR_MAP_FALLBACK_COLORS[i % PRIORITY_COLOR_MAP_FALLBACK_COLORS.length]
            return (
              <div key={row.priority_id} className="flex items-center gap-2 sm:gap-4">
                <span className="w-20 shrink-0 truncate text-sm text-gray-600 sm:w-40">{row.level}</span>
                <div className="h-2 min-w-0 flex-1 rounded-full bg-gray-100">
                  <div
                    className={`h-2 rounded-full ${color}`}
                    style={{ width: `${(row.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-4 shrink-0 text-right text-sm text-gray-700">{row.count}</span>
              </div>
            )
          })
        )}
      </div>
      <p className="mt-5 text-xs text-gray-400">
        Overall ticket priority status assigned to your department.
      </p>
    </div>
  )
}