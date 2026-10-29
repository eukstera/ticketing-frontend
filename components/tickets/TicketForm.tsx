'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Monitor, HardDrive, Wifi, User, MapPin, MessageSquare, UserCheck, Clock, Ticket, Tag, X, Circle, CircleDot, Mail, CalendarClock } from 'lucide-react'
import Navbar from '@/components/NavBar'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { createTicket, CreateTicketDevice } from '@/lib/tickets'
import { IT_DEPARTMENT_ID } from '@/lib/constants'
import { slaLabel } from '@/lib/format'
import { mapCreateTicketErrors, FILL_TICKET_FIELDS } from '@/lib/createTicketErrors'
import { isAdmin } from '@/lib/auth'
import {
  ALREADY_FILLED_MESSAGE,
  fillBlankTicket,
  isValidEmail,
  requestedAtError,
  toApiDateTime,
  toLocalInput,
  type FillBlankPayload,
} from '@/lib/fillBlank'
import { getEmployees, Employee } from '@/lib/employees'
import { getPriorities, getConcernTypes, Priority, LookupItem } from '@/lib/lookups'
import { getErrorMessage, isAbortError, isApiError, FieldErrors } from '@/lib/api'
import ErrorState from '@/components/ui/ErrorState'
import Field, { FieldGroup, fieldClass } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/Toast'
import { PRIORITY_STYLES, PRIORITY_FALLBACK, btnPrimary, btnSecondary } from '@/lib/styles'

// service_department is fixed to IT for now - Engineering isn't selectable from
// this form yet.
const SERVICE_DEPARTMENT_IT = IT_DEPARTMENT_ID

// Icon/description per known concern label; unknown labels from the BE fall back to Tag.
const CONCERN_META: Record<string, { icon: typeof Monitor; description: string }> = {
  Software: { icon: Monitor, description: 'Apps, systems, IHOMIS' },
  Hardware: { icon: HardDrive, description: 'PCs, printers, devices' },
  Network: { icon: Wifi, description: 'LAN, Wi-Fi, connectivity' },
}
const HARDWARE_CONCERN = 'Hardware'

const HOSPITAL_AREAS = [
  'Emergency Room',
  'Medical Ward',
  'Accounting',
  'Claims',
  'Medical Records',
  'Pedia Ward',
  'Admitting',
  'OBGYN Ward',
  'Surgery Ward',
  'Supply',
  'Medical Social Services',
  'Pharmacy',
  'Engineering and Facilities Management Section',
  'Information and Communications Technology Section',
  'Human Resources',
  'Laboratory',
]

// Group fields (cards, device rows) are focused through their first control.
function focusField(elementId: string) {
  const el = document.getElementById(elementId)
  if (!el) return
  const target = el.matches('input, select, textarea, button') ? el : el.querySelector<HTMLElement>('button, input')
  target?.focus()
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={value ? 'text-gray-700 font-medium' : 'text-gray-500'}>{value || '—'}</span>
    </div>
  )
}

export type TicketFormProps =
  | { mode: 'create' }
  /** Fill in a blank job order: the reserved number is fixed, and the requester and date are entered. */
  | { mode: 'fill'; ticket: { id: number; ticket_number: string; owner?: { id: number; name: string } | null } }

/** Shared by Create Ticket (new request) and Fill in ticket (blank job order). */
export default function TicketForm(props: TicketFormProps) {
  const fillTicket = props.mode === 'fill' ? props.ticket : null
  const fill = fillTicket !== null
  const router = useRouter()
  const authed = useAuthGuard()
  const user = useUser()
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  // Errors the API reports for something with no control (e.g. an inactive service department).
  const [banner, setBanner] = useState('')
  const bannerRef = useRef<HTMLDivElement>(null)
  // Set after a failed submit; the effect below focuses the first problem once it is rendered.
  const [focusRequest, setFocusRequest] = useState<{ seq: number; id: string | null } | null>(null)

  const [lookups, setLookups] = useState<{
    priorities: Priority[]
    concernTypes: LookupItem[]
    employees: Employee[]
  } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [typeOfConcern, setTypeOfConcern] = useState('')
  const [areaSupervisor, setAreaSupervisor] = useState('')
  const [areaConcerned, setAreaConcerned] = useState('')
  // Fill-in: the member who printed the blank job order owns the ticket; a Head may hand it on.
  const owner = fillTicket?.owner ?? null
  const [assignedUser, setAssignedUser] = useState(owner ? String(owner.id) : '')
  const [remarks, setRemarks] = useState('')
  const [requestor, setRequestor] = useState('')
  const [requestorEmail, setRequestorEmail] = useState('')
  const [requestedAt, setRequestedAt] = useState('')
  const [priority, setPriority] = useState<number | null>(null)
  const [devices, setDevices] = useState<CreateTicketDevice[]>([{ type: '', quantity: 1 }])

  useEffect(() => {
    if (!authed) return
    const controller = new AbortController()
    const { signal } = controller

    Promise.all([
      getPriorities(SERVICE_DEPARTMENT_IT, signal),
      getConcernTypes(signal),
      getEmployees(SERVICE_DEPARTMENT_IT, signal),
    ])
      .then(([p, c, e]) => {
        setLookupError('')
        setLookups({
          priorities: p.result.priorities,
          concernTypes: c.result.concern_types,
          employees: e.result.users,
        })
      })
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setLookupError(getErrorMessage(err, 'Failed to load the form options'))
      })
    return () => controller.abort()
  }, [authed, reloadToken])

  useEffect(() => {
    if (!focusRequest) return
    if (focusRequest.id) focusField(focusRequest.id)
    else bannerRef.current?.focus()
  }, [focusRequest])

  function clearFieldError(...names: string[]) {
    setFieldErrors(prev => {
      if (!names.some(n => prev[n])) return prev
      const next = { ...prev }
      names.forEach(n => delete next[n])
      return next
    })
  }

  function handleConcernChange(value: string) {
    setTypeOfConcern(value)
    clearFieldError('type_of_concern', 'devices')
    if (value === HARDWARE_CONCERN && devices.length === 0) {
      setDevices([{ type: '', quantity: 1 }])
    }
  }

  function updateDevice(index: number, field: keyof CreateTicketDevice, value: string) {
    clearFieldError('devices', `devices.${index}.${field === 'type' ? 'type' : 'quantity'}`)
    setDevices(prev =>
      prev.map((d, i) =>
        i !== index ? d : { ...d, [field]: field === 'quantity' ? Math.max(1, Number(value) || 1) : value }
      )
    )
  }

  function addDeviceRow() {
    setDevices(prev => [...prev, { type: '', quantity: 1 }])
  }

  function removeDeviceRow(index: number) {
    setDevices(prev => prev.filter((_, i) => i !== index))
  }

  if (!authed) return null

  // Mirrors the BE's required rules so empty fields are flagged next to the
  // field (and focused) instead of the submit button silently doing nothing.
  function validate(): { errors: FieldErrors; firstId: string | null } {
    const errors: FieldErrors = {}
    const order: [string, string][] = []
    const need = (name: string, elementId: string, message: string) => {
      errors[name] = [message]
      order.push([name, elementId])
    }

    if (fill) {
      if (!requestor.trim()) need('requestor', 'f-requestor', 'Enter the requester’s name.')
      if (requestorEmail.trim() && !isValidEmail(requestorEmail)) {
        need('requestor_email', 'f-requestor_email', 'Enter a valid email address.')
      }
      const dateError = requestedAtError(requestedAt)
      if (dateError) need('requested_at', 'f-requested_at', dateError)
    }
    if (!typeOfConcern) need('type_of_concern', 'f-type_of_concern', 'Select a type of concern.')
    if (typeOfConcern === HARDWARE_CONCERN && !devices.some(d => d.type.trim())) {
      need('devices', 'f-devices.0.type', 'Add at least one device.')
    }
    if (!areaConcerned) need('name_of_area', 'f-name_of_area', 'Select the area concerned.')
    if (!areaSupervisor.trim()) need('area_supervisor', 'f-area_supervisor', 'Enter the area supervisor.')
    if (!remarks.trim()) need('remarks', 'f-remarks', 'Describe the issue.')
    if (!fill && !assignedUser) need('assigned_user', 'f-assigned_user', 'Select the personnel to assign.')
    if (!priority) need('priority', 'f-priority', 'Select a priority.')

    return { errors, firstId: order[0]?.[1] ?? null }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanner('')

    const { errors, firstId } = validate()
    if (firstId) {
      setFieldErrors(errors)
      focusField(firstId)
      return
    }

    setSubmitting(true)
    setFieldErrors({})
    try {
      if (fillTicket) {
        const payload: FillBlankPayload = {
          requested_at: toApiDateTime(requestedAt),
          requestor: requestor.trim(),
          area_supervisor: areaSupervisor,
          type_of_concern: typeOfConcern,
          name_of_area: areaConcerned,
          remarks,
          priority: priority!,
        }
        if (requestorEmail.trim()) payload.requestor_email = requestorEmail.trim()
        // Only a Head hands the ticket to someone other than its owner; staff send nothing.
        if (isAdmin(user) && assignedUser && Number(assignedUser) !== owner?.id) payload.assigned_user = Number(assignedUser)
        if (typeOfConcern === HARDWARE_CONCERN) payload.devices = devices.filter(d => d.type.trim())
        await fillBlankTicket(fillTicket.id, payload)
        toast(`Ticket ${fillTicket.ticket_number} saved`)
        router.push(`/tickets/${fillTicket.id}`)
        return
      }
      await createTicket({
        service_department: SERVICE_DEPARTMENT_IT,
        area_supervisor: areaSupervisor,
        type_of_concern: typeOfConcern,
        devices: typeOfConcern === HARDWARE_CONCERN ? devices.filter(d => d.type.trim()) : [],
        name_of_area: areaConcerned,
        remarks,
        assigned_user: Number(assignedUser),
        priority: priority!,
        requestor: user ? `${user.first_name} ${user.last_name}` : '',
      })
      toast('Ticket created successfully')
      router.push('/my-tickets')
    } catch (err) {
      console.error(err)
      if (isApiError(err) && err.status === 422) {
        // Shown inline (role="alert") or in the banner; a toast would announce it twice.
        const mapped = mapCreateTicketErrors(
          err.errors,
          getErrorMessage(err, fill ? 'Failed to save ticket' : 'Failed to create ticket'),
          fill ? FILL_TICKET_FIELDS : undefined
        )
        setFieldErrors(mapped.fieldErrors)
        setBanner(mapped.banner)
        setFocusRequest(prev => ({ seq: (prev?.seq ?? 0) + 1, id: mapped.firstElementId }))
      } else if (fillTicket && isApiError(err) && err.status === 409) {
        // Someone else filled it in (or it is no longer blank): the detail page shows the current state.
        toast(ALREADY_FILLED_MESSAGE, 'error')
        router.replace(`/tickets/${fillTicket.id}`)
      } else if (fill && isApiError(err) && (err.status === 403 || err.status === 404)) {
        // Keep the user's input; say why it can't be saved.
        setBanner(getErrorMessage(err, 'Failed to save ticket'))
        setFocusRequest(prev => ({ seq: (prev?.seq ?? 0) + 1, id: null }))
      } else {
        toast(getErrorMessage(err, fill ? 'Failed to save ticket' : 'Failed to create ticket'), 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fe = (name: string) => fieldErrors[name]
  const hasDeviceError = Object.keys(fieldErrors).some(k => k === 'devices' || k.startsWith('devices.'))

  // --- Derived preview data ---
  const now = new Date()
  const previewTicketNumber =
    fillTicket?.ticket_number ?? `${String(now.getMonth() + 1).padStart(2, '0')}-XXX-${now.getFullYear()}`
  const employees = lookups?.employees ?? []
  const showAssign = !fill || isAdmin(user)
  const assignedPerson = employees.find(u => String(u.id) === assignedUser)
  const assignedPersonName = assignedPerson ? `${assignedPerson.first_name} ${assignedPerson.last_name}` : ''
  const selectedPriority = lookups?.priorities.find(p => p.id === priority)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main" className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-px bg-orange-400" />
            <span className="text-xs font-semibold tracking-widest text-orange-500 uppercase">
              {fill ? 'Blank Job Order' : 'New Request'}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-1">{fill ? 'Fill in ticket' : 'Create a new support ticket'}</h1>
          <p className="text-sm text-gray-500 mb-6">
            {fill ? 'Enter the details from the paper job order. ' : 'Fill in the details below. '}
            Fields marked <span className="text-red-500">*</span> are required.
          </p>

          {lookupError && (
            <ErrorState
              message={lookupError}
              onRetry={() => setReloadToken(t => t + 1)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
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

            {fillTicket && (
              <>
                <div>
                  <p id="f-ticket_number-label" className="mb-1 text-sm font-medium text-gray-700">Ticket number</p>
                  <div
                    role="group"
                    aria-labelledby="f-ticket_number-label"
                    aria-describedby="f-ticket_number-hint"
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800"
                  >
                    {fillTicket.ticket_number}
                  </div>
                  <p id="f-ticket_number-hint" className="mt-1 text-xs text-gray-500">
                    Reserved &mdash; can&apos;t be changed
                    {owner && <> &middot; Taken by <span className="font-medium text-gray-700">{owner.name}</span></>}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field id="f-requestor" icon={User} label="Requester" required error={fe('requestor')?.[0]}>
                    {control => (
                      <input
                        {...control}
                        type="text"
                        maxLength={255}
                        value={requestor}
                        onChange={e => { setRequestor(e.target.value); clearFieldError('requestor') }}
                        placeholder="Name written on the paper form"
                        className={fieldClass(control['aria-invalid'])}
                      />
                    )}
                  </Field>
                  <Field
                    id="f-requestor_email"
                    icon={Mail}
                    label="Requester email"
                    error={fe('requestor_email')?.[0]}
                    hint="Optional. Used to send the confirmation email."
                  >
                    {control => (
                      <input
                        {...control}
                        type="email"
                        value={requestorEmail}
                        onChange={e => { setRequestorEmail(e.target.value); clearFieldError('requestor_email') }}
                        placeholder="name@example.com"
                        className={fieldClass(control['aria-invalid'])}
                      />
                    )}
                  </Field>
                </div>

                <Field
                  id="f-requested_at"
                  icon={CalendarClock}
                  label="Date & time requested"
                  required
                  error={fe('requested_at')?.[0]}
                  hint="As written on the paper form"
                >
                  {control => (
                    <input
                      {...control}
                      type="datetime-local"
                      max={toLocalInput(new Date())}
                      value={requestedAt}
                      onChange={e => { setRequestedAt(e.target.value); clearFieldError('requested_at') }}
                      className={fieldClass(control['aria-invalid'])}
                    />
                  )}
                </Field>
              </>
            )}

            {/* Type of Concern */}
            <FieldGroup
              id="f-type_of_concern"
              label="Type of Concern"
              required
              error={fe('type_of_concern')?.[0]}
              labelClassName="block text-sm font-medium text-gray-700 mb-2"
            >
              {group => (
                <>
                  {!lookups && !lookupError ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                    </div>
                  ) : (
                    <div {...group} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(lookups?.concernTypes ?? []).map(({ id, label }) => {
                        const meta = CONCERN_META[label]
                        const Icon = meta?.icon ?? Tag
                        const isActive = typeOfConcern === label
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleConcernChange(label)}
                            aria-pressed={isActive}
                            className={`flex flex-col items-start gap-1 py-2.5 px-3.5 rounded-lg border-2 text-left transition ${
                              isActive
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <Icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-500'} aria-hidden="true" />
                              {label}
                            </span>
                            {meta && (
                              <span className={`text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                                {meta.description}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {lookups && lookups.concernTypes.length === 0 && (
                    <p className="text-sm text-gray-500">No concern types are configured yet. Ask an administrator to add them.</p>
                  )}
                </>
              )}
            </FieldGroup>

            {/* Devices - only visible when Hardware is selected */}
            {typeOfConcern === HARDWARE_CONCERN && (
              <FieldGroup
                id="f-devices"
                label="Devices"
                required
                error={fe('devices')?.[0]}
                labelClassName="block text-sm font-medium text-gray-700 mb-2"
              >
                {group => (
                  <>
                    <div {...group} className="space-y-2">
                      {devices.map((device, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            id={`f-devices.${i}.type`}
                            type="text"
                            aria-label={`Device ${i + 1} name`}
                            value={device.type}
                            onChange={e => updateDevice(i, 'type', e.target.value)}
                            placeholder="e.g. Monitor, Printer, Scanner"
                            className={`flex-1 ${fieldClass(!!fe(`devices.${i}.type`) || !!fe('devices'))}`}
                            aria-invalid={!!fe(`devices.${i}.type`) || !!fe('devices')}
                            aria-describedby={hasDeviceError ? 'f-devices-error' : undefined}
                          />
                          <input
                            id={`f-devices.${i}.quantity`}
                            type="number"
                            aria-label={`Device ${i + 1} quantity`}
                            min={1}
                            value={device.quantity}
                            onChange={e => updateDevice(i, 'quantity', e.target.value)}
                            className={`!w-20 ${fieldClass(!!fe(`devices.${i}.quantity`))}`}
                            aria-invalid={!!fe(`devices.${i}.quantity`)}
                            aria-describedby={fe(`devices.${i}.quantity`) ? 'f-devices-error' : undefined}
                          />
                          {devices.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDeviceRow(i)}
                              className="px-3 text-gray-500 hover:text-red-600 transition rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                              aria-label={`Remove device ${i + 1}`}
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addDeviceRow}
                      className="mt-2 rounded text-sm text-blue-700 hover:text-blue-800 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      + Add another device
                    </button>
                  </>
                )}
              </FieldGroup>
            )}

            {/* Area Supervisor + Area Concerned */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field id="f-name_of_area" icon={MapPin} label="Area Concerned" required error={fe('name_of_area')?.[0]}>
                {control => (
                  <select
                    {...control}
                    value={areaConcerned}
                    onChange={e => { setAreaConcerned(e.target.value); clearFieldError('name_of_area') }}
                    className={fieldClass(control['aria-invalid'])}
                  >
                    <option value="">-- Select Hospital Area --</option>
                    {HOSPITAL_AREAS.map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                )}
              </Field>

              <Field id="f-area_supervisor" icon={User} label="Area Supervisor" required error={fe('area_supervisor')?.[0]}>
                {control => (
                  <input
                    {...control}
                    type="text"
                    value={areaSupervisor}
                    onChange={e => { setAreaSupervisor(e.target.value); clearFieldError('area_supervisor') }}
                    placeholder="e.g. Jane Doe"
                    className={fieldClass(control['aria-invalid'])}
                  />
                )}
              </Field>

            </div>

            {/* Remarks */}
            <Field id="f-remarks" icon={MessageSquare} label="Remarks" required error={fe('remarks')?.[0]}>
              {control => (
                <textarea
                  {...control}
                  value={remarks}
                  onChange={e => { setRemarks(e.target.value); clearFieldError('remarks') }}
                  placeholder="Describe the issue in detail — what happened, when it started, and any error messages."
                  rows={4}
                  className={`${fieldClass(control['aria-invalid'])} resize-none`}
                />
              )}
            </Field>

            {/* Assign User (Create: required; Fill-in: Heads only, defaults to the owner) */}
            {showAssign && <Field
              id="f-assigned_user"
              icon={UserCheck}
              label={fill ? 'Assign to' : 'Personnel Assigned'}
              required={!fill}
              error={fe('assigned_user')?.[0]}
              hint={
                fill
                  ? owner
                    ? 'Defaults to the member who printed this job order. Pick someone else to hand it over.'
                    : 'Optional.'
                  : undefined
              }
            >
              {control => (
                <select
                  {...control}
                  disabled={!lookups}
                  value={assignedUser}
                  onChange={e => { setAssignedUser(e.target.value); clearFieldError('assigned_user') }}
                  className={fieldClass(control['aria-invalid'])}
                >
                  {(!fill || !owner) && (
                    <option value="">
                      {!lookups
                        ? 'Loading…'
                        : fill
                          ? '-- Leave as is --'
                          : employees.length === 0
                            ? 'No personnel available'
                            : '-- Select Personnel --'}
                    </option>
                  )}
                  {employees.map(person => (
                    <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                  ))}
                </select>
              )}
            </Field>}

            {/* Priority */}
            <FieldGroup id="f-priority" icon={Clock} label="Priority" required error={fe('priority')?.[0]}>
              {group => (
                <>
                  {!lookups && !lookupError ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                    </div>
                  ) : (
                    <div {...group} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      {(lookups?.priorities ?? []).map(p => {
                        const style = PRIORITY_STYLES[p.level] ?? PRIORITY_FALLBACK
                        const isActive = priority === p.id
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setPriority(p.id); clearFieldError('priority') }}
                            aria-pressed={isActive}
                            className={`flex items-start gap-2.5 py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition text-left ${
                              isActive ? style.highlight : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {isActive ? (
                              <CircleDot size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <Circle size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
                            )}
                            <div>
                              <div>{p.level}</div>
                              <div className="flex items-center gap-1.5 text-xs font-normal mt-0.5 text-gray-500">
                                {slaLabel(p.sla_days)}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {lookups && lookups.priorities.length === 0 && (
                    <p className="text-sm text-gray-500">No priorities are configured for this department yet. Ask an administrator to add them.</p>
                  )}
                </>
              )}
            </FieldGroup>

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-2">
              {fill ? (
                <Link href="/tickets" className={btnSecondary}>Cancel</Link>
              ) : (
                <button
                  type="button"
                  onClick={() => router.back()}
                  className={btnSecondary}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !lookups}
                className={btnPrimary}
              >
                {fill ? (submitting ? 'Saving…' : 'Save ticket') : submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>

        {/* Ticket Preview */}
        <div className="relative bg-white rounded-2xl border border-t-8 border-t-orange-400 p-5 sm:p-6 mt-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <Ticket size={13} className="text-gray-500" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">
                Ticket Preview
                </span>
            </div>
            <p className="text-lg font-semibold text-gray-800 mb-4">{previewTicketNumber}</p>
            <div className="space-y-2">
                <PreviewRow label="Concern" value={typeOfConcern} />
                <PreviewRow label="Area" value={areaConcerned} />
                <PreviewRow label="Assigned" value={assignedPersonName} />
            </div>

            {/* Perforated divider with half-circle notches */}
            <div className="relative -mx-5 sm:-mx-6 mt-4 h-0">
                <div className="border-t-2 ml-5 mr-5 border-dashed border-gray-300" />
                <span className="absolute -left-0.5 top-0 w-4 h-8 -translate-y-1/2 rounded-r-full bg-gray-50 border border-l-0 border-gray-200" />
                <span className="absolute -right-0.5 top-0 w-4 h-8 -translate-y-1/2 rounded-l-full bg-gray-50 border border-r-0 border-gray-200" />
            </div>

            <div className="pt-7">
                {selectedPriority ? (
                <p className="text-sm text-gray-600">
                    Service Level Agreement target:{' '}
                    <span className="font-medium text-gray-800">
                      {selectedPriority.sla_days > 0 ? `${selectedPriority.sla_days} ${selectedPriority.sla_days === 1 ? 'day' : 'days'}` : 'none'}
                    </span>
                </p>
                ) : (
                <p className="text-sm text-gray-500">Select a priority to see the SLA target.</p>
                )}
            </div>
        </div>
      </main>
    </div>
  )
}
