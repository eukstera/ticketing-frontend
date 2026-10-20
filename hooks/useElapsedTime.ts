import { useEffect, useState } from 'react'
import { DepartmentTicket } from '@/types'

/**
 * Returns a live, human-readable "time since" string (e.g. "2h 5m 10s")
 * that updates every second while the component using it is mounted.
 */
export function useElapsedTime(startDate: string) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    function update() {
      const start = new Date(startDate).getTime()
      const now = Date.now()
      const diffMs = now - start

      const totalSeconds = Math.floor(diffMs / 1000)
      const days = Math.floor(totalSeconds / 86400)
      const hours = Math.floor((totalSeconds % 86400) / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60

      if (days > 0) {
        setElapsed(`${days}d ${hours}h ${minutes}m`)
      } else if (hours > 0) {
        setElapsed(`${hours}h ${minutes}m ${seconds}s`)
      } else {
        setElapsed(`${minutes}m ${seconds}s`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startDate])

  return elapsed
}


export function getTimerStartDate(ticket: DepartmentTicket): string | null {
  if (['Open', 'In-progress', 'Overdue'].includes(ticket.status)) {
    const requested = ticket.date_activities?.find(a =>
      a.date_category.category.includes('Requested')
    )
    return requested?.created_at ?? null
  }

  // if (ticket.status === 'In-progress' || ticket.status === 'Overdue') {
  //   return ticket.assigned_activity?.created_at ?? null
  // }

  return null
}
