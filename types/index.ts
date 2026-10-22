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
  /** The latest reopen (who, when, why); null if never reopened. */
  reopened_activity?: FalseAlarmActivity | null
  /** Where the confirmation email goes (staff only). null = none on file; undefined = an older server. */
  requester_email?: string | null
  priority_sla?: number | null
  comments_count?: number
  devices: Device[]
}

/** A "False Alarm Date" or "Reopened Date" entry as list rows carry it (remarks = the reason). */
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

export type ConfirmationState =
  | 'pending'
  | 'confirmed'
  | 'disputed'
  | 'auto_closed'
  | 'head_closed'
  | 'superseded'

export type MailStatus = 'none' | 'pending' | 'sent' | 'failed'

export interface ConfirmationMail {
  status: MailStatus
  attempts?: number
  sent_at?: string | null
  error?: string | null
}

export type SurveyCategory =
  | 'service'
  | 'assurance'
  | 'reliability'
  | 'communication'
  | 'access_facilities'
  | 'integrity'
  | 'outcome'

/** Each area is 1-5, or absent/null when the requester skipped it. */
export type SurveyRatings = Partial<Record<SurveyCategory, number | null>>

/** GET /tickets/{id} `confirmation`: the latest request for the requester to confirm a completion. */
export interface ConfirmationInfo {
  state: ConfirmationState
  completion_notes: string | null
  completed_by: PersonRef | null
  completed_at: string
  auto_close_at: string | null
  channel: 'email' | 'track' | 'head' | 'auto' | null
  responded_at: string | null
  dispute_reason: string | null
  requester_email: string | null
  mail: ConfirmationMail
  survey: {
    submitted: boolean
    submitted_at: string | null
    /** The Customer Satisfaction Survey answers (staff only); absent on older responses. */
    ratings?: SurveyRatings | null
    comments?: string | null
  }
}

/** What completing a ticket returns (a subset of ConfirmationInfo). */
export interface CompletionResult {
  state: ConfirmationState
  completed_at: string
  auto_close_at: string | null
  requester_email: string | null
  mail: { status: MailStatus }
}

export interface ReopenInfo {
  reason: string | null
  /** null when the user who reopened it no longer exists. */
  reopened_by: PersonRef | null
  reopened_at: string
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
    category: 'Requested Date' | 'Assigned Date' | 'Completed Date' | 'False Alarm Date' | 'Reopened Date' | 'Confirmed Date' | 'Disputed Date' | 'Auto-closed Date'
    user: string | null
    created_at: string
    remarks?: string | null
  }[]
  /** Set once the request was rejected as a false alarm; null otherwise. */
  false_alarm?: FalseAlarmInfo | null
  /** The latest reopen of a rejected request; null if never reopened. The earlier rejection stays in `timeline`. */
  reopened?: ReopenInfo | null
  /** When the elapsed/SLA clock started (the latest reopen, else the request). */
  clock_started_at?: string
  /** Where the confirmation email goes (staff only). null = none on file. */
  requester_email?: string | null
  /** The latest completion confirmation; null if the ticket was never completed. */
  confirmation?: ConfirmationInfo | null
  comments: TicketDetailComment[]
  created_at: string
  updated_at: string
}
