'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/components/Toast'
import { fetchAndSaveJobOrder } from '@/lib/jobOrder'
import { JOB_ORDER_FORMATS, getJobOrderFormat, type JobOrderFormat } from '@/lib/jobOrderFormat'

const ERROR_TOAST_MS = 8_000

/**
 * Downloads a ticket's job order, one at a time: a second request (a double
 * click, or the manual button during the automatic download after a take) is
 * ignored while one is running. Aborts if the page goes away.
 */
export function useJobOrderDownload() {
  const [busyId, setBusyId] = useState<number | null>(null)
  // A ref, not `busyId`: a fast double-click fires before React re-renders.
  const inFlight = useRef(false)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  /**
   * `auto` = started by taking the ticket, so a failure says the take itself went
   * fine. `format` defaults to the user's preferred one (Excel unless changed).
   */
  const download = useCallback(
    async (ticketId: number, ticketNumber?: string, opts: { auto?: boolean; format?: JobOrderFormat } = {}) => {
    const auto = opts.auto ?? false
    const format = opts.format ?? getJobOrderFormat()
    if (inFlight.current) return
    inFlight.current = true
    const ctrl = new AbortController()
    controller.current = ctrl
    setBusyId(ticketId)
    try {
      const result = await fetchAndSaveJobOrder(ticketId, { ticketNumber, signal: ctrl.signal, format })
      if (result.ok) {
        const label = JOB_ORDER_FORMATS[format].short
        toast(ticketNumber ? `Job order (${label}) downloaded for ${ticketNumber}` : `Job order (${label}) downloaded`)
      } else if (result.kind !== 'aborted') {
        toast(
          auto
            ? `Ticket taken, but the job order wasn't downloaded: ${result.message} Use "Download JO" to try again.`
            : result.message,
          'error',
          ERROR_TOAST_MS
        )
      }
    } finally {
      inFlight.current = false
      setBusyId(null)
    }
    },
    []
  )

  return { busyId, download }
}
