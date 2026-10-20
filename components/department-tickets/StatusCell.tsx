import { DepartmentTicket } from '@/types'
import { statusStyles } from '@/lib/styles'

export default function StatusCell({ ticket }: { ticket: DepartmentTicket }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[ticket.status] || 'bg-gray-100 text-gray-700'}`}>
      {ticket.status}
    </span>
  )
}
