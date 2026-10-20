export default function CommentButton({ count, onClick }: { count?: number; onClick?: () => void }) {
  return (
    <button
      className="relative inline-flex items-center justify-center w-6 h-6 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition mx-auto"
      onClick={onClick}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {count !== undefined && count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center leading-none">
          {count}
        </span>
      )}
    </button>
  )
}
