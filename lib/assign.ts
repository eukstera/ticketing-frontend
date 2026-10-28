import { isAdmin, type AuthUser } from '@/lib/auth'
import type { DepartmentTicket } from '@/types'

/**
 * Only a Department Head of the handling department may assign a ticket.
 * Staff of that department can still take it, and heads of other departments
 * get nothing (the API answers 403).
 */
export function canAssign(
  ticket: Pick<DepartmentTicket, 'department_id'>,
  user: AuthUser | null | undefined
): boolean {
  return !!user && isAdmin(user) && user.department_id === ticket.department_id
}
