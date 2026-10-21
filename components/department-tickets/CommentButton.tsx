import { MessageSquare } from 'lucide-react'

export default function CommentButton({
  count,
  onClick,
  label = 'Actions taken',
}: {
  count?: number
  onClick?: () => void
  /** Accessible name; include the ticket number where several buttons share a page. */
  label?: string
}) {
  const hasCount = count !== undefined && count > 0

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasCount ? `${label} (${count})` : label}
      className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <MessageSquare size={14} aria-hidden="true" />
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
