/**
 * Create Ticket (/tickets/create): staff enter a request received by phone, in person, etc. The form is TicketForm.
 */
import TicketForm from '@/components/tickets/TicketForm'

export default function CreateTicketPage() {
  return <TicketForm mode="create" />
}
