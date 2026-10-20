'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/NavBar'
import { getDashboardStats, DashboardStats } from '@/lib/dashboard'
import { isAuthenticated } from '@/lib/auth'
import DashboardFilters from '@/components/dashboard/DashboardFilters'
import StatCard from '@/components/dashboard/StatCard'
import PriorityStatistics from '@/components/dashboard/PriorityStatistics'
import TodaysTicketCard from '@/components/dashboard/TodaysTicketCard'
import TopPerformerCard from '@/components/dashboard/TopPerformerCard'

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

export default function HomePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null)
  const [month, setMonth] = useState(currentMonth())

  useEffect(() => {
    setMounted(true)
    if (!isAuthenticated()) {
      router.push('/auth/login')
      return
    }
  }, [router])

  useEffect(() => {
    if (!mounted) return
    fetchStats()
  }, [mounted, priorityFilter, month])

  async function fetchStats() {
    setLoading(true)
    setError('')
    try {
      const res = await getDashboardStats({ priority: priorityFilter, date: month })
      setStats(res.result)
    } catch (err) {
      console.error(err)
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <DashboardFilters
          priorityFilter={priorityFilter}
          onPriorityChange={setPriorityFilter}
          month={month}
          onMonthChange={setMonth}
          stats={stats?.priority_stats ?? []}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <p className="mb-3 text-sm text-gray-500">Overall tickets assigned to your department</p>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-5">
              <StatCard value={stats?.overview.open ?? 0} label="Open" color="blue" status="Open" />
              <StatCard value={stats?.overview.in_progress ?? 0} label="In-progress" color="amber" status="In-progress" />
              <StatCard value={stats?.overview.completed ?? 0} label="Completed" color="green" status="Completed" />
              <StatCard value={stats?.overview.overdue ?? 0} label="Overdue" color="red" status="Overdue" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <PriorityStatistics stats={stats?.priority_stats ?? []} />
                <TodaysTicketCard
                  data={stats?.todays_ticket ?? { total: 0, completed: 0, percent_completed: 0 }}
                />
              </div>
              <TopPerformerCard performers={stats?.top_performers ?? []} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}