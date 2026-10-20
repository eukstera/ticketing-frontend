// components/AssignModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { getEmployees, Employee } from '@/lib/employees'
import { toast } from '@/components/Toast'

interface Props {
  isOpen: boolean
  ticketId: number | null
  onClose: () => void
  onAssign: (ticketId: number, userId: number) => Promise<void>
}

export default function AssignModal({ isOpen, ticketId, onClose, onAssign }: Props) {
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filtered, setFiltered] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchEmployees()
      setSearch('')
      setSelected(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!search) {
      setFiltered(employees)
      return
    }
    const term = search.toLowerCase()
    setFiltered(
      employees.filter(
        e =>
          `${e.first_name} ${e.last_name}`.toLowerCase().includes(term) ||
          e.designation.toLowerCase().includes(term)
      )
    )
  }, [search, employees])

  async function fetchEmployees() {
    setLoading(true)
    try {
      const res = await getEmployees()
      const users = res.result.users || []
      setEmployees(users)
      setFiltered(users)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign() {
    if (!selected || !ticketId) return
    setAssigning(true)
    try {
      await onAssign(ticketId, selected.id)
      toast(`Ticket assigned to ${selected.first_name} ${selected.last_name}`)
      onClose()
    } catch (err) {
      console.error(err)
      toast('Failed to assign ticket', 'error')
    } finally {
      setAssigning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md h-[600px] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Assign Ticket</h2>
          <p className="text-sm text-gray-500">Search and select an employee to assign</p>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
            <span className="text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search by name or designation"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-6">Loading employees...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No employees found</p>
          ) : (
            filtered.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelected(emp)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                  selected?.id === emp.id
                    ? 'bg-blue-50 border border-blue-400'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  {emp.first_name[0]}{emp.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {emp.first_name} {emp.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{emp.designation}</p>
                </div>
                {selected?.id === emp.id && (
                  <span className="text-blue-600 text-sm">✓</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
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
        </div>
      </div>
    </div>
  )
}