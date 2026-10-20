'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'
import LoginForm from '@/components/auth/LoginForm'
import { getToken, subscribeAuth } from '@/lib/auth'

export default function AuthPage() {
  const router = useRouter()
  const authed = !!useSyncExternalStore(subscribeAuth, getToken, () => null)

  useEffect(() => {
    if (authed) router.replace('/dashboard')
  }, [authed, router])

  if (authed) return null

  return (
    <AuthShell tagline="One queue for every department. Log in to raise, track, and resolve support tickets across the hospital.">
      <LoginForm />
    </AuthShell>
  )
}