import { DepartmentTicket } from '@/types'
import { STATUS_FALLBACK, STATUS_STYLES } from '@/lib/styles'

export default function StatusCell({ ticket }: { ticket: DepartmentTicket }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(STATUS_STYLES[ticket.status] ?? STATUS_FALLBACK).badge}`}>
      {ticket.status}
    </span>
  )
}
