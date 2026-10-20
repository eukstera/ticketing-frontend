'use client'

import { useState } from 'react'
import { api, isApiError } from '@/lib/api'
import { getDesignations, createDesignation, Designation } from '@/lib/tickets'
import AuthField from './AuthField'

const DEPARTMENTS = [
  { id: '1', label: 'IT' },
  { id: '2', label: 'Engineering' }
]

const ADD_NEW_VALUE = '__add_new__'

const INITIAL_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  designation_id: '',
  department_id: '',
  role_id: 1, // normal user
}

// Admin-only account creation (POST /admin/users). Public self-registration was
// removed, so this is no longer rendered on '/'; it is reused by the admin
// users page. Creating a user never touches the current session.
export default function RegisterForm({ onCreated }: { onCreated?: () => void }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [designations, setDesignations] = useState<Designation[]>([])
  const [loadingDesignations, setLoadingDesignations] = useState(false)
  const [designationsError, setDesignationsError] = useState('')

  const [addingDesignation, setAddingDesignation] = useState(false)
  const [newDesignation, setNewDesignation] = useState('')
  const [savingDesignation, setSavingDesignation] = useState(false)

  const set = (field: keyof typeof INITIAL_FORM, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  async function fetchDesignations(departmentId: number) {
    setLoadingDesignations(true)
    setDesignationsError('')
    try {
      const res = await getDesignations(departmentId)
      setDesignations(res.result?.designations || [])
    } catch (err) {
      console.error(err)
      setDesignationsError("Couldn't load designations.")
    } finally {
      setLoadingDesignations(false)
    }
  }

  // Designations are scoped per department, so re-fetch whenever the
  // selected department changes. Clear out the old list/selection first so
  // stale options from the previous department don't briefly show.
  function handleDepartmentChange(value: string) {
    setForm(prev => ({ ...prev, department_id: value, designation_id: '' }))
    setDesignations([])
    setAddingDesignation(false)
    setDesignationsError('')

    if (value) fetchDesignations(Number(value))
  }

  function handleDesignationChange(value: string) {
    if (value === ADD_NEW_VALUE) {
      setAddingDesignation(true)
      setNewDesignation('')
      return
    }
    set('designation_id', value)
  }

  async function confirmNewDesignation() {
    const trimmed = newDesignation.trim()
    if (!trimmed || savingDesignation || !form.department_id) return

    setSavingDesignation(true)
    setDesignationsError('')
    try {
      const res = await createDesignation(Number(form.department_id), trimmed)
      const created = res.result.designation

      setDesignations(prev =>
        prev.some(d => d.id === created.id) ? prev : [...prev, created]
      )
      set('designation_id', String(created.id))
      setAddingDesignation(false)
      setNewDesignation('')
    } catch (err) {
      console.error(err)
      const apiErr = err as { message?: string; errors?: Record<string, string[]> }
      const duplicateMsg = apiErr.errors?.designation?.[0]

      if (duplicateMsg) {
        // Already exists in this department — drop back to the dropdown so
        // they can select the existing one instead of retyping it.
        setDesignationsError(duplicateMsg)
        setAddingDesignation(false)
        setNewDesignation('')
      } else {
        setDesignationsError("Couldn't add that designation. Try again.")
      }
    } finally {
      setSavingDesignation(false)
    }
  }

  function cancelNewDesignation() {
    setAddingDesignation(false)
    setNewDesignation('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setErrors({})
    try {
      await api.post('/admin/users', {
        ...form,
        designation_id: Number(form.designation_id),
        department_id: Number(form.department_id),
        role_id: Number(form.role_id),
      })
      setForm(INITIAL_FORM)
      setDesignations([])
      onCreated?.()
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Could not create the user')
        if (err.errors) setErrors(err.errors)
      } else {
        setError('Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="font-serif text-[25px] font-medium text-[#0F2B32] mb-1.5">Create user</h2>
      <p className="text-[13.5px] text-[#7C8B87] leading-relaxed mb-7">
        Fill in the required details to create an account.
      </p>

      {error && (
        <div className="bg-[#FAECE7] border border-[#F0997B] text-[#993C1D] rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <AuthField label="First Name" value={form.first_name} onChange={v => set('first_name', v)} error={errors.first_name?.[0]} />
          <AuthField label="Last Name" value={form.last_name} onChange={v => set('last_name', v)} error={errors.last_name?.[0]} />
        </div>

        <AuthField label="Email" type="email" value={form.email} onChange={v => set('email', v)} error={errors.email?.[0]} />
        <AuthField label="Password" type="password" value={form.password} onChange={v => set('password', v)} error={errors.password?.[0]} />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#0F2B32]">
            Department <span className="text-[#D9522E]">*</span>
          </label>
          <select
            value={form.department_id}
            onChange={e => handleDepartmentChange(e.target.value)}
            className="text-sm px-3.5 py-2.5 rounded-lg border border-black/10 bg-white outline-none focus:border-[#1F5C57] focus:ring-4 focus:ring-[#1F5C57]/10 transition"
          >
            <option value="">--Select Department--</option>
            {DEPARTMENTS.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          {errors.department_id && <p className="text-[#D9522E] text-xs mt-0.5">{errors.department_id[0]}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#0F2B32]">
            Designation <span className="text-[#D9522E]">*</span>
          </label>

          {addingDesignation ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newDesignation}
                onChange={e => setNewDesignation(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    
                    e.preventDefault()
                    confirmNewDesignation()
                  }
                  if (e.key === 'Escape') cancelNewDesignation()
                }}
                placeholder="Enter new designation"
                disabled={savingDesignation}
                className="flex-1 text-sm px-3.5 py-2.5 rounded-lg border border-black/10 bg-white outline-none focus:border-[#1F5C57] focus:ring-4 focus:ring-[#1F5C57]/10 transition disabled:opacity-60"
              />
              <button
                type="button"
                onClick={confirmNewDesignation}
                disabled={!newDesignation.trim() || savingDesignation}
                className="px-3.5 rounded-lg bg-[#0F2B32] text-white text-sm font-medium hover:bg-[#123B3E] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDesignation ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={cancelNewDesignation}
                disabled={savingDesignation}
                className="px-3.5 rounded-lg border border-black/10 text-sm text-[#4C5C5A] hover:bg-black/[0.02] transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <select
              value={form.designation_id}
              onChange={e => handleDesignationChange(e.target.value)}
              disabled={!form.department_id || loadingDesignations}
              className="text-sm px-3.5 py-2.5 rounded-lg border border-black/10 bg-white outline-none focus:border-[#1F5C57] focus:ring-4 focus:ring-[#1F5C57]/10 transition disabled:opacity-60"
            >
              <option value="">
                {!form.department_id
                  ? '--Select a department first--'
                  : loadingDesignations
                  ? 'Loading designations...'
                  : '--Select Designation--'}
              </option>
              {designations.map(d => (
                <option key={d.id} value={d.id}>{d.designation}</option>
              ))}
              {form.department_id && !loadingDesignations && (
                <option value={ADD_NEW_VALUE}>+ Add new designation</option>
              )}
            </select>
          )}

          {designationsError && <p className="text-[#D9522E] text-xs mt-0.5">{designationsError}</p>}
          {errors.designation_id && <p className="text-[#D9522E] text-xs mt-0.5">{errors.designation_id[0]}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-3 bg-[#0F2B32] hover:bg-[#123B3E] text-white text-sm font-semibold rounded-lg py-2.5 transition disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Create user'}
        </button>
      </form>
    </>
  )
}