'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, HardDrive, Wifi, User, MapPin, MessageSquare, UserCheck, Clock, Ticket, Tag } from 'lucide-react'
import Navbar from '@/components/NavBar'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { createTicket, CreateTicketDevice } from '@/lib/tickets'
import { getEmployees, Employee } from '@/lib/employees'
import { getPriorities, getConcernTypes, Priority, LookupItem } from '@/lib/lookups'
import { getErrorMessage, isAbortError, isApiError, FieldErrors } from '@/lib/api'
import ErrorState from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/Toast'
import { PRIORITY_STYLES, PRIORITY_FALLBACK, input, inputError, btnPrimary, btnSecondary } from '@/lib/styles'

// service_department is fixed to IT (1) for now - Engineering (2) isn't
// selectable from this form yet. Surface it here so it's easy to find if
// that changes.
const SERVICE_DEPARTMENT_IT = 1

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

function FieldLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Monitor
  children: React.ReactNode
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
      <Icon size={14} className="text-gray-400" />
      {children} <span className="text-red-500">*</span>
    </label>
  )
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {messages[0]}
    </p>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={value ? 'text-gray-700 font-medium' : 'text-gray-300'}>{value || '—'}</span>
    </div>
  )
}

export default function CreateTicketPage() {
  const router = useRouter()
  const authed = useAuthGuard()
  const user = useUser()
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

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
  const [assignedUser, setAssignedUser] = useState('')
  const [remarks, setRemarks] = useState('')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!typeOfConcern || !priority || !areaSupervisor.trim() || !areaConcerned || !assignedUser) return

    setSubmitting(true)
    setFieldErrors({})
    try {
      await createTicket({
        service_department: SERVICE_DEPARTMENT_IT,
        area_supervisor: areaSupervisor,
        type_of_concern: typeOfConcern,
        devices: typeOfConcern === HARDWARE_CONCERN ? devices.filter(d => d.type.trim()) : [],
        name_of_area: areaConcerned,
        remarks,
        assigned_user: Number(assignedUser),
        priority,
        requestor: user ? `${user.first_name} ${user.last_name}` : '',
      })
      toast('Ticket created successfully')
      router.push('/my-tickets')
    } catch (err) {
      console.error(err)
      if (isApiError(err) && err.status === 422 && err.errors) setFieldErrors(err.errors)
      toast(getErrorMessage(err, 'Failed to create ticket'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const fe = (name: string) => fieldErrors[name]
  const cls = (name: string, base = input) => (fe(name) ? `${base} ${inputError}` : base)

  // --- Derived preview data ---
  const now = new Date()
  const previewTicketNumber = `${String(now.getMonth() + 1).padStart(2, '0')}-XXX-${now.getFullYear()}`
  const employees = lookups?.employees ?? []
  const assignedPerson = employees.find(u => String(u.id) === assignedUser)
  const assignedPersonName = assignedPerson ? `${assignedPerson.first_name} ${assignedPerson.last_name}` : ''
  const selectedPriority = lookups?.priorities.find(p => p.id === priority)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-px bg-orange-400" />
            <span className="text-xs font-semibold tracking-widest text-orange-500 uppercase">
              New Request
            </span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-1">Create a new support ticket</h1>
          <p className="text-sm text-gray-500 mb-6">
            Fill in the details below. Fields marked <span className="text-red-500">*</span> are required.
          </p>

          {lookupError && (
            <ErrorState
              message={lookupError}
              onRetry={() => setReloadToken(t => t + 1)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Type of Concern */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type of Concern <span className="text-red-500">*</span>
              </label>
              {!lookups && !lookupError ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                          <Icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                          {label}
                        </span>
                        {meta && (
                          <span className={`text-xs ${isActive ? 'text-blue-500/80' : 'text-gray-400'}`}>
                            {meta.description}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              <FieldError id="err-type_of_concern" messages={fe('type_of_concern')} />
            </div>

            {/* Devices - only visible when Hardware is selected */}
            {typeOfConcern === HARDWARE_CONCERN && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Devices <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {devices.map((device, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={device.type}
                        onChange={e => updateDevice(i, 'type', e.target.value)}
                        placeholder="e.g. Monitor, Printer, Scanner"
                        className={`flex-1 ${cls(`devices.${i}.type`)}`}
                        aria-invalid={!!fe(`devices.${i}.type`)}
                        required={typeOfConcern === HARDWARE_CONCERN}
                      />
                      <input
                        type="number"
                        min={1}
                        value={device.quantity}
                        onChange={e => updateDevice(i, 'quantity', e.target.value)}
                        className={`!w-20 ${cls(`devices.${i}.quantity`)}`}
                        aria-invalid={!!fe(`devices.${i}.quantity`)}
                      />
                      {devices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDeviceRow(i)}
                          className="px-3 text-gray-400 hover:text-red-500 transition"
                          aria-label="Remove device"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <FieldError id="err-devices" messages={fe('devices')} />
                <button
                  type="button"
                  onClick={addDeviceRow}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add another device
                </button>
              </div>
            )}

            {/* Area Supervisor + Area Concerned */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <FieldLabel icon={MapPin}>Area Concerned</FieldLabel>
                <select
                  value={areaConcerned}
                  onChange={e => { setAreaConcerned(e.target.value); clearFieldError('name_of_area') }}
                  className={cls('name_of_area')}
                  aria-invalid={!!fe('name_of_area')}
                  required
                >
                  <option value="">-- Select Hospital Area --</option>
                  {HOSPITAL_AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <FieldError id="err-name_of_area" messages={fe('name_of_area')} />
              </div>

              <div>
                <FieldLabel icon={User}>Area Supervisor</FieldLabel>
                <input
                  type="text"
                  value={areaSupervisor}
                  onChange={e => { setAreaSupervisor(e.target.value); clearFieldError('area_supervisor') }}
                  placeholder="e.g. Jane Doe"
                  className={cls('area_supervisor')}
                  aria-invalid={!!fe('area_supervisor')}
                  required
                />
                <FieldError id="err-area_supervisor" messages={fe('area_supervisor')} />
              </div>
              
            </div>

            {/* Remarks */}
            <div>
              <FieldLabel icon={MessageSquare}>Remarks</FieldLabel>
              <textarea
                value={remarks}
                onChange={e => { setRemarks(e.target.value); clearFieldError('remarks') }}
                placeholder="Describe the issue in detail — what happened, when it started, and any error messages."
                rows={4}
                className={`${cls('remarks')} resize-none`}
                aria-invalid={!!fe('remarks')}
                required
              />
              <FieldError id="err-remarks" messages={fe('remarks')} />
            </div>

            {/* Assign User */}
            <div>
              <FieldLabel icon={UserCheck}>Personnel Assigned</FieldLabel>
              <select
                value={assignedUser}
                onChange={e => { setAssignedUser(e.target.value); clearFieldError('assigned_user') }}
                className={cls('assigned_user')}
                aria-invalid={!!fe('assigned_user')}
                required
              >
                <option value="">-- Select Personnel --</option>
                {employees.map(person => (
                  <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                ))}
              </select>
              <FieldError id="err-assigned_user" messages={fe('assigned_user')} />
            </div>

            {/* Priority */}
            <div>
              <FieldLabel icon={Clock}>Priority</FieldLabel>
              {!lookups && !lookupError ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
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
                        <input
                          type="radio"
                          name="priority"
                          checked={isActive}
                          readOnly
                          tabIndex={-1}
                          className="h-4 w-4 mt-0.5 shrink-0 cursor-pointer"
                        />
                        <div>
                          <div>{p.level}</div>
                          <div className="flex items-center gap-1.5 text-xs font-normal mt-0.5 text-gray-400">
                            {`SLA ${p.sla_days} ${p.sla_days > 1 ? 'days' : 'day'}`}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              <FieldError id="err-priority" messages={fe('priority')} />
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !lookups}
                className={btnPrimary}
              >
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>

        {/* Ticket Preview */}
        <div className="relative bg-white rounded-2xl border border-t-8 border-t-orange-400 p-5 sm:p-6 mt-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <Ticket size={13} className="text-gray-400" />
                <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
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
                    Service Level Agreement target: <span className="font-medium text-gray-800">{selectedPriority.sla_days} days</span>
                </p>
                ) : (
                <p className="text-sm text-gray-400">Select a priority to see the SLA target.</p>
                )}
            </div>
        </div>
      </div>
    </div>
  )
}