'use client'

// Removable chips for the APPLIED filters (never the unapplied draft).
import { X } from 'lucide-react'
import type { ConsolidationFilters } from '@/lib/consolidation'
import type { ConsolidationOption } from '@/types/consolidation'

type ListKey = 'area' | 'status' | 'priority' | 'type' | 'staff'

export interface Chip {
  key: ListKey
  value: string | number
  name: string
}

function nameOf(list: ConsolidationOption[] | undefined, id: string | number): string {
  return list?.find(o => String(o.id) === String(id))?.name ?? String(id)
}

export function buildChips(
  f: ConsolidationFilters,
  lists: Partial<Record<'statuses' | 'priorities' | 'concern_types' | 'staff', ConsolidationOption[]>>
): Chip[] {
  return [
    ...f.area.map(v => ({ key: 'area' as const, value: v, name: v })),
    ...f.status.map(v => ({ key: 'status' as const, value: v, name: nameOf(lists.statuses, v) })),
    ...f.priority.map(v => ({ key: 'priority' as const, value: v, name: nameOf(lists.priorities, v) })),
    ...f.type.map(v => ({ key: 'type' as const, value: v, name: nameOf(lists.concern_types, v) })),
    ...f.staff.map(v => ({ key: 'staff' as const, value: v, name: nameOf(lists.staff, v) })),
  ]
}

export function withoutChip(f: ConsolidationFilters, chip: Chip): ConsolidationFilters {
  const list = (f[chip.key] as (string | number)[]).filter(v => v !== chip.value)
  return { ...f, [chip.key]: list, page: 1 }
}

export default function AppliedChips({
  chips,
  onRemove,
}: {
  chips: Chip[]
  onRemove: (chip: Chip) => void
}) {
  if (chips.length === 0) return null
  return (
    <ul aria-label="Applied filters" className="mt-3 flex flex-wrap gap-2">
      {chips.map(chip => (
        <li
          key={`${chip.key}:${chip.value}`}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
        >
          {chip.name}
          <button
            type="button"
            onClick={() => onRemove(chip)}
            aria-label={`Remove filter: ${chip.name}`}
            className="rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
