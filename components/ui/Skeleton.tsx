// components/ui/Skeleton.tsx
// Loading placeholders that match the table / card shells they stand in for.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

// Varied widths so rows don't look like a barcode
const CELL_WIDTHS = ['w-6', 'w-20', 'w-32', 'w-24', 'w-20', 'w-16', 'w-28', 'w-20', 'w-16', 'w-8']

export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="bg-white rounded-xl border border-gray-200 overflow-x-auto"
    >
      <span className="sr-only">Loading…</span>
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {Array.from({ length: columns }, (_, c) => (
              <th key={c} className="px-4 py-3">
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c} className="px-4 py-3">
                  <Skeleton className={`h-4 ${CELL_WIDTHS[c % CELL_WIDTHS.length]}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CardSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`bg-white rounded-xl border border-gray-200 p-4 sm:p-6 ${className}`}
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}
