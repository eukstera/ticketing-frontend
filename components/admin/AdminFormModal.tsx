'use client'

import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import Field, { FieldControlProps, fieldClass } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { useHydrated } from '@/hooks/useHydrated'
import { useOptions } from '@/hooks/useOptions'
import { isApiError } from '@/lib/api'
import { safeErrorMessage } from '@/lib/adminErrors'
import { AdminRow, createAdmin, updateAdmin } from '@/lib/admin'
import { AdminField, AdminResource } from '@/lib/adminResources'
import { btnPrimary, btnSecondary } from '@/lib/styles'

type Values = Record<string, string>

function initialValues(resource: AdminResource, row: AdminRow | null): Values {
  const values: Values = {}
  for (const f of resource.fields) {
    const raw = row?.[f.name]
    values[f.name] = raw == null ? '' : String(raw)
  }
  return values
}

function SelectField({
  field,
  control,
  value,
  values,
  onChange,
}: {
  field: AdminField
  control: FieldControlProps
  value: string
  values: Values
  onChange: (value: string) => void
}) {
  const { waiting, loading, options, error } = useOptions(field.options, values)
  const placeholder = waiting
    ? `Select ${field.dependsOn?.replace(/_id$/, '').replace(/_/g, ' ') ?? 'a value'} first`
    : loading
      ? 'Loading…'
      : `Select ${field.label.toLowerCase()}`

  return (
    <>
      <select
        {...control}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={waiting || loading}
        className={fieldClass(control['aria-invalid'])}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </>
  )
}

function buildBody(resource: AdminResource, values: Values, mode: 'create' | 'edit', active: boolean) {
  const body: Record<string, unknown> = {}
  for (const f of resource.fields) {
    const v = values[f.name] ?? ''
    if (f.type === 'password') {
      if (v) body[f.name] = v
    } else if (f.type === 'number' || f.type === 'select') {
      body[f.name] = v === '' ? null : Number(v)
    } else {
      body[f.name] = v.trim()
    }
  }
  if (mode === 'edit') body.status = active
  return body
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Create / edit form. Mount it only while open (state is seeded from `row`),
// so every open starts from fresh values.
export default function AdminFormModal({
  resource,
  row,
  onClose,
  onSaved,
}: {
  resource: AdminResource
  /** null → create. */
  row: AdminRow | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const mode = row ? 'edit' : 'create'
  const formId = useId()
  const hydrated = useHydrated()
  const [values, setValues] = useState<Values>(() => initialValues(resource, row))
  const [active, setActive] = useState(row?.status !== false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [banner, setBanner] = useState('')
  const [saving, setSaving] = useState(false)
  // Bumped after a failed submit so the effect below moves focus to the problem.
  const [failedSubmits, setFailedSubmits] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)

  function setValue(name: string, value: string) {
    setValues(prev => {
      const next = { ...prev, [name]: value }
      // Clear fields that depend on the one that changed (department → designation).
      for (const f of resource.fields) if (f.dependsOn === name) next[f.name] = ''
      return next
    })
    setErrors(prev => (prev[name] ? { ...prev, [name]: [] } : prev))
  }

  useEffect(() => {
    if (failedSubmits === 0) return
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    ;(firstInvalid ?? bannerRef.current)?.focus()
  }, [failedSubmits])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setBanner('')
    setErrors({})
    try {
      const body = buildBody(resource, values, mode, active)
      if (row) await updateAdmin(resource.endpoint, row.id, body)
      else await createAdmin(resource.createEndpoint ?? resource.endpoint, body)
      onSaved(`${capitalize(resource.singular)} ${mode === 'create' ? 'created' : 'updated'}`)
    } catch (err) {
      if (isApiError(err)) {
        const fieldNames = new Set(resource.fields.map(f => f.name))
        const fieldErrors = err.errors ?? {}
        setErrors(fieldErrors)
        // Errors keyed to something with no input (e.g. 409 { role: [...] })
        // would otherwise vanish, so surface them in the banner.
        const orphan = Object.entries(fieldErrors).find(([k, v]) => !fieldNames.has(k) && v?.[0])
        if (orphan) setBanner(orphan[1][0])
        else if (err.status !== 422) setBanner(safeErrorMessage(err))
      } else {
        setBanner('Something went wrong. Try again.')
      }
      setFailedSubmits(n => n + 1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      // Don't let Escape or the backdrop discard an in-flight save.
      onClose={saving ? () => {} : onClose}
      title={`${mode === 'create' ? 'Add' : 'Edit'} ${resource.singular}`}
      closeOnBackdrop={!saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={saving || !hydrated} className={btnPrimary}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
          </button>
        </>
      }
    >
      <form ref={formRef} id={formId} method="post" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {banner && (
          <div
            ref={bannerRef}
            tabIndex={-1}
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            {banner}
          </div>
        )}

        {resource.fields.map(field => {
          const id = `${formId}-${field.name}`
          const fieldError = errors[field.name]?.[0]
          const required = field.required || (field.requiredOnCreateOnly && mode === 'create')
          return (
            <Field
              key={field.name}
              id={id}
              label={field.label}
              required={required}
              // Help text gives way to the error message, as before.
              hint={fieldError ? undefined : field.help}
              error={fieldError}
              labelClassName="mb-1 block text-xs font-medium text-gray-600"
            >
              {control =>
                field.type === 'select' ? (
                  <SelectField
                    field={field}
                    control={control}
                    value={values[field.name]}
                    values={values}
                    onChange={v => setValue(field.name, v)}
                  />
                ) : (
                  <input
                    {...control}
                    type={field.type}
                    value={values[field.name]}
                    onChange={e => setValue(field.name, e.target.value)}
                    min={field.type === 'number' ? field.min : undefined}
                    minLength={field.type === 'password' ? field.min : undefined}
                    autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                    className={fieldClass(!!fieldError)}
                  />
                )
              }
            </Field>
          )
        })}

        {mode === 'edit' && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Active
          </label>
        )}
      </form>
    </Modal>
  )
}
