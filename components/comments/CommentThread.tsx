'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/hooks/useUser'
import { isAdmin } from '@/lib/auth'
import { getErrorMessage, isAbortError } from '@/lib/api'
import {
  TicketComment,
  addTicketComment,
  deleteTicketComment,
  getTicketComments,
  updateTicketComment,
} from '@/lib/tickets'
import { toast } from '@/components/Toast'
import ConfirmModal from '@/components/ConfirmModal'
import Avatar from '@/components/ui/Avatar'
import ErrorState from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { btnPrimary, btnSecondary, btnSm, input } from '@/lib/styles'

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
  return `${date} ${time}`
}

/**
 * Comments ("actions taken") for one ticket: list, add, edit (author) and
 * delete (author or admin). Pass `initialComments` when the parent already has
 * them (e.g. the ticket detail payload); otherwise they are fetched. Remount
 * with a new `key` to reset when the ticket changes.
 */
export default function CommentThread({
  ticketId,
  initialComments,
  onChanged,
  className = '',
}: {
  ticketId: number
  initialComments?: TicketComment[]
  /** Called after a comment is added or deleted (e.g. to refresh a comment count). */
  onChanged?: () => void
  className?: string
}) {
  const currentUser = useUser()
  const admin = isAdmin(currentUser)

  const [comments, setComments] = useState<TicketComment[] | null>(initialComments ?? null)
  const [loadError, setLoadError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TicketComment | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (initialComments) return
    const controller = new AbortController()
    getTicketComments(ticketId, controller.signal)
      .then(res => {
        setLoadError('')
        setComments(res.result?.comments ?? [])
      })
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setLoadError(getErrorMessage(err, 'Failed to load comments'))
      })
    return () => controller.abort()
    // initialComments is only a seed; changing it must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, reloadToken])

  async function handleSubmit() {
    const text = newComment.trim()
    if (!text) return
    setSubmitting(true)
    try {
      const res = await addTicketComment(ticketId, text)
      setComments(prev => [...(prev ?? []), res.result.comment])
      setNewComment('')
      toast('Action taken added')
      onChanged?.()
    } catch (err) {
      console.error(err)
      toast(getErrorMessage(err, 'Failed to add action taken'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(c: TicketComment) {
    setEditingId(c.id)
    setEditText(c.comment)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  async function saveEdit(c: TicketComment) {
    const trimmed = editText.trim()
    if (!trimmed) return
    if (trimmed === c.comment) {
      cancelEdit()
      return
    }
    setSavingEdit(true)
    try {
      const res = await updateTicketComment(ticketId, c.id, trimmed)
      setComments(prev => (prev ?? []).map(item => (item.id === c.id ? res.result.comment : item)))
      cancelEdit()
      toast('Comment updated')
    } catch (err) {
      console.error(err)
      toast(getErrorMessage(err, 'Failed to update comment'), 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTicketComment(deleteTarget.id)
      setComments(prev => (prev ?? []).filter(item => item.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast('Comment deleted')
      onChanged?.()
    } catch (err) {
      console.error(err)
      toast(getErrorMessage(err, 'Failed to delete comment'), 'error')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoadError('')
              setReloadToken(t => t + 1)
            }}
          />
        ) : comments === null ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">
            No actions taken yet. Be the first to take action.
          </p>
        ) : (
          comments.map(c => {
            const isOwn = currentUser?.id === c.user.id
            const canDelete = isOwn || admin
            const isEdited = c.updated_at && c.updated_at !== c.created_at
            const isEditing = editingId === c.id

            return (
              <div key={c.id} className="group flex gap-3">
                <Avatar firstName={c.user.first_name} lastName={c.user.last_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-sm font-medium text-gray-800">
                      {c.user.first_name} {c.user.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{formatDateTime(c.created_at)}</p>
                    {isEdited && !isEditing && <p className="text-xs italic text-gray-500">(edited)</p>}
                    {!isEditing && (isOwn || canDelete) && (
                      <span className="ml-auto flex gap-3 transition sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            aria-label={`Edit comment by ${c.user.first_name}`}
                            className="rounded text-xs text-gray-500 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            aria-label={`Delete comment by ${c.user.first_name}`}
                            className="rounded text-xs text-gray-500 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            Delete
                          </button>
                        )}
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-1">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        autoFocus
                        aria-label="Edit comment"
                        className={`${input} resize-none`}
                      />
                      <div className="mt-1.5 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className={`${btnSecondary} ${btnSm}`}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(c)}
                          disabled={!editText.trim() || savingEdit}
                          className={`${btnPrimary} ${btnSm}`}
                        >
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-600">{c.comment}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-4 flex gap-2 border-t border-gray-200 pt-4">
        <Avatar firstName={currentUser?.first_name} lastName={currentUser?.last_name} />
        <div className="flex-1">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Enter your comment"
            aria-label="New comment"
            rows={2}
            maxLength={2000}
            className={`${input} resize-none`}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              className={btnPrimary}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete this comment?"
        message="This can't be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
