import { DepartmentTicket } from '@/types'
import { statusBadgeClass } from '@/lib/styles'

export default function StatusCell({ ticket }: { ticket: DepartmentTicket }) {
  return (
    <span className={statusBadgeClass(ticket.status)}>
      {ticket.status}
    </span>
  )
}
