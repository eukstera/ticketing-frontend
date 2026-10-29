'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from '@/components/Toast'
import { getErrorMessage } from '@/lib/api'
import { printBlankJobOrder } from '@/lib/blankJobOrder'
import { RESERVE_FAILED_FALLBACK, reservedMessage, reservedNotDownloadedMessage } from '@/lib/blankMessages'
import { fetchAndSaveJobOrder } from '@/lib/jobOrder'
import { createBlankJobOrder } from '@/lib/tickets'

const ERROR_TOAST_MS = 8_000

/**
 * Reserves a blank ticket number and downloads its PDF. One request at a time:
 * every reserve burns a number, so a second call while one runs is ignored
 * (a ref, because a fast double-click fires before React re-renders).
 * Resolves true when a number was reserved, so the caller can refresh the list.
 */
export function usePrintBlankJobOrder() {
  const [printing, setPrinting] = useState(false)
  const inFlight = useRef(false)

  const print = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false
    inFlight.current = true
    setPrinting(true)
    try {
      const result = await printBlankJobOrder({
        reserve: async () => {
          const res = await createBlankJobOrder()
          return { id: res.result.ticket.id, ticket_number: res.result.ticket.ticket_number }
        },
        download: async ticket => {
          const saved = await fetchAndSaveJobOrder(ticket.id, { ticketNumber: ticket.ticket_number, format: 'pdf' })
          return saved.ok ? { ok: true } : { ok: false, message: saved.kind === 'aborted' ? '' : saved.message }
        },
      })
      if (!result.reserved) {
        console.error(result.error)
        toast(getErrorMessage(result.error, RESERVE_FAILED_FALLBACK), 'error', ERROR_TOAST_MS)
        return false
      }
      if (result.saved) toast(reservedMessage(result.ticket.ticket_number))
      else toast(reservedNotDownloadedMessage(result.ticket.ticket_number), 'error', ERROR_TOAST_MS)
      return true
    } finally {
      inFlight.current = false
      setPrinting(false)
    }
  }, [])

  return { printing, print }
}
