'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { saveToken, saveUser, register } from '@/lib/auth'
import { getDesignations, createDesignation, Designation } from '@/lib/tickets'
import { AuthResponse } from '@/types'
import AuthField from './AuthField'

const DEPARTMENTS = [
  { id: '1', label: 'IT' },
  { id: '2', label: 'Engineering' }
]

const ROLES = [
  { id: '1', label: 'Normal User' },
  { id: '2', label: 'Department Head' },
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

export default function RegisterForm({ onSwitchToLogin }: { onSwitchToLogin?: () => void }) {
  const router = useRouter()
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

  // Designations are scoped per department, so re-fetch whenever the
  // selected department changes. Clear out the old list/selection first so
  // stale options from the previous department don't briefly show.
  useEffect(() => {
    setDesignations([])
    set('designation_id', '')
    setAddingDesignation(false)
    setDesignationsError('')

    if (!form.department_id) return

    fetchDesignations(Number(form.department_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.department_id])

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

  const set = (field: keyof typeof INITIAL_FORM, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

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
      const res = await register({
        ...form,
        designation_id: Number(form.designation_id),
        department_id: Number(form.department_id),
        role_id: Number(form.role_id),
      })
      
      if (res.success) {
        saveToken(res.result.token)
        saveUser(res.result.user)
        router.push('/dashboard')
      }else{
        const e = res as { message?: string; errors?: Record<string, string[]> }
        setError(e.message || 'Registration failed')
        if (e.errors) setErrors(e.errors)
      }

    } catch (err: unknown) {
        setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="font-serif text-[25px] font-medium text-[#0F2B32] mb-1.5">Register</h2>
      <p className="text-[13.5px] text-[#7C8B87] leading-relaxed mb-7">
        Fill in required details to register.
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
            onChange={e => set('department_id', e.target.value)}
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

        {/* <div>
          <label className="block text-xs font-semibold text-[#0F2B32] mb-2">
            Role <span className="text-[#D9522E]">*</span>
          </label>
          <div className="flex gap-3">
            {ROLES.map(r => (
              <label
                key={r.id}
                className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2.5 text-sm font-medium cursor-pointer transition ${
                  form.role_id === r.id
                    ? 'border-[#1F5C57] bg-[#E4EEE8] text-[#0F2B32]'
                    : 'border-black/10 text-[#4C5C5A] hover:bg-black/[0.02]'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={form.role_id === r.id}
                  onChange={() => set('role_id', r.id)}
                  className="hidden"
                />
                {r.label}
              </label>
            ))}
          </div>
          {errors.role_id && <p className="text-[#D9522E] text-xs mt-1">{errors.role_id[0]}</p>}
        </div> */}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-3 bg-[#0F2B32] hover:bg-[#123B3E] text-white text-sm font-semibold rounded-lg py-2.5 transition disabled:opacity-60"
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>

      {onSwitchToLogin && (
        <p className="text-center text-xs text-[#7C8B87] mt-6">
          Already registered?{' '}
          <button onClick={onSwitchToLogin} className="text-[#D9522E] font-semibold hover:underline">
            Log in
          </button>
        </p>
      )}
    </>
  )
}