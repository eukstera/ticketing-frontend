// components/Toast.tsx
// Lightweight global toast notifications. Call `toast('message')` from any
// client component (no provider/context wiring needed) and mount
// <ToastContainer /> once, e.g. in app/layout.tsx, to render them.
'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
let listeners: Listener[] = []
let nextId = 1

function emit() {
  listeners.forEach(listener => listener(toasts))
}

export function toast(message: string, type: ToastType = 'success', durationMs = 3000) {
  const id = nextId++
  toasts = [...toasts, { id, message, type }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    emit()
  }, durationMs)
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 text-green-800 border-green-300',
  error: 'bg-red-50 text-red-800 border-red-300',
  info: 'bg-blue-50 text-blue-800 border-blue-300',
}

const TYPE_ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    listeners.push(setItems)
    return () => {
      listeners = listeners.filter(l => l !== setItems)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-md text-sm font-medium pointer-events-auto ${TYPE_STYLES[item.type]}`}
        >
          <span>{TYPE_ICON[item.type]}</span>
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  )
}