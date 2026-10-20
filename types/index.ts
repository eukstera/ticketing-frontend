export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  designation_id: string
  department_id: number
  role_id: number
  status: boolean
}

export interface Ticket {
  id: number
  status_id: number
  priority_id: number
  department: string
  area_supervisor: string
  assigned_user?: number
  status: boolean
  created_at: string
  updated_at: string
  subject?: string
  description?: string
  priority?: { label: string; slug: string }
  ticket_status?: { label: string; slug: string }
}

export interface TicketStatus {
  id: number
  label: string
  slug: string
}

export interface Priority {
  id: number
  label: string
  slug: string
  level: number
}

export interface AuthResponse {
  success: boolean
  message: string
  result:{
    user: User,
    token: string
  }
  errors: Record<string, | string[]>
}

// types/index.ts
export interface DateActivity {
  id: number
  ticket_id: number
  date_category_id: number
  user_id: number
  status: number
  created_at: string
  date_category: { id: number; category: string }
  user: string | null
}

export interface DepartmentTicket {
  id: number
  ticket_number: string
  type_of_tech_support: string | null
  type_of_concern: string | null
  nature_of_work: string | null
  scope_of_work: string | null
  name_of_area: string
  remarks: string
  area_supervisor: string
  status: string
  priority: string
  department: string
  date_activities: DateActivity[]
  requested_activity: ActivityInfo | null
  assigned_activity: ActivityInfo | null
  completed_activity: ActivityInfo | null
  comments_count?: number
  status_counts: Record<string, number>
  priority_counts: Record<string, number>
  devices: Device[]
}

export interface ActivityInfo {
  id: number
  created_at: string
  user: string
  user_id: number
}

export interface PaginatedResponse<T> {
  current_page: number
  data: T[]
  last_page: number
  total: number
  per_page: number
}

export interface DepartmentTicketsResponse {
  message: string
  result: {
    ticket: PaginatedResponse<DepartmentTicket>
    status_counts: Record<string, number>
    priority_counts: Record<string, number>
    priority_sla: Record<string, number>
  }
}

export interface Device {
  id: number
  ticket_id: number
  device: string
  qty: number
  status: number
}

export interface LoginForm {
  email: string,
  password: string
}

export interface RegisterForm {
  first_name: string
  last_name: string
  email: string
  password: string
  designation_id: number
  department_id: number
  role_id: number
}

