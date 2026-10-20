import { Suspense } from 'react'
import AdminResourcePage from '@/components/admin/AdminResourcePage'
import { getAdminResource } from '@/lib/adminResources'
import { TableSkeleton } from '@/components/ui/Skeleton'

// useSearchParams (inside AdminResourcePage) needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 sm:px-6 py-6"><TableSkeleton rows={8} columns={5} /></div>}>
      <AdminResourcePage resource={getAdminResource('departments')} />
    </Suspense>
  )
}
