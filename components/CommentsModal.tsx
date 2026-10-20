// components/CommentsModal.tsx
'use client'

import Modal from '@/components/ui/Modal'
import CommentThread from '@/components/comments/CommentThread'

interface Props {
  isOpen: boolean
  ticketId: number | null
  onClose: () => void
  onCommentAdded: () => void
}

// The comment logic lives in CommentThread (shared with the ticket detail
// page). It is mounted only while open and keyed by ticket, so loading and
// editing state resets on close or ticket switch.
export default function CommentsModal({ isOpen, ticketId, onClose, onCommentAdded }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Actions Taken" size="lg">
      {ticketId != null && (
        <CommentThread key={ticketId} ticketId={ticketId} onChanged={onCommentAdded} />
      )}
    </Modal>
  )
}
