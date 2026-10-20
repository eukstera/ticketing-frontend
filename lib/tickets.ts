// lib/tickets.ts
import { api, BlobResult } from './api'
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

export interface TicketListFilters {
  status?: string | null
  priority?: string | null
  search?: string
  date_from?: string | null
  date_to?: string | null
  per_page?: number
  sort?: string | null
  dir?: 'asc' | 'desc' | null
}

function fetchTicketList(
  endpoint: '/getDepartmentTickets' | '/getMyTickets',
  page: number,
  filters?: TicketListFilters,
  signal?: AbortSignal
) {
  const query = new URLSearchParams({ page: String(page) })
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        query.set(key, String(value))
      }
    }
  }
  return api.get<DepartmentTicketsResponse>(`${endpoint}?${query.toString()}`, { signal })
}

export function getDepartmentTickets(page = 1, filters?: TicketListFilters, signal?: AbortSignal) {
  return fetchTicketList('/getDepartmentTickets', page, filters, signal)
}

export function getMyTickets(page = 1, filters?: TicketListFilters, signal?: AbortSignal) {
  return fetchTicketList('/getMyTickets', page, filters, signal)
}

export function markTicketComplete(ticketId: number) {
  return api.post(`/tickets/${ticketId}/complete`, {})
}

export function assignTicket(ticketId: number, userId: number) {
  return api.post(`/tickets/${ticketId}/assign`, { user_id: userId })
}

// "Take ticket": any employee of the handling department may self-assign.
// The BE has no dedicated endpoint, so this is assign with the caller's own id.
export function takeTicket(ticketId: number, userId: number) {
  return assignTicket(ticketId, userId)
}

export function getTicketComments(ticketId: number) {
  return api.get<{ result: { comments: TicketComment[] } }>(`/tickets/${ticketId}/comments`)
}

export function addTicketComment(ticketId: number, comment: string) {
  return api.post<{ result: { comment: TicketComment } }>(`/tickets/${ticketId}/comments`, { comment })
}

export function updateTicketComment(ticketId: number, commentId: number, comment: string) {
  // ticketId is unused by the route (PATCH /tickets/comments/{comment}) but kept
  // so callers don't change.
  return api.patch<{ result: { comment: TicketComment } }>(
    `/tickets/comments/${commentId}`,
    { comment }
  )
}

export function createTicket(payload: CreateTicketPayload) {
  return api.post<{ message: string }>('/saveRequestTicketIT', payload)
}

export type AccomplishmentReportResult = BlobResult

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// userId is admin-only on the BE (a non-admin passing another id gets 403).
export function downloadAccomplishmentReport(
  dateFrom: string,
  dateTo: string,
  signal?: AbortSignal,
  userId?: number
): Promise<AccomplishmentReportResult> {
  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  if (userId) query.set('user_id', String(userId))
  return api.getBlob(`/reports/accomplishment?${query.toString()}`, DOCX_MIME, { signal })
}

export interface Designation {
  id: number
  department_id: number
  designation: string
  status: boolean
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