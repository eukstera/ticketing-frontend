'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useHydrated } from '@/hooks/useHydrated'
import { isApiError } from '@/lib/api'
import { login } from '@/lib/auth'
import AuthField from './AuthField'

export default function LoginForm() {
  const router = useRouter()
  const hydrated = useHydrated()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setErrors({})
    try {
      const res = await login(form)
      if (res.success) {
        router.push('/dashboard')
      } else {
        setError(res.message || 'Login failed')
      }
    } catch (err: unknown) {
      if (isApiError(err)) {
        if (err.status === 429) {
          setError('Too many attempts, try again in a minute.')
        } else if (err.status === 403) {
          setError('Your account is deactivated. Contact your department head.')
        } else if (err.status === 0) {
          setError(err.message)
        } else {
          setError(err.message || 'Login failed')
          if (err.errors) setErrors(err.errors)
        }
      } else {
        setError('Could not reach the server. Check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="font-serif text-[25px] font-medium text-[#0F2B32] mb-1.5">Welcome back</h2>
      <p className="text-[13.5px] text-[#7C8B87] leading-relaxed mb-7">
        Log in with your staff credentials to view and manage your department&apos;s tickets.
      </p>

      {error && (
        <div role="alert" className="bg-[#FAECE7] border border-[#F0997B] text-[#993C1D] rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* method="post": if this ever submits natively (JS not attached, e.g. a
          blocked dev origin) the credentials go in the body, never the URL. */}
      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={v => setForm({ ...form, email: v })}
          error={errors.email?.[0]}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={v => setForm({ ...form, password: v })}
          error={errors.password?.[0]}
        />

        <button
          type="submit"
          disabled={loading || !hydrated}
          className="w-full mt-1 bg-[#0F2B32] hover:bg-[#123B3E] text-white text-sm font-semibold rounded-lg py-2.5 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? 'Logging in…' : 'Log in'}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>
    </>
  )
}
