import { DashboardStats } from '@/lib/dashboard'
import { percentOf, safeCount } from '@/lib/format'

export default function TodaysTicketCard({ data }: { data: DashboardStats['todays_ticket'] }) {
  const total = safeCount(data.total)
  // Derived from the counts so an empty day reads 0%, never NaN or a stale server value.
  const percent = percentOf(safeCount(data.completed), total)
  return (
    <div className="flex items-center justify-between gap-4 bg-white rounded-xl border border-gray-200 p-6">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Today&apos;s Ticket</h2>
        <p className="mt-1 text-sm text-gray-500">Tickets assigned to your department today.</p>
      </div>
      {total === 0 ? (
        // No tickets today: a "0%" would read as a result, so say it plainly.
        <p className="shrink-0 text-right text-sm text-gray-500">No tickets today</p>
      ) : (
        <div className="text-right">
          <div className="text-3xl font-semibold text-blue-600">{total}</div>
          <div className="mt-1 text-sm font-medium text-green-700">
            {percent}% Completed
          </div>
        </div>
      )}
    </div>
  )
}
