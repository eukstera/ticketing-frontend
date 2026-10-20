// components/ui/Modal.tsx
'use client'

import { ReactNode, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

const SIZE_CLASS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
} as const

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  /** Rendered as the dialog heading and wired to aria-labelledby. */
  title?: string
  /** Required when there is no `title`, so the dialog still has an accessible name. */
  ariaLabel?: string
  size?: keyof typeof SIZE_CLASS
  /** Pinned below the scrolling body (border-t, justify-between). */
  footer?: ReactNode
  /** Backdrop click closes the modal. Set false while a request is in flight. */
  closeOnBackdrop?: boolean
  /** Replaces the default `px-6 py-4` body padding, e.g. 'p-0' for custom lists. */
  bodyClassName?: string
  /** Extra classes on the panel, e.g. 'h-[600px]'. */
  panelClassName?: string
  children: ReactNode
}

export default function Modal({
  isOpen,
  onClose,
  title,
  ariaLabel,
  size = 'md',
  footer,
  closeOnBackdrop = true,
  bodyClassName = 'px-6 py-4',
  panelClassName = '',
  children,
}: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // Latest onClose without re-running the focus/scroll effect on every render
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    // Respect an `autoFocus` child that already took focus; otherwise focus the panel
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4"
      onMouseDown={e => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        className={`bg-white w-full ${SIZE_CLASS[size]} rounded-t-2xl sm:rounded-2xl max-h-[90dvh] sm:max-h-[85vh] flex flex-col outline-none ${panelClassName}`}
      >
        {title && (
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-800">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 -mr-2 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto min-h-0 ${bodyClassName}`}>{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
