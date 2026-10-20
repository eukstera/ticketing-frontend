// components/AssignModal.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { getEmployees, Employee } from '@/lib/employees'
import { isAbortError, isApiError } from '@/lib/api'
import { toast } from '@/components/Toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

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
  }, [])

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
      onClose={onClose}
      title="Assign Ticket"
      closeOnBackdrop={!assigning}
      panelClassName="h-[600px] max-h-[90dvh]"
      bodyClassName="px-3 py-2"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-6 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selected || assigning}
            className="px-6 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {assigning ? 'Assigning...' : 'Assign'}
          </button>
        </>
      }
    >
      <p className="px-3 pb-2 text-sm text-gray-500">Search and select an employee to assign</p>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
          <span className="text-gray-500" aria-hidden="true">🔍</span>
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
        <p className="text-center text-gray-500 text-sm py-6">Loading employees...</p>
      ) : loadError ? (
        <p role="alert" className="text-center text-red-600 text-sm py-6">{loadError}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-6">No employees found</p>
      ) : (
        filtered.map(emp => (
          <button
            key={emp.id}
            onClick={() => setSelected(emp)}
            aria-pressed={selected?.id === emp.id}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
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
              <span className="text-blue-600 text-sm" aria-hidden="true">✓</span>
            )}
          </button>
        ))
      )}
    </Modal>
  )
}
