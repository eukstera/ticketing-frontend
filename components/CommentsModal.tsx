// components/CommentsModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/useUser'
import { isApiError } from '@/lib/api'
import { getTicketComments, addTicketComment, updateTicketComment, TicketComment as Comment } from '@/lib/tickets'
import { toast } from '@/components/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

interface Props {
  isOpen: boolean
  ticketId: number | null
  onClose: () => void
  onCommentAdded: () => void
}

export default function CommentsModal({ isOpen, ticketId, onClose, onCommentAdded }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Actions Taken"
      bodyClassName="p-0 flex flex-col"
    >
      {/* Mounted only while open and keyed by ticket, so loading/editing state
          resets on close or ticket switch without reset effects. */}
      {ticketId != null && (
        <CommentsBody key={ticketId} ticketId={ticketId} onCommentAdded={onCommentAdded} />
      )}
    </Modal>
  )
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
  return `${date} ${time}`
}

function CommentsBody({
  ticketId,
  onCommentAdded,
}: {
  ticketId: number
  onCommentAdded: () => void
}) {
  const currentUser = useUser()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    let cancelled = false
    getTicketComments(ticketId)
      .then(res => {
        if (!cancelled) setComments(res.result?.comments || [])
      })
      .catch(err => {
        if (!cancelled) console.error(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticketId])

  async function handleSubmit() {
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      const res = await addTicketComment(ticketId, newComment)
      setComments(prev => [...prev, res.result.comment])
      onCommentAdded?.()
      setNewComment('')
      toast('Action taken added')
    } catch (err) {
      console.error(err)
      toast('Failed to add action taken', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(c: Comment) {
    setEditingId(c.id)
    setEditText(c.comment)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  async function saveEdit(c: Comment) {
    const trimmed = editText.trim()
    if (!trimmed) return

    // No-op edit — just close it out, no need to hit the API
    if (trimmed === c.comment) {
      cancelEdit()
      return
    }

    setSavingEdit(true)
    try {
      const res = await updateTicketComment(ticketId, c.id, trimmed)
      setComments(prev => prev.map(item => (item.id === c.id ? res.result.comment : item)))
      cancelEdit()
      toast('Comment updated')
    } catch (err) {
      console.error(err)
      if (isApiError(err) && err.status === 403) {
        toast('You can only edit your own comments', 'error')
      } else {
        toast('Failed to update comment', 'error')
      }
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <>
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4">
        {loading ? (
          <p className="text-center text-gray-500 text-sm py-6">Loading actions taken...</p>
        ) : comments.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-6">No actions taken yet. Be the first to take action.</p>
        ) : (
          comments.map(c => {
            const isOwn = currentUser?.id === c.user.id
            const isEdited = c.updated_at && c.updated_at !== c.created_at
            const isEditing = editingId === c.id

            return (
              <div key={c.id} className="flex gap-3 group">
                <Avatar firstName={c.user.first_name} lastName={c.user.last_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-gray-800">
                      {c.user.first_name} {c.user.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{formatDateTime(c.created_at)}</p>
                    {isEdited && !isEditing && (
                      <p className="text-xs text-gray-500 italic">(edited)</p>
                    )}
                    {isOwn && !isEditing && (
                      <button
                        onClick={() => startEdit(c)}
                        className="text-xs text-gray-500 hover:text-blue-600 focus:opacity-100 opacity-0 group-hover:opacity-100 transition ml-auto"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-1">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={2}
                        autoFocus
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex justify-end gap-2 mt-1.5">
                        <button
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(c)}
                          disabled={!editText.trim() || savingEdit}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 mt-0.5">{c.comment}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
        <div className="flex gap-2">
          <Avatar firstName={currentUser?.first_name} lastName={currentUser?.last_name} />
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Enter your comment"
              rows={2}
              maxLength={2000}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmit}
                disabled={!newComment.trim() || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
