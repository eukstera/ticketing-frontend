'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/NavBar'
import TicketForm from '@/components/tickets/TicketForm'
import { toast } from '@/components/Toast'
import ErrorState from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { getErrorMessage, isAbortError, isApiError } from '@/lib/api'
import { ALREADY_FILLED_MESSAGE, BLANK_STATUS, canFillBlank } from '@/lib/fillBlank'
import { getTicket } from '@/lib/tickets'

interface LoadState {
  id: number
  ticket: { id: number; ticket_number: string; status: string } | null
  error: string
  notFound: boolean
}

// Fill in a blank job order (a reserved ticket number with nothing entered yet).
export default function FillTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params)
  const ticketId = Number(rawId)
  const validId = Number.isInteger(ticketId) && ticketId > 0
  const authed = useAuthGuard()
  const user = useUser()
  const router = useRouter()
  const [state, setState] = useState<LoadState | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const roleKnown = !!user?.role
  const allowed = canFillBlank(user)
  const loading = validId && state?.id !== ticketId

  useEffect(() => {
    document.title = 'Fill in ticket – Ticketing System'
  }, [])

  // Encoders and other departments never fill in a blank job order.
  useEffect(() => {
    if (authed && roleKnown && !allowed && validId) router.replace(`/tickets/${ticketId}`)
  }, [authed, roleKnown, allowed, validId, ticketId, router])

  useEffect(() => {
    if (!authed || !validId || !allowed) return
    const controller = new AbortController()
    getTicket(ticketId, controller.signal)
      .then(res => {
        const t = res.result.ticket
        setState({
          id: ticketId,
          ticket: { id: t.id, ticket_number: t.ticket_number, status: t.status.label },
          error: '',
          notFound: false,
        })
      })
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        setState({
          id: ticketId,
          ticket: null,
          error: getErrorMessage(err, 'Failed to load this ticket'),
          notFound: isApiError(err) && (err.status === 404 || err.status === 403),
        })
      })
    return () => controller.abort()
  }, [authed, ticketId, validId, allowed, reloadToken])

  const ticket = state?.id === ticketId ? state.ticket : null
  const notBlank = !!ticket && ticket.status !== BLANK_STATUS

  useEffect(() => {
    if (!notBlank) return
    toast(ALREADY_FILLED_MESSAGE, 'error')
    router.replace(`/tickets/${ticketId}`)
  }, [notBlank, ticketId, router])

  if (!authed) return null
  if (roleKnown && !allowed) return null

  if (ticket && !notBlank) {
    return <TicketForm key={ticket.id} mode="fill" ticket={ticket} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main" className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {!validId || state?.notFound ? (
          <ErrorState message={!validId ? 'This ticket could not be found.' : state?.error ?? ''} />
        ) : state && !loading && state.error ? (
          <ErrorState message={state.error} onRetry={() => { setState(null); setReloadToken(t => t + 1) }} />
        ) : (
          <div role="status" aria-busy="true" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
            <span className="sr-only">Loading…</span>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </main>
    </div>
  )
}
