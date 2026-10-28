import { Suspense } from 'react'
import ConsolidationPage from '@/components/consolidation/ConsolidationPage'
import { TableSkeleton } from '@/components/ui/Skeleton'

// useSearchParams (inside ConsolidationPage) needs a Suspense boundary.
export default function ConsolidatedReportPage() {
  return (
    <Suspense fallback={<main id="main" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6"><TableSkeleton rows={8} columns={11} /></main>}>
      <ConsolidationPage />
    </Suspense>
  )
}
