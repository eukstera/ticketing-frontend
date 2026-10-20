'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import { ADMIN_RESOURCES } from '@/lib/adminResources'

export default function AdminIndexPage() {
  return (
    <AdminShell title="Admin" subtitle="Manage users and the lookup data the ticketing system runs on.">
      {() => (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_RESOURCES.map(r => (
            <li key={r.slug}>
              <Link
                href={`/admin/${r.slug}`}
                className="flex h-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span>
                  <span className="block text-base font-semibold text-gray-800">{r.title}</span>
                  <span className="mt-0.5 block text-sm text-gray-500">{r.description}</span>
                </span>
                <ChevronRight size={16} className="flex-shrink-0 text-gray-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  )
}
