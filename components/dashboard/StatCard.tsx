'use client'

import { useRouter } from 'next/navigation'
import { STAT_CARD_THEME } from '@/lib/styles'

export default function StatCard({
  value,
  label,
  status,
}: {
  value: number
  label: string
  color?: string // unused; callers may still pass it
  status: keyof typeof STAT_CARD_THEME
}) {
  const router = useRouter()

  return (
    <button
      onClick={() => {
        router.push(`/tickets?status=${encodeURIComponent(status)}`)
      }}
      className={`block text-left w-full rounded-xl border px-4 py-4 transition sm:px-6 sm:py-5 ${STAT_CARD_THEME[status]}`}
    >
      <div className="text-2xl font-semibold sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-gray-600 sm:text-sm">{label}</div>
    </button>
  )
}