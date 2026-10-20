'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, HardDrive, Wifi, User, MapPin, MessageSquare, UserCheck, Clock, Ticket } from 'lucide-react'
import Navbar from '@/components/NavBar'
import { isAuthenticated, getUser } from '@/lib/auth'
import { createTicket, CreateTicketDevice } from '@/lib/tickets'
import { getEmployees, Employee } from '@/lib/employees'
import { toast } from '@/components/Toast'
import { PRIORITY_STYLES, PRIORITY_FALLBACK } from '@/lib/styles'

// service_department is fixed to IT (1) for now - Engineering (2) isn't
// selectable from this form yet. Surface it here so it's easy to find if
// that changes.
const SERVICE_DEPARTMENT_IT = 1

const CONCERN_TYPES: { value: 'Software' | 'Hardware' | 'Network'; icon: typeof Monitor; description: string }[] = [
  { value: 'Software', icon: Monitor, description: 'Apps, systems, IHOMIS' },
  { value: 'Hardware', icon: HardDrive, description: 'PCs, printers, devices' },
  { value: 'Network', icon: Wifi, description: 'LAN, Wi-Fi, connectivity' },
]

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

const PRIORITY_OPTIONS: { id: number; label: string; sla: number }[] = [
  { id: 1, label: 'Urgent & IHOMIS Related', sla: 1 },
  { id: 2, label: 'Urgent', sla: 2 },
  { id: 3, label: 'Important but not urgent', sla: 3 },
  { id: 4, label: 'Long Term', sla: 10 },
]

// Dot + text color for each priority's SLA line. Mirrors the urgency
// ordering in PRIORITY_STYLES (lib/styles.ts) — kept local since these are
// plain Tailwind classes rather than the pill background/border pairs.
const PRIORITY_META: Record<string, { dot: string; text: string }> = {
  'Urgent & IHOMIS Related': { dot: 'bg-red-500', text: 'text-gray-400' },
  'Urgent': { dot: 'bg-orange-500', text: 'text-gray-400' },
  'Important but not urgent': { dot: 'bg-yellow-500', text: 'text-gray-400' },
  'Long Term': { dot: 'bg-green-500', text: 'text-gray-400' },
}

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
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<{ first_name: string; last_name: string } | null>(null)

  const [typeOfConcern, setTypeOfConcern] = useState<'Software' | 'Hardware' | 'Network' | ''>('')
  const [areaSupervisor, setAreaSupervisor] = useState('')
  const [areaConcerned, setAreaConcerned] = useState('')
  const [assignedUser, setAssignedUser] = useState('')
  const [assignedUserIT, setAssignedUserIT] = useState<Employee[]>([])
  const [remarks, setRemarks] = useState('')
  const [priority, setPriority] = useState<number | null>(null)
  const [devices, setDevices] = useState<CreateTicketDevice[]>([{ type: '', quantity: 1 }])

  useEffect(() => {
    setMounted(true)
    if (!isAuthenticated()) {
      router.push('/auth/login')
      return
    }
    setUser(getUser())

    getEmployees()
      .then(res => {
        setAssignedUserIT(res.result.users)
      })
      .catch(() => {
        toast('Failed to load assigned personnel', 'error')
      })
      .finally(() => setLoading(false))
  }, [router])

  function handleConcernChange(value: 'Software' | 'Hardware' | 'Network') {
    setTypeOfConcern(value)
    if (value === 'Hardware' && devices.length === 0) {
      setDevices([{ type: '', quantity: 1 }])
    }
  }

  function updateDevice(index: number, field: keyof CreateTicketDevice, value: string) {
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

  if (!mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!typeOfConcern || !priority || !areaSupervisor.trim() || !areaConcerned) return

    setLoading(true)
    try {
      await createTicket({
        service_department: SERVICE_DEPARTMENT_IT,
        area_supervisor: areaSupervisor,
        type_of_concern: typeOfConcern,
        devices: typeOfConcern === 'Hardware' ? devices.filter(d => d.type.trim()) : [],
        name_of_area: areaConcerned,
        remarks,
        assigned_user: assignedUser,
        priority,
        requestor: user ? `${user.first_name} ${user.last_name}` : '',
      })
      toast('Ticket created successfully')
      router.push('/my-tickets')
    } catch (err) {
      console.error(err)
      toast('Failed to create ticket', 'error')
    } finally {
      setLoading(false)
    }
  }

  // --- Derived preview data ---
  const now = new Date()
  const previewTicketNumber = `${String(now.getMonth() + 1).padStart(2, '0')}-XXX-${now.getFullYear()}`
  const assignedPerson = assignedUserIT.find(u => String(u.id) === assignedUser)
  const assignedPersonName = assignedPerson ? `${assignedPerson.first_name} ${assignedPerson.last_name}` : ''
  const selectedPriority = PRIORITY_OPTIONS.find(p => p.id === priority)

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

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Type of Concern */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type of Concern <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {CONCERN_TYPES.map(({ value: c, icon: Icon, description }) => {
                  const isActive = typeOfConcern === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleConcernChange(c)}
                      className={`flex flex-col items-start gap-1 py-2.5 px-3.5 rounded-lg border-2 text-left transition ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                        {c}
                      </span>
                      <span className={`text-xs ${isActive ? 'text-blue-500/80' : 'text-gray-400'}`}>
                        {description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Devices - only visible when Hardware is selected */}
            {typeOfConcern === 'Hardware' && (
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
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={typeOfConcern === 'Hardware'}
                      />
                      <input
                        type="number"
                        min={1}
                        value={device.quantity}
                        onChange={e => updateDevice(i, 'quantity', e.target.value)}
                        className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  onChange={e => setAreaConcerned(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select Hospital Area --</option>
                  {HOSPITAL_AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel icon={User}>Area Supervisor</FieldLabel>
                <input
                  type="text"
                  value={areaSupervisor}
                  onChange={e => setAreaSupervisor(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
            </div>

            {/* Remarks */}
            <div>
              <FieldLabel icon={MessageSquare}>Remarks</FieldLabel>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Describe the issue in detail — what happened, when it started, and any error messages."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                required
              />
            </div>

            {/* Assign User */}
            <div>
              <FieldLabel icon={UserCheck}>Personnel Assigned</FieldLabel>
              <select
                value={assignedUser}
                onChange={e => setAssignedUser(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Select Personnel --</option>
                {assignedUserIT.map(person => (
                  <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <FieldLabel icon={Clock}>Priority</FieldLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                {PRIORITY_OPTIONS.map(p => {
                  const style = PRIORITY_STYLES[p.label] ?? PRIORITY_FALLBACK
                  const meta = PRIORITY_META[p.label]
                  const isActive = priority === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      className={`flex items-start gap-2.5 py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition text-left ${
                        isActive ? style.highlight : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        checked={isActive}
                        readOnly
                        className="h-4 w-4 mt-0.5 shrink-0 cursor-pointer"
                      />
                      <div>
                        <div>{p.label}</div>
                        <div className={`flex items-center gap-1.5 text-xs font-normal mt-0.5 ${meta.text}`}>
                          {/* <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> */}
                          {`SLA ${p.sla} ${(p.sla > 1) ? 'days' : 'day'}`}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex py-2.5 px-4 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex py-2.5 px-5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
              >
                {loading ? 'Submitting...' : 'Submit Ticket'}
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
                    Service Level Agreement target: <span className="font-medium text-gray-800">{selectedPriority.sla} days</span>
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