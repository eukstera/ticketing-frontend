import { DashboardStats } from '@/lib/dashboard'
import { percentOf, safeCount } from '@/lib/format'

export default function TodaysTicketCard({ data }: { data: DashboardStats['todays_ticket'] }) {
  const total = safeCount(data.total)
  // Derived from the counts so an empty day reads 0%, never NaN or a stale server value.
  const percent = percentOf(safeCount(data.completed), total)
  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-6">
      <div>
        <h3 className="text-base font-semibold text-gray-800">Today&apos;s Ticket</h3>
        <p className="mt-1 text-sm text-gray-500">Tickets assigned to your department today.</p>
      </div>
      <div className="text-right">
        <div className="text-3xl font-semibold text-blue-600">{total}</div>
        <div className="mt-1 text-sm font-medium text-green-600">
          {percent}% Completed
        </div>
      </div>
    </div>
  )
}
