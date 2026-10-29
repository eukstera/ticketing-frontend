import { DepartmentTicket } from '@/types'
import { statusBadgeClass } from '@/lib/styles'
import { VOID_STATUS } from '@/lib/blankJobOrder'

export default function StatusCell({ ticket }: { ticket: DepartmentTicket }) {
  return (
    <span
      className={statusBadgeClass(ticket.status)}
      title={ticket.status === VOID_STATUS && ticket.void_activity?.remarks ? `Voided: ${ticket.void_activity.remarks}` : undefined}
    >
      {ticket.status}
    </span>
  )
}
