'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

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
  const id = useId()
  const errorId = `${id}-error`
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-auth-ink">
        {label} {required && <span className="text-auth-accent" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
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
      {error && (
        <p id={errorId} role="alert" className="text-auth-accent text-xs mt-0.5">
          {error}
        </p>
      )}
    </div>
  )
}
