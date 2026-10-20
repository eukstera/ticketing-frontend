import { PriorityPill, StatusPill } from '@/lib/departmentTickets'
import { FALLBACK_COLOR, PRIORITY_PALETTE, STATUS_PILL_DEFS } from '@/lib/styles'
import { PriorityCount, StatusCount } from '@/lib/ticketList'

// Pill `value` is the id as a string (null for "All"), which is what the URL
// params and FilterPills' selected-state comparison both use.
export function buildStatusPills(counts: StatusCount[]): StatusPill[] {
  return counts.map(c => {
    const def = STATUS_PILL_DEFS.find(d => d.label === c.label)
    return {
      label: c.label,
      value: c.id === null ? null : String(c.id),
      count: c.count,
      color: def?.color ?? FALLBACK_COLOR,
    }
  })
}

export function buildPriorityPills(counts: PriorityCount[]): PriorityPill[] {
  return counts.map(c => ({
    priority_id: c.id,
    label: c.level,
    value: String(c.id),
    count: c.count,
    color: PRIORITY_PALETTE[c.level] ?? FALLBACK_COLOR,
    sla: c.sla_days,
  }))
}
