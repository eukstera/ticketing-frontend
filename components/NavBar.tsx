'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { removeToken, getUser } from '@/lib/auth'
import { User } from '@/types'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    setUser(getUser())
  }, [])

  const links = [
    { href: '/dashboard', label: 'Home' },
    { href: '/tickets', label: 'Department Tickets' },
    { href: '/tickets/create', label: 'Create Ticket' },
    { href: '/my-tickets', label: 'My Tickets' },
  ].filter(l => l.label !== 'Create Ticket' || user?.id === 1)

  const handleLogout = () => {
    removeToken()
    router.push('/')
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo / Brand */}
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* <Image
              src="/images/scisto-logo.jpg"
              alt="Department of Health seal"
              width={32}
              height={32}
              className="object-contain flex-shrink-0"
            /> */}
            <span className="font-semibold text-gray-800 text-sm sm:block">
              GBTRGHSC
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition ${
                  pathname === l.href
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">
              {user ? `${user.first_name} ${user.last_name}` : ''}
            </span>

            {/* Avatar + dropdown */}
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center hover:bg-blue-200 transition"
                title="Account"
              >
                {initials}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-20">
                  <div className="px-3 py-2 border-b border-gray-100 mb-1">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {user ? `${user.first_name} ${user.last_name}` : 'User'}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); handleLogout() }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Hamburger - only on mobile */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Toggle menu"
            >
              <span className={`block w-5 h-0.5 bg-gray-600 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-600 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-600 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu - collapsed by default */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  pathname === l.href
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {l.label}
              </Link>
            ))}

            {/* Mobile user info */}
            <div className="px-3 pt-2 border-t border-gray-100 mt-2">
              <p className="text-xs text-gray-400">Logged in as</p>
              <p className="text-sm font-medium text-gray-700">
                {user ? `${user.first_name} ${user.last_name}` : ''}
              </p>
              <button
                onClick={handleLogout}
                className="mt-2 text-sm text-red-500 hover:text-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}