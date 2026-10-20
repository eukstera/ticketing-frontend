import { api } from './api'

export interface Priority {
  id: number
  level: string
  sla_days: number
  department_id: number
}

export interface LookupItem {
  id: number
  label: string
}

// departmentId is optional; the BE defaults to the caller's department.
export function getPriorities(departmentId?: number, signal?: AbortSignal) {
  const qs = departmentId ? `?department_id=${departmentId}` : ''
  return api.get<{ result: { priorities: Priority[] } }>(`/priority${qs}`, { signal })
}

export function getConcernTypes(signal?: AbortSignal) {
  return api.get<{ result: { concern_types: LookupItem[] } }>('/lookups/concern-types', { signal })
}

export function getNatureOfWork(signal?: AbortSignal) {
  return api.get<{ result: { nature_of_work: LookupItem[] } }>('/lookups/nature-of-work', { signal })
}
