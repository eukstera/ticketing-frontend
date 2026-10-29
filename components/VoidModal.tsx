// components/VoidModal.tsx
'use client'

import { XCircle } from 'lucide-react'
import ReasonDialog from '@/components/ReasonDialog'
import { VOID_REASON_MAX, VOID_REASON_MIN, validateVoidReason } from '@/lib/blankJobOrder'
import { btnDanger } from '@/lib/styles'

interface Props {
  isOpen: boolean
  ticketId: number | null
  ticketNumber?: string
  onClose: () => void
  /** Voids the ticket. Throw to keep the dialog open; the message is shown inline. */
  onSubmit: (ticketId: number, reason: string) => Promise<void>
}

/** Cancel a Blank ticket that will never be filled in. The reason is required and recorded. */
export default function VoidModal({ isOpen, ticketId, ticketNumber, onClose, onSubmit }: Props) {
  if (!isOpen || ticketId == null) return null
  return (
    <ReasonDialog
      key={ticketId}
      title={`Void ticket ${ticketNumber ?? ''}`.trim()}
      intro={<p>The number stays used and can&apos;t be reused. Voiding can&apos;t be undone.</p>}
      label="Reason"
      apiField="reason"
      min={VOID_REASON_MIN}
      max={VOID_REASON_MAX}
      rows={3}
      validate={validateVoidReason}
      confirmClass={btnDanger}
      confirmLabel="Void ticket"
      pendingLabel="Voiding…"
      confirmIcon={XCircle}
      failureFallback="Couldn't void the ticket."
      onClose={onClose}
      onSubmit={reason => onSubmit(ticketId, reason)}
    />
  )
}
