export interface StatusPill {
  label: string
  value: string | null
  count: number
  color: string
}

export interface PriorityPill {
  priority_id: number
  label: string
  value: string
  count: number
  color: string
  sla?: number
}