// components/ui/Field.tsx
// One place for label <-> control wiring, required marker, hint and error, so
// every form gets the same accessible structure.
import { ReactNode, useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import { input, inputError } from '@/lib/styles'

/** Props Field hands to its control; spread them onto the <input>/<select>/<textarea>. */
export interface FieldControlProps {
  id: string
  required?: boolean
  'aria-invalid': boolean
  'aria-describedby'?: string
}

/** `input`, plus `inputError` when the field is invalid. Pass a different base for other looks. */
export function fieldClass(hasError?: boolean, base: string = input): string {
  return hasError ? `${base} ${inputError}` : base
}

const LABEL_CLASS = 'mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700'

interface FieldProps {
  label: string
  /** Decorative lucide icon before the label text. */
  icon?: LucideIcon
  required?: boolean
  /** Helper text under the control; linked via aria-describedby. */
  hint?: ReactNode
  /** Validation message; announced (role="alert") and linked via aria-describedby. */
  error?: string
  className?: string
  /** Overrides the default label / marker / hint / error classes (e.g. the auth look). */
  labelClassName?: string
  markerClassName?: string
  hintClassName?: string
  errorClassName?: string
  children: (control: FieldControlProps) => ReactNode
}

export default function Field({
  label,
  icon: Icon,
  required,
  hint,
  error,
  className,
  labelClassName = LABEL_CLASS,
  markerClassName = 'text-red-500',
  hintClassName = 'mt-1 text-xs text-gray-500',
  errorClassName = 'mt-1 text-xs text-red-600',
  children,
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClassName}>
        {Icon && <Icon size={14} className="text-gray-400" aria-hidden="true" />}
        <span>
          {label}
          {required && (
            <span className={markerClassName} aria-hidden="true">
              {' *'}
            </span>
          )}
        </span>
      </label>
      {children({ id, required, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {hint && (
        <div id={hintId} className={hintClassName}>
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className={errorClassName}>
          {error}
        </p>
      )}
    </div>
  )
}
