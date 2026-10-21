import { PriorityPill, StatusPill } from '@/lib/departmentTickets'
import { PRIORITY_FALLBACK, PRIORITY_STYLES, STATUS_ALL, STATUS_STYLES } from '@/lib/styles'
import { PriorityCount, StatusCount } from '@/lib/ticketList'

// Pill `value` is the id as a string (null for "All"), which is what the URL
// params and FilterPills' selected-state comparison both use.
export function buildStatusPills(counts: StatusCount[]): StatusPill[] {
  return counts.map(c => {
    return {
      label: c.label,
      value: c.id === null ? null : String(c.id),
      count: c.count,
      color: (c.id === null ? STATUS_ALL : (STATUS_STYLES[c.label] ?? STATUS_ALL)).pill,
    }
  })
}

export function buildPriorityPills(counts: PriorityCount[]): PriorityPill[] {
  return counts.map(c => ({
    priority_id: c.id,
    label: c.level,
    value: String(c.id),
    count: c.count,
    color: (PRIORITY_STYLES[c.level] ?? PRIORITY_FALLBACK).pill,
    sla: c.sla_days,
  }))
}
