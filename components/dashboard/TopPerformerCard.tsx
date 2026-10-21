import { DashboardStats } from '@/lib/dashboard'

export default function TopPerformerCard({ performers }: { performers: DashboardStats['top_performers'] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-800">Top Performer</h2>
      <div className="mt-4 max-h-64 space-y-4 overflow-y-auto pr-2">
        {performers.map((p) => (
          <div key={p.user_id} className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
              {p.rank}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800">{p.name}</div>
              <div className="text-xs text-gray-500">
                {p.in_progress} In-progress &middot; {p.completed} Completed
              </div>
            </div>
          </div>
        ))}
        {performers.length === 0 && (
          <p className="text-sm text-gray-500">No completed tickets yet this period.</p>
        )}
      </div>
    </div>
  )
}
