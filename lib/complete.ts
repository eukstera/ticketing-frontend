import { isEncoder, type AuthUser } from '@/lib/auth'
import type { DepartmentTicket } from '@/types'

/**
 * Only the member who took the ticket may complete it: no bypass for heads or
 * other staff, and none on an untaken ticket (the API answers 403).
 */
export function canCompleteTicket(
  ticket: Pick<DepartmentTicket, 'status' | 'assigned_activity'>,
  user: AuthUser | null | undefined
): boolean {
  return !!user && !isEncoder(user) && ticket.status === 'In-progress' && ticket.assigned_activity?.user_id === user.id
}
