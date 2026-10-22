// lib/dashboard.ts
import { api } from './api'

export interface DashboardOverview {
  open: number
  in_progress: number
  completed: number
  overdue: number
  /** Rejected requests; absent from servers that predate the False alarm status. */
  false_alarm?: number
}

export interface DashboardPriorityStats {
  priority_id: number 
  level: string
  count: number
}

export interface DashboardTodaysTicket {
  total: number
  completed: number
  percent_completed: number
}

export interface DashboardTopPerformer {
  rank: number
  user_id: number
  name: string
  in_progress: number
  completed: number
}

export interface DashboardStats {
  overview: DashboardOverview
  priority_stats: DashboardPriorityStats[]
  todays_ticket: DashboardTodaysTicket
  top_performers: DashboardTopPerformer[]
}

export interface DashboardStatsResponse {
    message: string
    result: DashboardStats
}

export function getDashboardStats(params?: {
  priority?: string | null
  date?: string | null // Y-m; a malformed value returns 422
  signal?: AbortSignal
}) {
  const query = new URLSearchParams()
  if (params?.priority) query.set('priority', params.priority)
  if (params?.date) query.set('date', params.date)

  const qs = query.toString()
  return api.get<DashboardStatsResponse>(`/dashboard${qs ? `?${qs}` : ''}`, {
    signal: params?.signal,
  })
}
