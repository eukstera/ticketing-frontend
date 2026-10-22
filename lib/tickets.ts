// lib/tickets.ts
import { api } from './api'
import type { TicketDetail } from '@/types'
import {
  buildListQuery,
  normalizeListResponse,
  RawTicketListResponse,
  TicketListParams,
  TicketListResult,
} from './ticketList'

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
  type_of_concern: string
  devices: CreateTicketDevice[]
  name_of_area: string
  remarks: string
  assigned_user: number
  priority: number
  requestor: string
}

type ListCounts = Pick<TicketListResult, 'statusCounts' | 'priorityCounts'>

async function fetchTicketList(
  endpoint: '/getDepartmentTickets' | '/getMyTickets',
  params: TicketListParams,
  counts?: ListCounts,
  signal?: AbortSignal
): Promise<TicketListResult> {
  const res = await api.get<RawTicketListResponse>(
    `${endpoint}?${buildListQuery(params, counts).toString()}`,
    { signal }
  )
  return normalizeListResponse(res)
}

// `counts` is the previous result's counts; it only matters while the BE still
// uses label filters (see buildListQuery).
export function getDepartmentTickets(params: TicketListParams, counts?: ListCounts, signal?: AbortSignal) {
  return fetchTicketList('/getDepartmentTickets', params, counts, signal)
}

export function getMyTickets(params: TicketListParams, counts?: ListCounts, signal?: AbortSignal) {
  return fetchTicketList('/getMyTickets', params, counts, signal)
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

export function getTicketComments(ticketId: number, signal?: AbortSignal) {
  return api.get<{ result: { comments: TicketComment[] } }>(`/tickets/${ticketId}/comments`, { signal })
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

// TODO(BE-phase2): GET /tickets/{ticket} is specified but not live yet.
export function getTicket(ticketId: number, signal?: AbortSignal) {
  return api.get<{ result: { ticket: TicketDetail } }>(`/tickets/${ticketId}`, { signal })
}

// Author or admin only (403 otherwise). TODO(BE-phase2): endpoint not live yet.
export function deleteTicketComment(commentId: number) {
  return api.delete<{ result: Record<string, never> }>(`/tickets/comments/${commentId}`)
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

export interface ReportSignatory {
  id: number
  name: string
  title: string
  is_default: boolean
  status: boolean
}

/** A saved signatory by id, or a one-off name + title (the BE needs both). Omit for the default. */
export type SignatoryChoice = { id: number } | { name: string; title: string }

export const SIGNATORY_MAX_LENGTH = 255

// Active signatories only, default first. Open to any logged-in user.
export function getReportSignatories(signal?: AbortSignal) {
  return api.get<{ result: { signatories: ReportSignatory[] } }>('/report-signatories', { signal })
}

// userId is admin-only on the BE (a non-admin passing another id gets 403).
export async function downloadAccomplishmentReport(
  dateFrom: string,
  dateTo: string,
  signal?: AbortSignal,
  userId?: number,
  signatory?: SignatoryChoice
): Promise<AccomplishmentReportResult> {
  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  if (userId) query.set('user_id', String(userId))
  if (signatory) {
    if ('id' in signatory) {
      query.set('signatory_id', String(signatory.id))
    } else {
      query.set('signatory_name', signatory.name)
      query.set('signatory_title', signatory.title)
    }
  }
  const { blob, filename } = await api.getBlob(
    `/reports/accomplishment?${query.toString()}`,
    DOCX_MIME,
    { signal }
  )
  if (!filename) {
    // A proxy can strip Content-Disposition; the file itself is still good.
    console.warn('Content-Disposition missing from the report response; using a generic filename.')
  }
  return { blob, filename: filename ?? `accomplishment-report_${dateFrom}_${dateTo}.docx` }
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