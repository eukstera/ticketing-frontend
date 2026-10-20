// components/AssignModal.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Check, Search } from 'lucide-react'
import { getEmployees, Employee } from '@/lib/employees'
import { isAbortError, isApiError } from '@/lib/api'
import { btnPrimary, btnSecondary } from '@/lib/styles'
import { toast } from '@/components/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import ErrorState from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'

interface Props {
  isOpen: boolean
  ticketId: number | null
  onClose: () => void
  onAssign: (ticketId: number, userId: number) => Promise<void>
}

// Mounted only while open (and per ticket), so search/selection/loading state
// starts fresh every time without reset effects.
export default function AssignModal({ isOpen, ticketId, onClose, onAssign }: Props) {
  if (!isOpen || ticketId == null) return null
  return <AssignModalContent key={ticketId} ticketId={ticketId} onClose={onClose} onAssign={onAssign} />
}

function AssignModalContent({
  ticketId,
  onClose,
  onAssign,
}: {
  ticketId: number
  onClose: () => void
  onAssign: Props['onAssign']
}) {
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getEmployees(undefined, controller.signal)
      .then(res => setEmployees(res.result.users || []))
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setLoadError("Couldn't load employees.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadToken])

  function retryLoad() {
    setLoadError('')
    setLoading(true)
    setReloadToken(t => t + 1)
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return employees
    return employees.filter(
      e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(term) ||
        (e.designation ?? '').toLowerCase().includes(term)
    )
  }, [search, employees])

  async function handleAssign() {
    if (!selected) return
    setAssigning(true)
    try {
      await onAssign(ticketId, selected.id)
      toast(`Ticket assigned to ${selected.first_name} ${selected.last_name}`)
      onClose()
    } catch (err) {
      console.error(err)
      toast(isApiError(err) ? err.message : 'Failed to assign ticket', 'error')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Modal
      isOpen
      // A request is in flight: don't let Escape / X / backdrop dismiss it
      onClose={assigning ? () => {} : onClose}
      title="Assign Ticket"
      closeOnBackdrop={!assigning}
      panelClassName="h-[600px] max-h-[90dvh]"
      bodyClassName="px-3 py-2"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={assigning} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selected || assigning}
            className={btnPrimary}
          >
            {assigning ? 'Assigning...' : 'Assign'}
          </button>
        </>
      }
    >
      <p className="px-3 pb-2 text-sm text-gray-500">Search and select an employee to assign</p>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
          <Search size={16} className="flex-shrink-0 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            aria-label="Search employees"
            placeholder="Search by name or designation"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none"
            autoFocus
          />
        </div>
      </div>

      {loading ? (
        <div role="status" aria-busy="true" className="space-y-2 px-3 py-2">
          <span className="sr-only">Loading employees…</span>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="px-3 py-2">
          <ErrorState message={loadError} onRetry={retryLoad} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-6">No employees found</p>
      ) : (
        filtered.map(emp => (
          <button
            key={emp.id}
            type="button"
            onClick={() => setSelected(emp)}
            aria-pressed={selected?.id === emp.id}
            className={`w-full flex focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
              selected?.id === emp.id
                ? 'bg-blue-50 border border-blue-400'
                : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            <Avatar firstName={emp.first_name} lastName={emp.last_name} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {emp.first_name} {emp.last_name}
              </p>
              <p className="text-xs text-gray-500 truncate">{emp.designation}</p>
            </div>
            {selected?.id === emp.id && (
              <Check size={16} className="flex-shrink-0 text-blue-600" aria-hidden="true" />
            )}
          </button>
        ))
      )}
    </Modal>
  )
}
