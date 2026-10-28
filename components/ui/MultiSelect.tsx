'use client'

// components/ui/MultiSelect.tsx
// A multi-choice dropdown (listbox with aria-multiselectable), built on the
// FilterPills pattern: trigger with a chevron, check marks, arrow-key model,
// Escape / outside click close it. Long lists get a search box.
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface MultiSelectOption<V extends string | number> {
  value: V
  label: string
  /** Extra classes for the label chip (e.g. a status or priority colour). */
  chipClass?: string
}

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
export const SEARCH_THRESHOLD = 8

/** Trigger text: "All", the single name, or "N selected". */
export function summarizeSelection<V extends string | number>(
  options: MultiSelectOption<V>[],
  selected: V[]
): string {
  if (selected.length === 0) return 'All'
  if (selected.length === 1) return options.find(o => o.value === selected[0])?.label ?? '1 selected'
  return `${selected.length} selected`
}

export default function MultiSelect<V extends string | number>({
  id,
  label,
  options,
  selected,
  onChange,
  disabled,
  loading,
  describedBy,
}: {
  /** Id of the trigger button; pair it with a <label htmlFor>. */
  id: string
  /** Accessible name of the list. */
  label: string
  options: MultiSelectOption<V>[]
  selected: V[]
  onChange: (next: V[]) => void
  disabled?: boolean
  loading?: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const searchable = options.length > SEARCH_THRESHOLD

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // On open, focus the search box if there is one, else the first selected / first option.
  useEffect(() => {
    if (!open) return
    if (searchRef.current) {
      searchRef.current.focus()
      return
    }
    const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    const first = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    ;(first ?? items?.[0])?.focus()
  }, [open])

  function close(refocus: boolean) {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus()
  }

  function toggle(value: V) {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value])
  }

  function items() {
    return Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const list = items()
    const index = list.findIndex(o => o === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[Math.min(list.length - 1, index + 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (index <= 0 && searchRef.current) searchRef.current.focus()
      else list[Math.max(0, index - 1)]?.focus()
    } else if (e.key === 'Home' && index >= 0) {
      e.preventDefault()
      list[0]?.focus()
    } else if (e.key === 'End' && index >= 0) {
      e.preventDefault()
      list[list.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      close(true)
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  const shown = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-describedby={describedBy}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 transition hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-500 ${FOCUS_RING}`}
      >
        <span className="truncate">{loading ? 'Loading…' : summarizeSelection(options, selected)}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-500" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={listId}
          onKeyDown={onKeyDown}
          className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
        >
          {searchable && (
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label={`Search ${label}`}
              placeholder="Search…"
              className="mb-1.5 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          )}
          <div ref={listRef} role="listbox" aria-label={label} aria-multiselectable="true" className="max-h-60 overflow-y-auto">
            {shown.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">No matches</p>
            ) : (
              shown.map(o => {
                const isSelected = selected.includes(o.value)
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(o.value)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${FOCUS_RING} ${
                      isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {isSelected && <Check size={14} className="text-blue-600" aria-hidden="true" />}
                    </span>
                    <span className={o.chipClass ? `rounded-full px-2 py-0.5 text-xs font-medium ${o.chipClass}` : 'text-gray-700'}>
                      {o.label}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
