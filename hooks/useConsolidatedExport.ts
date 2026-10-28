'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/components/Toast'
import { getErrorMessage, isAbortError } from '@/lib/api'
import {
  BLOCKED_MESSAGE,
  EXPORT_FAILED_MESSAGE,
  exportConsolidation,
  type ConsolidationFilters,
} from '@/lib/consolidation'

const ERROR_TOAST_MS = 8_000
const SLOW_MS = 5_000

/**
 * Exports the Consolidation report to Excel for the filters passed to `run`
 * (the APPLIED ones). One export at a time: a second call while one is running
 * (a double click) is ignored. Aborts if the page goes away. `slow` turns true
 * after 5 s so the button can say "Still working…".
 */
export function useConsolidatedExport() {
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)
  // A ref, not `busy`: a fast double-click fires before React re-renders.
  const inFlight = useRef(false)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const run = useCallback(async (filters: ConsolidationFilters) => {
    if (inFlight.current) return
    inFlight.current = true
    const ctrl = new AbortController()
    controller.current = ctrl
    setBusy(true)
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    try {
      const { saved } = await exportConsolidation(filters, ctrl.signal)
      if (saved) toast('Consolidation report downloaded')
      else toast(BLOCKED_MESSAGE, 'error', ERROR_TOAST_MS)
    } catch (err) {
      if (!isAbortError(err)) {
        console.error(err)
        toast(getErrorMessage(err, EXPORT_FAILED_MESSAGE), 'error', ERROR_TOAST_MS)
      }
    } finally {
      clearTimeout(timer)
      inFlight.current = false
      setBusy(false)
      setSlow(false)
    }
  }, [])

  return { busy, slow, run }
}
