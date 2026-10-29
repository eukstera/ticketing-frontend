// components/ConfirmModal.tsx
'use client'

import { AlertTriangle, Check, HelpCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { btnDanger, btnPrimary, btnSecondary, btnSuccess } from '@/lib/styles'

interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Button text while `loading`. */
  loadingLabel?: string
  variant?: 'danger' | 'success' | 'default'
  loading?: boolean
  /** Inline error shown above the buttons, e.g. when the confirmed action failed. */
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

const VARIANTS = {
  danger: { button: btnDanger, icon: 'bg-red-50 text-red-600', Icon: AlertTriangle },
  success: { button: btnSuccess, icon: 'bg-green-50 text-green-600', Icon: Check },
  default: { button: btnPrimary, icon: 'bg-blue-50 text-blue-600', Icon: HelpCircle },
} as const

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loadingLabel = 'Processing...',
  variant = 'default',
  loading = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const { button, icon, Icon } = VARIANTS[variant]

  return (
    <Modal
      isOpen={isOpen}
      // A request is in flight: don't let Escape / backdrop dismiss it
      onClose={loading ? () => {} : onCancel}
      closeOnBackdrop={!loading}
      ariaLabel={title}
      size="sm"
      bodyClassName="p-6"
    >
      <div className="flex items-start gap-4 mb-5">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${icon}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{message}</p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          // Destructive actions default focus to the safe choice
          autoFocus={variant === 'danger'}
          className={btnSecondary}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          autoFocus={variant !== 'danger'}
          className={button}
        >
          {loading ? loadingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
