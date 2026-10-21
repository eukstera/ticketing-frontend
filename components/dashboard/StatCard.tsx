'use client'

import { useRouter } from 'next/navigation'
import { STATUS_FALLBACK, STATUS_STYLES } from '@/lib/styles'

export default function StatCard({
  value,
  label,
  status,
}: {
  value: number
  label: string
  color?: string // unused; callers may still pass it
  status: string
}) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        router.push(`/tickets?status=${encodeURIComponent(status)}`)
      }}
      className={`block text-left w-full rounded-xl border px-4 py-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:px-6 sm:py-5 ${(STATUS_STYLES[status] ?? STATUS_FALLBACK).card}`}
    >
      <div className="text-2xl font-semibold sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-gray-700 sm:text-sm">{label}</div>
    </button>
  )
}
