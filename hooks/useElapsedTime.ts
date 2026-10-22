import { useEffect, useState } from 'react'
import { DepartmentTicket } from '@/types'
import { formatElapsed } from '@/lib/format'
import { clockStart } from '@/lib/falseAlarm'

/**
 * Returns a live, human-readable "time since" string (e.g. "2h 5m 10s")
 * that updates every second while the component using it is mounted.
 */
export function useElapsedTime(startDate: string) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    function update() {
      const start = new Date(startDate).getTime()
      setElapsed(formatElapsed((Date.now() - start) / 1000))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startDate])

  return elapsed
}


export function getTimerStartDate(ticket: DepartmentTicket): string | null {
  if (['Open', 'In-progress', 'Overdue'].includes(ticket.status)) {
    // Restarts at the latest reopen; the time spent as a false alarm isn't counted.
    return clockStart(ticket)
  }

  // if (ticket.status === 'In-progress' || ticket.status === 'Overdue') {
  //   return ticket.assigned_activity?.created_at ?? null
  // }

  return null
}
