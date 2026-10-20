const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

export default function Pagination({
  currentPage,
  lastPage,
  total,
  onPageChange,
  noun = 'tickets',
}: {
  currentPage: number
  lastPage: number
  total: number
  onPageChange: (page: number) => void
  /** Label for the total, e.g. 'users'. */
  noun?: string
}) {
  const pages = Array.from({ length: lastPage }, (_, i) => i + 1)
    .filter(p => p === 1 || p === lastPage || Math.abs(p - currentPage) <= 1)
    .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
      acc.push(p)
      return acc
    }, [])

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p aria-live="polite" className="text-sm text-gray-500">
        Page {currentPage} of {lastPage} &middot; {total} {noun}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition ${FOCUS_RING}`}
        >
          Previous
        </button>
        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} aria-hidden="true" className="px-2 text-sm text-gray-500">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition ${FOCUS_RING} ${
                p === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === lastPage}
          className={`px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition ${FOCUS_RING}`}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
