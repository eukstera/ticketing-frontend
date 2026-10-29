// types/consolidation.ts
// Shapes of GET /reports/consolidated and /reports/consolidated/options.
import type { PaginatedResponse } from '@/types'

export interface ConsolidationOption {
  /** requesting_areas use the area name (free text) as the id. */
  id: number | string
  name: string
  sla_days?: number
}

export interface ConsolidationOptions {
  statuses: ConsolidationOption[]
  priorities: ConsolidationOption[]
  concern_types: ConsolidationOption[]
  requesting_areas: ConsolidationOption[]
  staff: ConsolidationOption[]
  date_fields: ConsolidationOption[]
}

export interface ConsolidationSummary {
  total: number
  completed: number
  within_sla_percent: number | null
  avg_resolution_minutes: number | null
  overdue: number
  false_alarm_rate_percent: number | null
  false_alarms: number
  avg_satisfaction: number | null
  disputes: number
  /** Voided blank job orders (already included in `total`). Absent on older servers. */
  voided?: number | null
}

export interface LabelCount {
  id?: number
  label: string
  count: number
}

export interface ConsolidationBreakdowns {
  by_status: LabelCount[]
  by_priority: LabelCount[]
  by_requesting_area?: { name: string; count: number }[]
  by_concern_type?: { name: string; count: number }[]
}

export interface ConsolidationTicket {
  id: number
  ticket_number: string
  requested_at: string
  requester: string | null
  requesting_area: string | null
  concern_type: string | null
  priority: string | null
  status: string
  handled_by: string | null
  completed_at: string | null
  resolution_minutes: number | null
  within_sla: boolean | null
  is_overdue: boolean
  survey_score: number | null
  disputed: boolean
  action_taken: string | null
  /** A voided blank job order: requester, priority, area and concern are empty; requested_at is the print date. */
  is_void?: boolean
  void_reason?: string | null
  voided_at?: string | null
}

export interface ConsolidationReport {
  summary: ConsolidationSummary
  breakdowns?: ConsolidationBreakdowns
  tickets: PaginatedResponse<ConsolidationTicket>
}
