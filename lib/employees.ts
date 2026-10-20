import { api } from './api'

export interface Employee {
  id: number
  department_id: number
  first_name: string
  last_name: string
  designation: string
  email: string
}

export function getEmployees() {
  return api.get<{ result: { users: Employee[] } }>('/employees')
}
