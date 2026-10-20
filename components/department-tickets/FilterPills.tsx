import { useEffect, useRef, useState } from 'react'
import { StatusPill, PriorityPill } from '@/lib/departmentTickets'
import { STATUS_PILL_DEFS, PRIORITY_PALETTE, PRIORITY_DOT, PRIORITY_BADGE, PRIORITY_RING, STATUS_RING, FALLBACK_DOT, FALLBACK_COLOR, FALLBACK_BADGE, FALLBACK_RING } from '@/lib/styles'


export function buildStatusPills(counts: Record<string, number>): StatusPill[] {
  return STATUS_PILL_DEFS.map(def => ({ ...def, count: counts[def.label] || 0 }))
}

export function buildPriorityPills(
  priorityStats: Record<string, number> | undefined,
  slaByLevel?: Record<string, number>
): PriorityPill[] {
  if (!priorityStats || typeof priorityStats !== 'object') return []

  return Object.entries(priorityStats).map(([level, count], i) => ({
    priority_id: i,
    label: level,
    value: level,
    count,
    color: PRIORITY_PALETTE[level] ?? FALLBACK_COLOR,
    sla: slaByLevel?.[level],
  }))
}

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activePill = priorityPills.find(p => p.value === priorityFilter)
  const triggerColor = activePill ? activePill.color : FALLBACK_COLOR
  const triggerDot = activePill ? (PRIORITY_DOT[activePill.label] ?? FALLBACK_DOT) : FALLBACK_DOT
  const triggerLabel = activePill ? activePill.label : 'All Priorities'
  const triggerBadge = activePill ? (PRIORITY_BADGE[activePill.label] ?? FALLBACK_BADGE) : FALLBACK_BADGE
  const priorityRing = activePill ? (PRIORITY_RING[activePill.label] ?? FALLBACK_RING) : FALLBACK_RING
  const totalCount = priorityPills.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="relative flex items-center justify-between flex-wrap gap-3 mb-6">
      <div className="flex items-center gap-2 flex-wrap">
        {statusPills.map(pill => (
          <button
            key={pill.label}
            onClick={() => onStatusChange(pill.value)}
            className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition ${pill.color} ${
              statusFilter === pill.value
                ? `ring-2 ring-offset-1 ${STATUS_RING[pill.label] ?? 'ring-gray-400'}`
                : 'opacity-90 hover:opacity-100'
            }`}
          >
            {pill.count} {pill.label}
          </button>
        ))}
      </div>

      <div ref={containerRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 pl-4 pr-2 py-1 rounded-md border text-sm font-medium transition ring-2 ${priorityRing} ring-offset-1 ${triggerColor}`}
        >
          {activePill && (
            <span className={`text-[11px] text-gray-400 px-2 py-0.5 rounded-full ${triggerBadge}`}>
              {activePill.count}
            </span>
          )}
          <span>{triggerLabel}</span>
          <svg className="w-3.5 h-3.5 text-gray-400 mr-1" viewBox="0 0 20 20" fill="none">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className="absolute inset-x-4 top-full mt-2 sm:inset-x-auto sm:left-auto sm:right-0 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-10">
            <button
              onClick={() => { onPriorityChange(null); setOpen(false) }}
              className={`w-full flex items-center px-3 py-2 rounded-md text-sm transition ${
                priorityFilter === null ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className="flex gap-2">
                <span className={`flex items-center justify-center min-w-[20px] bg-gray-300 h-5 px-1.5 rounded-full text-[11px] font-medium`}>
                  {totalCount}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="font-medium text-gray-700">All Priorities</span>
                  <span className="block text-[11px] text-gray-400">
                    Click to display all priorities
                  </span>
                </span>
              </span>
            </button>

            {priorityPills.map(pill => {
              const isActive = priorityFilter === pill.value
              const dot = PRIORITY_DOT[pill.label] ?? FALLBACK_DOT
              const badge = PRIORITY_BADGE[pill.label] ?? FALLBACK_BADGE
              return (
                <button
                  key={pill.priority_id}
                  onClick={() => { onPriorityChange(isActive ? null : pill.value); setOpen(false) }}
                  className={`w-full flex items-start gap-2 px-3 py-2 rounded-md text-sm transition ${
                    isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`mt-0.5 flex shrink-0 items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium ${badge}`}>
                    {pill.count}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-medium text-gray-700">{pill.label}</span>
                    {pill.sla != null && (
                      <span className="block text-[11px] text-gray-400">
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