'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Field from '@/components/ui/Field'

export default function AuthField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  required = true,
  autoComplete,
  name,
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  /** e.g. "email", "current-password", "new-password", "given-name" */
  autoComplete?: string
  name?: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <Field
      label={label}
      required={required}
      error={error}
      className="flex flex-col gap-1.5"
      labelClassName="text-xs font-semibold text-auth-ink"
      markerClassName="text-auth-accent"
      errorClassName="text-auth-accent text-xs mt-0.5"
    >
      {control => (
        <div className="relative">
          <input
            {...control}
            name={name}
            type={inputType}
            value={value}
            onChange={e => onChange(e.target.value)}
            autoComplete={autoComplete}
            className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white outline-none focus:ring-4 transition ${
              error
                ? 'border-auth-accent focus:border-auth-accent focus:ring-auth-accent/10'
                : 'border-black/10 focus:border-auth-brand focus:ring-auth-brand/10'
            } ${isPassword ? 'pr-10' : ''}`}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-auth-muted hover:text-auth-ink transition focus:outline-none focus-visible:ring-2 focus-visible:ring-auth-brand/40"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Eye size={18} strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      )}
    </Field>
  )
}
