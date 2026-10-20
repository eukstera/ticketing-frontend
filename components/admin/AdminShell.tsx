'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Navbar from '@/components/NavBar'
import ErrorState from '@/components/ui/ErrorState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUser } from '@/hooks/useUser'
import { isAdmin, type AuthUser } from '@/lib/auth'

// Page chrome for every /admin page. Renders children only for admins (role
// "Department Head"); everyone else gets a 403 state. This is a UX gate only,
// the API enforces the same rule.
export default function AdminShell({
  title,
  subtitle,
  back,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  /** Show a "← Admin" link back to the index. */
  back?: boolean
  actions?: ReactNode
  children: (user: AuthUser) => ReactNode
}) {
  const authed = useAuthGuard()
  const user = useUser()

  if (!authed) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
        {!user ? (
          <CardSkeleton lines={4} />
        ) : !isAdmin(user) ? (
          <ErrorState message="You don't have access to this page. Admin accounts only." />
        ) : (
          <>
            {back && (
              <Link
                href="/admin"
                className="mb-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Admin
              </Link>
            )}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {children(user)}
          </>
        )}
      </div>
    </div>
  )
}
