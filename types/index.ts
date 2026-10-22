export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  designation_id: number
  department_id: number
  role_id: number
  status: boolean
}

export interface AuthResponse {
  success: boolean
  message: string
  result:{
    user: User,
    token: string
  }
  errors?: Record<string, string[]>
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
  /** Only the "False Alarm Date" entry carries one: the reason it was rejected. */
  remarks?: string | null
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
  department_id: number
  status_id?: number // Phase 2 BE
  priority_id?: number // Phase 2 BE
  date_activities: DateActivity[]
  requested_activity: ActivityInfo | null
  assigned_activity: ActivityInfo | null
  completed_activity: ActivityInfo | null
  /** The rejection (who, when, reason) for a False Alarm row; null otherwise. */
  false_alarm_activity?: FalseAlarmActivity | null
  priority_sla?: number | null
  comments_count?: number
  devices: Device[]
}

export interface FalseAlarmActivity {
  created_at: string
  user: string | null
  remarks: string | null
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


// GET /tickets/{ticket} (Phase 2 contract)
export interface PersonRef {
  id: number
  first_name: string
  last_name: string
}

export interface FalseAlarmInfo {
  reason: string
  /** null when the user who rejected it no longer exists. */
  marked_by: PersonRef | null
  marked_at: string
}

export interface TicketDetailDevice {
  name: string
  qty: number
}

// IT and Engineering tickets share one envelope; fields that belong to the
// other department are simply absent.
export interface TicketDetails {
  name_of_area?: string | null
  area_supervisor?: string | null
  // IT
  type_of_concern?: string | null
  type_of_tech_support?: string | null
  remarks?: string | null
  devices?: TicketDetailDevice[]
  // Engineering
  nature_of_work?: string | null
  other_nature_of_work?: string | null
  scope_of_work?: string | null
}

export interface TicketDetailComment {
  id: number
  comment: string
  user: PersonRef
  created_at: string
  updated_at: string
}

export interface TicketDetail {
  id: number
  ticket_number: string
  department: { id: number; name: string }
  status: { id: number; label: string }
  priority: { id: number; level: string; sla_days: number }
  type: 'IT' | 'Engineering'
  details: TicketDetails
  /** Requestor-portal tickets only carry a name. */
  requester: PersonRef | { name: string }
  assignee: PersonRef | null
  is_overdue: boolean
  due_at: string | null
  timeline: {
    id: number
    category: 'Requested Date' | 'Assigned Date' | 'Completed Date' | 'False Alarm Date'
    user: string | null
    created_at: string
    remarks?: string | null
  }[]
  /** Set once the request was rejected as a false alarm; null otherwise. */
  false_alarm?: FalseAlarmInfo | null
  comments: TicketDetailComment[]
  created_at: string
  updated_at: string
}
