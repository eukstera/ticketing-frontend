import { getErrorMessage, isAbortError } from '@/lib/api'
import { isAdmin, type AuthUser } from '@/lib/auth'
import { IT_DEPARTMENT_ID } from '@/lib/constants'
import { saveBlob } from '@/lib/download'
import { downloadJobOrder } from '@/lib/tickets'
import { JOB_ORDER_FORMATS, type JobOrderFormat } from '@/lib/jobOrderFormat'
import type { DepartmentTicket } from '@/types'

// Statuses the API produces a job order for. A false alarm has none (409).
const JOB_ORDER_STATUSES = ['Open', 'In-progress', 'Overdue', 'Pending Confirmation', 'Completed']

export const BLOCKED_MESSAGE =
  'Your browser blocked the download. Allow downloads for this site, then use Download JO.'

/**
 * Who sees "Download JO": handling-department staff and Department Heads, on an
 * IT ticket that isn't a false alarm. (The API decides; this only avoids
 * offering a button that would 403/409.) Engineering tickets have no form.
 */
export function canDownloadJobOrder(
  ticket: Pick<DepartmentTicket, 'status' | 'department_id'>,
  user: AuthUser | null | undefined
): boolean {
  if (!user) return false
  if (!JOB_ORDER_STATUSES.includes(ticket.status)) return false
  if (ticket.department_id !== IT_DEPARTMENT_ID) return false
  return user.department_id === ticket.department_id || isAdmin(user)
}

export type JobOrderResult =
  | { ok: true; filename: string }
  | { ok: false; kind: 'aborted' }
  | { ok: false; kind: 'blocked' | 'error'; message: string }

export interface JobOrderDeps {
  fetchFile: typeof downloadJobOrder
  save: typeof saveBlob
}

const realDeps: JobOrderDeps = { fetchFile: downloadJobOrder, save: saveBlob }

export interface JobOrderOptions {
  ticketNumber?: string
  signal?: AbortSignal
  /** Defaults to Excel. */
  format?: JobOrderFormat
}

/** Fetches the job order and hands it to the browser. Never throws; says what went wrong instead. */
export async function fetchAndSaveJobOrder(
  ticketId: number,
  { ticketNumber, signal, format }: JobOrderOptions = {},
  deps: JobOrderDeps = realDeps
): Promise<JobOrderResult> {
  let file: Awaited<ReturnType<typeof downloadJobOrder>>
  try {
    file = await deps.fetchFile(ticketId, signal, ticketNumber, format)
  } catch (err) {
    if (isAbortError(err)) return { ok: false, kind: 'aborted' }
    console.error(err)
    const what = format ? JOB_ORDER_FORMATS[format].short : 'job order'
    return {
      ok: false,
      kind: 'error',
      message: getErrorMessage(err, format ? `Couldn't generate the ${what} job order.` : "Couldn't generate the job order."),
    }
  }
  if (!deps.save(file.blob, file.filename)) return { ok: false, kind: 'blocked', message: BLOCKED_MESSAGE }
  return { ok: true, filename: file.filename }
}

/**
 * Take a ticket, then download its job order. The job order is requested only
 * after the take succeeded (the form then names the assignee), and whatever
 * happens to it can never undo or hide the take.
 */
export async function takeThenJobOrder(
  ticketId: number,
  userId: number,
  deps: {
    take: (ticketId: number, userId: number) => Promise<unknown>
    /** Runs right after a successful take, before the download starts (toast, refresh). */
    onTaken: () => void
    downloadJobOrder: (ticketId: number) => Promise<unknown>
  }
): Promise<{ taken: true } | { taken: false; error: unknown }> {
  try {
    await deps.take(ticketId, userId)
  } catch (error) {
    return { taken: false, error }
  }
  try {
    deps.onTaken()
  } catch (err) {
    console.error(err)
  }
  try {
    await deps.downloadJobOrder(ticketId)
  } catch (err) {
    console.error(err)
  }
  return { taken: true }
}
