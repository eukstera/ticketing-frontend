'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/NavBar'
import { getDashboardStats, DashboardStats } from '@/lib/dashboard'
import { getErrorMessage, isAbortError } from '@/lib/api'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import DashboardFilters from '@/components/dashboard/DashboardFilters'
import StatCard from '@/components/dashboard/StatCard'
import PriorityStatistics from '@/components/dashboard/PriorityStatistics'
import TodaysTicketCard from '@/components/dashboard/TodaysTicketCard'
import TopPerformerCard from '@/components/dashboard/TopPerformerCard'
import Link from 'next/link'
import ErrorState from '@/components/ui/ErrorState'
import { monthLabel } from '@/lib/format'
import { CardSkeleton } from '@/components/ui/Skeleton'

// Local-time YYYY-MM (toISOString would use UTC and be off near month ends).
function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

interface StatsResult {
  key: string
  stats: DashboardStats | null
  error: string
}

export default function HomePage() {
  const authed = useAuthGuard()
  const [month, setMonth] = useState(currentMonth)
  const [reloadToken, setReloadToken] = useState(0)
  const [result, setResult] = useState<StatsResult | null>(null)

  const requestKey = `${month}|${reloadToken}`
  const loading = result?.key !== requestKey
  const stats = result?.stats ?? null
  const error = loading ? '' : result?.error ?? ''

  useEffect(() => {
    if (!authed) return
    const controller = new AbortController()
    getDashboardStats({ date: month, signal: controller.signal })
      .then(res => setResult({ key: requestKey, stats: res.result, error: '' }))
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setResult({ key: requestKey, stats: null, error: getErrorMessage(err, 'Failed to load dashboard') })
      })
    return () => controller.abort()
  }, [authed, month, requestKey])

  if (!authed) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main" className="max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <h1 className="sr-only">Dashboard</h1>
        <DashboardFilters
          month={month}
          onMonthChange={setMonth}
          stats={stats?.priority_stats ?? []}
        />

        <p className="mb-3 text-sm text-gray-500">Overall tickets assigned to your department</p>

        {loading ? (
          <div aria-busy="true">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map(i => <CardSkeleton key={i} lines={2} />)}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <CardSkeleton lines={4} />
              <CardSkeleton lines={3} />
            </div>
            <CardSkeleton lines={6} />
          </div>
          </div>
        ) : error || !stats ? (
          <ErrorState message={error || 'Failed to load dashboard'} onRetry={() => setReloadToken(t => t + 1)} />
        ) : (
          <>
            {Object.values(stats.overview).every(n => !n) && (
              <p className="mb-3 text-sm text-gray-600">
                No tickets for {monthLabel(month)} yet.{' '}
                <Link href="/tickets/create" className="font-medium text-blue-700 hover:underline">
                  Create a ticket
                </Link>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-6">
              <StatCard value={stats.overview.open} label="Open" status="Open" />
              <StatCard value={stats.overview.in_progress} label="In-progress" status="In-progress" />
              <StatCard
                value={stats.overview.pending_confirmation ?? 0}
                label="Pending confirmation"
                status="Pending Confirmation"
              />
              <StatCard value={stats.overview.completed} label="Completed" status="Completed" />
              <StatCard value={stats.overview.overdue} label="Overdue" status="Overdue" />
              <StatCard value={stats.overview.false_alarm ?? 0} label="False alarm" status="False Alarm" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <PriorityStatistics stats={stats.priority_stats} />
                <TodaysTicketCard
                  data={stats.todays_ticket}
                />
              </div>
              <TopPerformerCard performers={stats.top_performers} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
