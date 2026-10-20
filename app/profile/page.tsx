'use client'

import { useState } from 'react'
import { Check, Circle } from 'lucide-react'
import Navbar from '@/components/NavBar'
import { toast } from '@/components/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { saveUser } from '@/lib/auth'
import { FieldErrors, getErrorMessage, isApiError } from '@/lib/api'
import { PASSWORD_RULES, changePassword, updateProfile, validateNewPassword } from '@/lib/profile'
import { btnPrimary, input, inputError } from '@/lib/styles'

function TextField({
  id,
  label,
  value,
  onChange,
  errors,
  type = 'text',
  autoComplete,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  errors?: string[]
  type?: 'text' | 'password'
  autoComplete: string
  hint?: React.ReactNode
}) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [errors?.length ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={!!errors?.length}
        aria-describedby={describedBy}
        className={errors?.length ? `${input} ${inputError}` : input}
      />
      {hint && (
        <div id={hintId} className="mt-1 text-xs text-gray-500">
          {hint}
        </div>
      )}
      {errors?.length ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {errors[0]}
        </p>
      ) : null}
    </div>
  )
}

function PasswordChecklist({ password, current }: { password: string; current: string }) {
  const results = PASSWORD_RULES.map(rule => ({ rule, met: rule.test(password, current) }))
  const metCount = results.filter(r => r.met).length

  return (
    <>
      <ul className="space-y-0.5">
        {results.map(({ rule, met }) => (
          <li key={rule.id} className={`flex items-center gap-1.5 ${met ? 'text-green-700' : 'text-gray-500'}`}>
            {met ? <Check size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}
            <span>
              {rule.label}
              <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {metCount} of {PASSWORD_RULES.length} password rules met
      </p>
    </>
  )
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-700">{value || '—'}</dd>
    </div>
  )
}

export default function ProfilePage() {
  const authed = useAuthGuard()
  const user = useUser()

  // Drafts shadow the stored user only while the user is typing.
  const [nameDraft, setNameDraft] = useState<{ first: string; last: string } | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [nameErrors, setNameErrors] = useState<FieldErrors>({})

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({})

  if (!authed) return null

  const firstName = nameDraft?.first ?? user?.first_name ?? ''
  const lastName = nameDraft?.last ?? user?.last_name ?? ''
  const nameChanged = !!user && (firstName.trim() !== user.first_name || lastName.trim() !== user.last_name)

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || savingName) return

    const errors: FieldErrors = {}
    if (!firstName.trim()) errors.first_name = ['Enter your first name.']
    if (!lastName.trim()) errors.last_name = ['Enter your last name.']
    if (Object.keys(errors).length) {
      setNameErrors(errors)
      document.getElementById(errors.first_name ? 'first_name' : 'last_name')?.focus()
      return
    }

    setSavingName(true)
    setNameErrors({})
    try {
      const res = await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim() })
      // Replaces the stored user and notifies subscribers, so NavBar/useUser re-render.
      saveUser({ ...user, ...res.result.user })
      setNameDraft(null)
      toast('Profile updated')
    } catch (err) {
      console.error(err)
      if (isApiError(err) && err.status === 422 && err.errors) setNameErrors(err.errors)
      toast(getErrorMessage(err, 'Failed to update profile'), 'error')
    } finally {
      setSavingName(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (savingPassword) return

    const errors: FieldErrors = {}
    if (!currentPassword) errors.current_password = ['Enter your current password.']
    const newPasswordError = validateNewPassword(newPassword, currentPassword)
    if (newPasswordError) errors.password = [newPasswordError]
    if (confirmPassword !== newPassword) errors.password_confirmation = ['Passwords do not match.']
    const firstInvalid = (['current_password', 'password', 'password_confirmation'] as const).find(k => errors[k])
    if (firstInvalid) {
      setPasswordErrors(errors)
      document.getElementById(firstInvalid)?.focus()
      return
    }

    setSavingPassword(true)
    setPasswordErrors({})
    try {
      await changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast('Password changed. Other sessions were signed out.')
    } catch (err) {
      console.error(err)
      if (isApiError(err) && err.status === 422 && err.errors) {
        setPasswordErrors(err.errors)
        const first = (['current_password', 'password', 'password_confirmation'] as const).find(k => err.errors?.[k])
        if (first) document.getElementById(first)?.focus()
      }
      toast(getErrorMessage(err, 'Failed to change password'), 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold text-gray-800">My profile</h1>

        <section aria-labelledby="profile-heading" className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 id="profile-heading" className="mb-4 text-sm font-semibold text-gray-800">
            Your details
          </h2>

          {!user ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <form onSubmit={handleNameSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  id="first_name"
                  label="First name"
                  value={firstName}
                  onChange={v => {
                    setNameDraft({ first: v, last: lastName })
                    setNameErrors(prev => ({ ...prev, first_name: [] }))
                  }}
                  errors={nameErrors.first_name}
                  autoComplete="given-name"
                />
                <TextField
                  id="last_name"
                  label="Last name"
                  value={lastName}
                  onChange={v => {
                    setNameDraft({ first: firstName, last: v })
                    setNameErrors(prev => ({ ...prev, last_name: [] }))
                  }}
                  errors={nameErrors.last_name}
                  autoComplete="family-name"
                />
              </div>

              <dl className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
                <ReadOnly label="Email" value={user.email} />
                <ReadOnly label="Department" value={user.department?.name} />
                <ReadOnly label="Designation" value={user.designation?.name} />
                <ReadOnly label="Role" value={user.role?.name} />
              </dl>
              <p className="text-xs text-gray-500">
                Email, department, designation and role can only be changed by an administrator.
              </p>

              <div className="flex justify-end">
                <button type="submit" disabled={!nameChanged || savingName} className={btnPrimary}>
                  {savingName ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </section>

        <section aria-labelledby="password-heading" className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 id="password-heading" className="mb-4 text-sm font-semibold text-gray-800">
            Change password
          </h2>
          <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
            <TextField
              id="current_password"
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={v => {
                setCurrentPassword(v)
                setPasswordErrors(prev => ({ ...prev, current_password: [] }))
              }}
              errors={passwordErrors.current_password}
              autoComplete="current-password"
            />
            <TextField
              id="password"
              label="New password"
              type="password"
              value={newPassword}
              onChange={v => {
                setNewPassword(v)
                setPasswordErrors(prev => ({ ...prev, password: [] }))
              }}
              errors={passwordErrors.password}
              autoComplete="new-password"
              hint={<PasswordChecklist password={newPassword} current={currentPassword} />}
            />
            <TextField
              id="password_confirmation"
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={v => {
                setConfirmPassword(v)
                setPasswordErrors(prev => ({ ...prev, password_confirmation: [] }))
              }}
              errors={passwordErrors.password_confirmation}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500">
              Changing your password signs you out of your other sessions; this one stays signed in.
            </p>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className={btnPrimary}
              >
                {savingPassword ? 'Changing…' : 'Change password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
