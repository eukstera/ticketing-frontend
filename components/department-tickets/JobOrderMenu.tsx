'use client'

import { KeyboardEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, FileDown } from 'lucide-react'
import {
  JOB_ORDER_FORMATS,
  getJobOrderFormat,
  getServerJobOrderFormat,
  setJobOrderFormat,
  subscribeJobOrderFormat,
  type JobOrderFormat,
} from '@/lib/jobOrderFormat'
import { btnSecondary, btnSm } from '@/lib/styles'

const nowrap = 'whitespace-nowrap shrink-0'
const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const FORMATS = Object.keys(JOB_ORDER_FORMATS) as JobOrderFormat[]
// Open the menu upwards when there isn't roughly this much room below the caret.
const MENU_HEIGHT_ESTIMATE = 200
const ITEM = `flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 ${FOCUS_RING} focus-visible:ring-inset`

interface Position {
  right: number
  top?: number
  bottom?: number
}

/**
 * "Download JO" as a split button: the main segment downloads the preferred
 * format right away; the caret opens a menu to download the other format once
 * or to change the preferred one (which the automatic download after Take
 * uses too). The menu is portalled to <body>: the tickets table scrolls
 * horizontally, which would clip a normal dropdown on its last rows.
 */
export default function JobOrderMenu({
  ticketNumber,
  busy = false,
  onDownload,
}: {
  ticketNumber?: string
  /** A job order is downloading; both segments are disabled. */
  busy?: boolean
  onDownload: (format: JobOrderFormat) => void
}) {
  const preferred = useSyncExternalStore(subscribeJobOrderFormat, getJobOrderFormat, getServerJobOrderFormat)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const preferenceLabelId = useId()
  const suffix = ticketNumber ? ` ${ticketNumber}` : ''

  function openMenu() {
    const rect = caretRef.current?.getBoundingClientRect()
    if (rect) {
      const room = window.innerHeight - rect.bottom
      setPosition({
        right: Math.max(8, window.innerWidth - rect.right),
        ...(room < MENU_HEIGHT_ESTIMATE
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    setOpen(true)
  }

  function closeMenu(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) caretRef.current?.focus()
  }

  // A busy download closes the menu: its items would be ignored anyway.
  const menuOpen = open && !busy

  useEffect(() => {
    if (!menuOpen) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (!menuRef.current?.contains(target) && !wrapperRef.current?.contains(target)) setOpen(false)
    }
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      closeMenu(true)
    }
    // The menu is positioned from the caret once; if anything scrolls or resizes, just close it.
    const dismiss = () => setOpen(false)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [menuOpen])

  // Move focus into the menu so keyboard users land on its first item.
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
  }, [menuOpen])

  function handleMenuKeyDown(e: KeyboardEvent) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
    const index = items.findIndex(item => item === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(index + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(index - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  function download(format: JobOrderFormat) {
    closeMenu(true)
    onDownload(format)
  }

  function prefer(format: JobOrderFormat) {
    setJobOrderFormat(format)
    closeMenu(true)
  }

  return (
    <div ref={wrapperRef} role="group" aria-label={`Job order${suffix}`} className="inline-flex shrink-0">
      <button
        type="button"
        onClick={() => onDownload(preferred)}
        disabled={busy}
        aria-label={`Download job order${suffix} as ${JOB_ORDER_FORMATS[preferred].short}`}
        className={`${btnSecondary} ${btnSm} ${nowrap} !rounded-r-none`}
      >
        <FileDown size={12} aria-hidden="true" />
        {busy ? 'Downloading…' : 'Download JO'}
      </button>
      <button
        ref={caretRef}
        type="button"
        onClick={() => (menuOpen ? closeMenu(false) : openMenu())}
        disabled={busy}
        aria-label={`Job order format options${suffix}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        className={`${btnSecondary} ${btnSm} ${nowrap} -ml-px !rounded-l-none !px-1.5`}
      >
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {menuOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`Job order${suffix}`}
            onKeyDown={handleMenuKeyDown}
            style={{ position: 'fixed', right: position.right, top: position.top, bottom: position.bottom }}
            className="z-50 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
          >
            {FORMATS.map(format => (
              <button key={format} type="button" role="menuitem" onClick={() => download(format)} className={ITEM}>
                Download as {JOB_ORDER_FORMATS[format].label}
              </button>
            ))}
            <div role="separator" className="my-1 border-t border-gray-100" />
            <p id={preferenceLabelId} className="px-3 pb-1 pt-1.5 text-[11px] font-medium text-gray-500">
              Format for Download JO and after Take ticket
            </p>
            <div role="group" aria-labelledby={preferenceLabelId}>
              {FORMATS.map(format => (
                <button
                  key={format}
                  type="button"
                  role="menuitemradio"
                  aria-checked={preferred === format}
                  onClick={() => prefer(format)}
                  className={ITEM}
                >
                  {JOB_ORDER_FORMATS[format].short}
                  {preferred === format && <Check size={14} className="text-blue-600" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
