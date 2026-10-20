'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'
import LoginForm from '@/components/auth/LoginForm'
import RegisterForm from '@/components/auth/RegisterForm'
import { isAuthenticated } from '@/lib/auth'

export default function AuthPage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard')
      return
    }
    setChecked(true)
  }, [router])

  if (!checked) return null

  return (
    <AuthShell tagline="One queue for every department. Log in to raise, track, and resolve support tickets across the hospital.">
      <div className="flex gap-1 bg-[#DFDFDF] rounded-[10px] p-1 mb-8">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 py-2.5 rounded-[7px] text-[13.5px] font-semibold transition ${
            mode === 'login' ? 'bg-white text-[#0F2B32] shadow-sm' : 'text-[#4C5C5A]'
          }`}
        >
          Log in
        </button>
        <button
          onClick={() => setMode('register')}
          className={`flex-1 py-2.5 rounded-[7px] text-[13.5px] font-semibold transition ${
            mode === 'register' ? 'bg-white text-[#0F2B32] shadow-sm' : 'text-[#4C5C5A]'
          }`}
        >
          Register
        </button>
      </div>

        {mode === 'login' ? (
        <LoginForm onSwitchToRegister={() => setMode('register')} />
      ) : (
        <RegisterForm onSwitchToLogin={() => setMode('login')} />
      )}

    </AuthShell>
  )
}