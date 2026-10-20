// components/Toast.tsx
// Lightweight global toast notifications. Call `toast('message')` from any
// client component (no provider/context wiring needed) and mount
// <ToastContainer /> once, e.g. in app/layout.tsx, to render them.
'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

type Listener = (toasts: ToastItem[]) => void

// Timer bookkeeping lives outside React state so hover/focus can pause it
interface ToastTimer {
  handle: ReturnType<typeof setTimeout> | null
  remainingMs: number
  startedAt: number
}

let toasts: ToastItem[] = []
let listeners: Listener[] = []
let nextId = 1
const timers = new Map<number, ToastTimer>()

function emit() {
  listeners.forEach(listener => listener(toasts))
}

function dismissToast(id: number) {
  const timer = timers.get(id)
  if (timer?.handle) clearTimeout(timer.handle)
  timers.delete(id)
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

function startTimer(id: number) {
  const timer = timers.get(id)
  if (!timer) return
  timer.startedAt = Date.now()
  timer.handle = setTimeout(() => dismissToast(id), timer.remainingMs)
}

function pauseToast(id: number) {
  const timer = timers.get(id)
  if (!timer?.handle) return
  clearTimeout(timer.handle)
  timer.handle = null
  timer.remainingMs = Math.max(timer.remainingMs - (Date.now() - timer.startedAt), 1000)
}

function resumeToast(id: number) {
  const timer = timers.get(id)
  if (!timer || timer.handle) return
  startTimer(id)
}

export function toast(message: string, type: ToastType = 'success', durationMs = 3000) {
  const id = nextId++
  toasts = [...toasts, { id, message, type }]
  timers.set(id, { handle: null, remainingMs: durationMs, startedAt: 0 })
  startTimer(id)
  emit()
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 text-green-800 border-green-300',
  error: 'bg-red-50 text-red-800 border-red-300',
  info: 'bg-blue-50 text-blue-800 border-blue-300',
}

const TYPE_ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    listeners.push(setItems)
    return () => {
      listeners = listeners.filter(l => l !== setItems)
    }
  }, [])

  // The live region stays mounted even when empty so screen readers
  // register it before the first toast is inserted.
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {items.map(item => {
        const Icon = TYPE_ICON[item.type]
        return (
          <div
            key={item.id}
            role={item.type === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => pauseToast(item.id)}
            onMouseLeave={() => resumeToast(item.id)}
            onFocus={() => pauseToast(item.id)}
            onBlur={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resumeToast(item.id)
            }}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-md text-sm font-medium pointer-events-auto ${TYPE_STYLES[item.type]}`}
          >
            <Icon size={16} className="flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0">{item.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss notification"
              className="flex-shrink-0 -mr-1 w-6 h-6 flex items-center justify-center rounded-full opacity-70 hover:opacity-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
