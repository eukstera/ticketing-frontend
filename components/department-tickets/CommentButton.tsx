import { MessageSquare } from 'lucide-react'
import { commentsLabel } from '@/lib/format'

export default function CommentButton({
  ticketNumber,
  count,
  onClick,
}: {
  /** Used in the accessible name; several of these buttons share a page. */
  ticketNumber: string
  count?: number
  onClick?: () => void
}) {
  const hasCount = typeof count === 'number' && count > 0

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={commentsLabel(ticketNumber, count)}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <MessageSquare size={16} aria-hidden="true" />
      {hasCount && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-medium flex items-center justify-center leading-none"
        >
          {count}
        </span>
      )}
    </button>
  )
}
