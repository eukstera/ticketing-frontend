import { api } from './api'

export interface Employee {
  id: number
  department_id: number
  first_name: string
  last_name: string
  designation: string
}

// departmentId is optional; the BE defaults to the caller's department.
export function getEmployees(departmentId?: number, signal?: AbortSignal) {
  const qs = departmentId ? `?department_id=${departmentId}` : ''
  return api.get<{ result: { users: Employee[] } }>(`/employees${qs}`, { signal })
}
