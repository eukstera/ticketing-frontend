// lib/tickets.ts
import { api } from './api'
import { DepartmentTicketsResponse } from '@/types'

export interface TicketComment {
  id: number
  comment: string
  user: { id: number; first_name: string; last_name: string }
  created_at: string
  updated_at: string
}

export interface CreateTicketDevice {
  type: string
  quantity: number
}

export interface CreateTicketPayload {
  service_department: number
  area_supervisor: string
  type_of_concern: 'Software' | 'Hardware' | 'Network'
  devices: CreateTicketDevice[]
  name_of_area: string
  remarks: string
  assigned_user: string
  priority: number
  requestor: string
}

export function getDepartmentTickets(
  page = 1,
  filters?: { status?: string | null; priority?: string | null; search?: string }
) {
  const query = new URLSearchParams({ page: String(page) })
  if (filters?.status) query.set('status', filters.status)
  if (filters?.priority) query.set('priority', filters.priority)
  if (filters?.search) query.set('search', filters.search)
  return api.get<DepartmentTicketsResponse>(`/getDepartmentTickets?${query.toString()}`)
}

export function getMyTickets(
  page = 1,
  filters?: { status?: string | null; priority?: string | null; search?: string }
) {
  const query = new URLSearchParams({ page: String(page) })
  if (filters?.status) query.set('status', filters.status)
  if (filters?.priority) query.set('priority', filters.priority)
  if (filters?.search) query.set('search', filters.search)
  return api.get<DepartmentTicketsResponse>(`/getMyTickets?${query.toString()}`)
}

export function markTicketComplete(ticketId: number) {
  return api.post(`/tickets/${ticketId}/complete`, {})
}

export function assignTicket(ticketId: number, userId: number) {
  // NOTE: kept the original endpoint shape (`/${ticketId}/assign`) used by the
  // previous inline fetch call — flag this with the backend team if it looks off.
  return api.post(`/tickets/${ticketId}/assign`, { user_id: userId })
}

export function getTicketComments(ticketId: number) {
  return api.get<{ result: { comments: TicketComment[] } }>(`/tickets/${ticketId}/comments`)
}

export function addTicketComment(ticketId: number, comment: string) {
  return api.post<{ result: { comment: TicketComment } }>(`/tickets/${ticketId}/comments`, { comment })
}

export function updateTicketComment(ticketId: number, commentId: number, comment: string) {
  // NOTE: guessed as PATCH /tickets/{id}/comments/{commentId} to match REST
  // convention — confirm against the actual backend route if this 404s.
  return api.patch<{ result: { comment: TicketComment } }>(
    `/tickets/comments/${commentId}`,
    { comment }
  )
}

export function createTicket(payload: CreateTicketPayload) {
  return api.post<{ message: string }>('/saveRequestTicketIT', payload)
}

export interface AccomplishmentReportResult {
  blob: Blob
  filename: string
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// Parse a 'YYYY-MM-DD' input value as a local date (avoids UTC day-shift).
function parseLocalDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// ASSUMPTION: the logged-in user is stored at localStorage['user'] as JSON
// with a `last_name` field (matches the shape used elsewhere in this file,
// e.g. TicketComment.user). Adjust the key/path here if your app stores
// auth state differently (e.g. inside a larger 'auth' object, or under a
// different key).
function getStoredLastName(): string | null {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const user = JSON.parse(raw)
    return user?.last_name ?? null
  } catch {
    return null
  }
}

function buildFilename(lastName: string, dateFrom: string, dateTo: string) {
  const from = parseLocalDate(dateFrom)
  const to = parseLocalDate(dateTo)
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  const monthName = (d: Date) => d.toLocaleString('en-US', { month: 'long' })

  const rangeLabel = sameMonth
    ? `${monthName(from)} ${from.getDate()}-${to.getDate()}`
    : `${monthName(from)} ${from.getDate()} - ${monthName(to)} ${to.getDate()}`

  return `${lastName} ${rangeLabel} Report.docx`
}

export async function downloadAccomplishmentReport(
  dateFrom: string,
  dateTo: string
): Promise<AccomplishmentReportResult> {
  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })

  const res = await api.getBlob(
    `/reports/accomplishment?${query.toString()}`,
    DOCX_MIME
  )

  const blob = await res.blob()

  const lastName = getStoredLastName()
  const filename = lastName
    ? buildFilename(lastName, dateFrom, dateTo)
    : `${dateFrom}_${dateTo}_Report.docx` // no user in storage — generic fallback

  return { blob, filename }
}


export interface Designation {
  id: number
  department_id: number
  designation: string
  status: number
}
 
export function getDesignations(departmentId: number) {
  const query = new URLSearchParams({ department_id: String(departmentId) })
  return api.get<{ result: { designations: Designation[] } }>(`/designations?${query.toString()}`)
}
 
export function createDesignation(departmentId: number, designation: string) {
  return api.post<{ result: { designation: Designation } }>('/designations', {
    department_id: departmentId,
    designation,
  })
}