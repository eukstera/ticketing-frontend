'use client'

import { useState } from 'react'

export default function AuthField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  required = true,
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#0F2B32]">
        {label} {required && <span className="text-[#D9522E]">*</span>}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full text-sm px-3.5 py-2.5 rounded-lg border border-black/10 bg-white outline-none focus:border-[#1F5C57] focus:ring-4 focus:ring-[#1F5C57]/10 transition ${
            isPassword ? 'pr-10' : ''
          }`}
          placeholder="(Required)"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C8B87] hover:text-[#0F2B32] transition"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6 0-10-6-10-7a12.55 12.55 0 0 1 4.06-4.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6 0 10 6 10 7a12.65 12.65 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && <p className="text-[#D9522E] text-xs mt-0.5">{error}</p>}
    </div>
  )
}