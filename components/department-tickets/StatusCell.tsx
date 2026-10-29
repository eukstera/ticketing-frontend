import { DepartmentTicket } from '@/types'
import { statusBadgeClass } from '@/lib/styles'
import { VOID_STATUS } from '@/lib/blankJobOrder'

export default function StatusCell({ ticket }: { ticket: DepartmentTicket }) {
  return (
    <span
      className={statusBadgeClass(ticket.status)}
      title={ticket.status === VOID_STATUS && ticket.void?.reason ? `Voided: ${ticket.void.reason}` : undefined}
    >
      {ticket.status}
    </span>
  )
}
