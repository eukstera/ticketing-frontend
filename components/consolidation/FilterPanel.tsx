'use client'

// The Consolidation filter panel: edits a DRAFT of the filters, applied only on
// Apply (Enter in the form works too). The parent remounts it (key) whenever the
// applied filters change, so the draft always starts equal to what is applied.
import { useId, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import Field, { FieldGroup, fieldClass } from '@/components/ui/Field'
import MultiSelect, { type MultiSelectOption } from '@/components/ui/MultiSelect'
import { activeFilterCount, defaultFilters, filtersEqual, rangeError, type ConsolidationFilters } from '@/lib/consolidation'
import { PRIORITY_FALLBACK, PRIORITY_STYLES, STATUS_FALLBACK, STATUS_STYLES, btnPrimary, btnSecondary } from '@/lib/styles'
import type { ConsolidationOption, ConsolidationOptions } from '@/types/consolidation'

export type OptionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: ConsolidationOptions }

const BASIS_LABELS: Record<string, string> = { requested: 'Requested date', completed: 'Completed date' }
const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

function toOptions(list: ConsolidationOption[] | undefined, chip?: (name: string) => string): MultiSelectOption<number>[] {
  return (list ?? []).map(o => ({ value: Number(o.id), label: o.name, chipClass: chip?.(o.name) }))
}

export default function FilterPanel({
  applied,
  options,
  onApply,
  onReset,
  onRetryOptions,
}: {
  applied: ConsolidationFilters
  options: OptionsState
  onApply: (next: ConsolidationFilters) => void
  onReset: () => void
  onRetryOptions: () => void
}) {
  const [draft, setDraft] = useState<ConsolidationFilters>(applied)
  const [openOnPhone, setOpenOnPhone] = useState(false)
  const panelId = useId()
  const loading = options.status === 'loading'
  const data = options.status === 'ready' ? options.data : undefined

  const dateError = rangeError(draft.from, draft.to)
  const dirty = !filtersEqual({ ...draft, page: 1 }, { ...applied, page: 1 })
  const isDefault = filtersEqual({ ...draft, page: 1 }, defaultFilters())
  const count = activeFilterCount(applied)

  const dateFields = (data?.date_fields?.length ? data.date_fields : [{ id: 'requested', name: 'Requested date' }, { id: 'completed', name: 'Completed date' }])
    .filter(o => o.id === 'requested' || o.id === 'completed')

  const areaOptions: MultiSelectOption<string>[] = (data?.requesting_areas ?? []).map(o => ({ value: String(o.id), label: o.name }))
  const statusOptions = toOptions(data?.statuses, n => (STATUS_STYLES[n] ?? STATUS_FALLBACK).badge)
  const priorityOptions = toOptions(data?.priorities, n => (PRIORITY_STYLES[n] ?? PRIORITY_FALLBACK).pill)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (dateError) return
    onApply({ ...draft, page: 1 })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <button
        type="button"
        onClick={() => setOpenOnPhone(o => !o)}
        aria-expanded={openOnPhone}
        aria-controls={panelId}
        className={`${btnSecondary} w-full sm:hidden`}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filters ({count})
      </button>

      <div
        id={panelId}
        className={`${openOnPhone ? 'block' : 'hidden'} rounded-xl border border-gray-200 bg-white p-4 sm:block sm:p-5`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldGroup id="consolidation-basis" label="Date basis">
            {group => (
              <div {...group} className="flex flex-wrap gap-2">
                {dateFields.map(o => {
                  const value = o.id as 'requested' | 'completed'
                  const active = draft.basis === value
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDraft(d => ({ ...d, basis: value }))}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${FOCUS_RING} ${
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {BASIS_LABELS[value]}
                    </button>
                  )
                })}
              </div>
            )}
          </FieldGroup>

          <Field label="From" error={dateError ?? undefined}>
            {control => (
              <input
                type="date"
                {...control}
                value={draft.from}
                onChange={e => setDraft(d => ({ ...d, from: e.target.value }))}
                className={fieldClass(!!dateError)}
              />
            )}
          </Field>

          <Field label="To">
            {control => (
              <input
                type="date"
                {...control}
                value={draft.to}
                onChange={e => setDraft(d => ({ ...d, to: e.target.value }))}
                className={fieldClass(!!dateError)}
              />
            )}
          </Field>

          <Field label="Requesting department / section">
            {control => (
              <MultiSelect
                id={control.id}
                label="Requesting department / section"
                options={areaOptions}
                selected={draft.area}
                onChange={area => setDraft(d => ({ ...d, area }))}
                loading={loading}
                disabled={options.status === 'error'}
              />
            )}
          </Field>
          <Field label="Status">
            {control => (
              <MultiSelect
                id={control.id}
                label="Status"
                options={statusOptions}
                selected={draft.status}
                onChange={status => setDraft(d => ({ ...d, status }))}
                loading={loading}
                disabled={options.status === 'error'}
              />
            )}
          </Field>
          <Field label="Priority">
            {control => (
              <MultiSelect
                id={control.id}
                label="Priority"
                options={priorityOptions}
                selected={draft.priority}
                onChange={priority => setDraft(d => ({ ...d, priority }))}
                loading={loading}
                disabled={options.status === 'error'}
              />
            )}
          </Field>
          <Field label="Concern type">
            {control => (
              <MultiSelect
                id={control.id}
                label="Concern type"
                options={toOptions(data?.concern_types)}
                selected={draft.type}
                onChange={type => setDraft(d => ({ ...d, type }))}
                loading={loading}
                disabled={options.status === 'error'}
              />
            )}
          </Field>
          <Field label="Handling staff">
            {control => (
              <MultiSelect
                id={control.id}
                label="Handling staff"
                options={toOptions(data?.staff)}
                selected={draft.staff}
                onChange={staff => setDraft(d => ({ ...d, staff }))}
                loading={loading}
                disabled={options.status === 'error'}
              />
            )}
          </Field>
        </div>

        {options.status === 'error' && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-700">
            Couldn&apos;t load filter options.
            <button type="button" onClick={onRetryOptions} className={`rounded text-red-700 underline ${FOCUS_RING}`}>
              Retry
            </button>
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
          <button type="submit" disabled={!!dateError} className={`${btnPrimary} w-full sm:w-auto`}>
            Apply
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault && filtersEqual(applied, defaultFilters())}
            className={`${btnSecondary} w-full sm:w-auto`}
          >
            Reset
          </button>
          {dirty && !dateError && (
            <p className="text-xs text-amber-700 sm:mr-auto">
              Filters changed — click Apply to include them in the export.
            </p>
          )}
        </div>
      </div>
    </form>
  )
}
