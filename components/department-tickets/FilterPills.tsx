import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { StatusPill, PriorityPill } from '@/lib/departmentTickets'
import { PRIORITY_FALLBACK, PRIORITY_STYLES, STATUS_ALL, STATUS_STYLES } from '@/lib/styles'


const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1'

export default function FilterPills({
  statusPills,
  priorityPills,
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
}: {
  statusPills: StatusPill[]
  priorityPills: PriorityPill[]
  statusFilter: string | null
  priorityFilter: string | null
  onStatusChange: (value: string | null) => void
  onPriorityChange: (value: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Move focus into the list on open: the selected option, else the first.
  useEffect(() => {
    if (!open) return
    const options = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    ;(selected ?? options?.[0])?.focus()
  }, [open])

  function closeAndRefocus() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  // listbox keyboard model: arrows/Home/End move, Escape closes, Tab leaves.
  function handleListKeyDown(e: React.KeyboardEvent) {
    const options = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    const index = options.findIndex(o => o === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      options[Math.min(options.length - 1, index + 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      options[Math.max(0, index - 1)]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      options[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      options[options.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      closeAndRefocus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const activePill = priorityPills.find(p => p.value === priorityFilter)
  const activeStyle = activePill ? (PRIORITY_STYLES[activePill.label] ?? PRIORITY_FALLBACK) : PRIORITY_FALLBACK
  const triggerColor = activePill ? activePill.color : PRIORITY_FALLBACK.pill
  const triggerLabel = activePill ? activePill.label : 'All Priorities'
  const triggerBadge = activeStyle.badge
  const priorityRing = activeStyle.ring
  const totalCount = priorityPills.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="relative flex items-center justify-between flex-wrap gap-3 mb-6">
      <div role="group" aria-label="Filter by status" className="flex items-center gap-2 flex-wrap">
        {statusPills.map(pill => (
          <button
            key={pill.label}
            type="button"
            onClick={() => onStatusChange(pill.value)}
            aria-pressed={statusFilter === pill.value}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full border text-sm font-medium transition ${FOCUS_RING} ${pill.color} ${
              statusFilter === pill.value
                ? `ring-2 ring-offset-1 ${(STATUS_STYLES[pill.label] ?? STATUS_ALL).ring}`
                : 'opacity-90 hover:opacity-100'
            }`}
          >
            {pill.count} {pill.label}
          </button>
        ))}
      </div>

      <div ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={`Priority: ${triggerLabel}`}
          className={`flex items-center gap-2 pl-4 pr-2 py-1 rounded-md border text-sm font-medium transition ring-2 ${priorityRing} ring-offset-1 ${triggerColor} focus:outline-none focus-visible:ring-blue-600`}
        >
          {activePill && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${triggerBadge}`}>
              {activePill.count}
            </span>
          )}
          <span>{triggerLabel}</span>
          <ChevronDown size={14} className="mr-1 text-gray-500" aria-hidden="true" />
        </button>

        {open && (
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Priority"
            onKeyDown={handleListKeyDown}
            className="absolute inset-x-4 top-full mt-2 sm:inset-x-auto sm:left-auto sm:right-0 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-10"
          >
            <button
              type="button"
              role="option"
              aria-selected={priorityFilter === null}
              onClick={() => { onPriorityChange(null); closeAndRefocus() }}
              className={`w-full flex items-center px-3 py-2 rounded-md text-sm transition ${FOCUS_RING} ${
                priorityFilter === null ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className="flex gap-2">
                <span className="flex items-center justify-center min-w-[20px] bg-gray-300 h-5 px-1.5 rounded-full text-[11px] font-medium">
                  {totalCount}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-700">All Priorities</span>
                  <span className="block text-[11px] text-gray-500">
                    Click to display all priorities
                  </span>
                </span>
              </span>
            </button>

            {priorityPills.map(pill => {
              const isActive = priorityFilter === pill.value
              const badge = (PRIORITY_STYLES[pill.label] ?? PRIORITY_FALLBACK).badge
              return (
                <button
                  key={pill.priority_id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { onPriorityChange(isActive ? null : pill.value); closeAndRefocus() }}
                  className={`w-full flex items-start gap-2 px-3 py-2 rounded-md text-sm transition ${FOCUS_RING} ${
                    isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`mt-0.5 flex shrink-0 items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium ${badge}`}>
                    {pill.count}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-medium text-gray-700">{pill.label}</span>
                    {pill.sla != null && (
                      <span className="block text-[11px] text-gray-500">
                        SLA {pill.sla} {pill.sla > 1 ? 'Days' : 'Day'}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
