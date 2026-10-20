import { Suspense } from 'react'
import TicketListPage from '@/components/tickets/TicketListPage'
import { TableSkeleton } from '@/components/ui/Skeleton'

// useSearchParams (inside TicketListPage) needs a Suspense boundary.
export default function DepartmentTicketsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6"><TableSkeleton rows={8} columns={10} /></div>}>
      <TicketListPage mode="department" />
    </Suspense>
  )
}
