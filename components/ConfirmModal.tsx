// components/ConfirmModal.tsx
'use client'

interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'success' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null

  const confirmStyles =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : variant === 'success'
      ? 'bg-green-600 hover:bg-green-700'
      : 'bg-blue-600 hover:bg-blue-700'

  const iconStyles =
    variant === 'danger'
      ? 'bg-red-50 text-red-600'
      : variant === 'success'
      ? 'bg-green-50 text-green-600'
      : 'bg-blue-50 text-blue-600'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg ${iconStyles}`}>
            {variant === 'danger' ? '!' : variant === 'success' ? '✓' : '?'}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-1.5 text-white rounded text-sm font-medium transition disabled:opacity-50 ${confirmStyles}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}