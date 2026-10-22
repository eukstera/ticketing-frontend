'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Menu, User as UserIcon, X } from 'lucide-react'
import { logout, isAdmin } from '@/lib/auth'
import { useUser } from '@/hooks/useUser'
import Avatar from '@/components/ui/Avatar'
import NotificationBell from '@/components/NotificationBell'

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const avatarButtonRef = useRef<HTMLButtonElement>(null)
  const userMenuPanelRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const userMenuId = useId()
  const mobileMenuId = useId()
  const user = useUser()

  const links = [
    { href: '/dashboard', label: 'Home' },
    { href: '/tickets', label: 'Department Tickets' },
    { href: '/tickets/create', label: 'Create Ticket' },
    { href: '/my-tickets', label: 'My Tickets' },
    // Admin pages are built in Phase 2; role comes from /me (Department Head).
    ...(isAdmin(user) ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  // Nested routes keep their section highlighted (/tickets/123, /admin/users);
  // /tickets/create has its own link, so it does not light up "Department Tickets".
  function isActive(href: string) {
    if (pathname === href) return true
    if (href === '/tickets') return pathname.startsWith('/tickets/') && pathname !== '/tickets/create'
    return pathname.startsWith(`${href}/`)
  }

  const handleLogout = async () => {
    await logout()
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

  // Escape closes whichever menu is open and returns focus to its trigger.
  useEffect(() => {
    if (!userMenuOpen && !menuOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (userMenuOpen) {
        setUserMenuOpen(false)
        avatarButtonRef.current?.focus()
      } else {
        setMenuOpen(false)
        hamburgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [userMenuOpen, menuOpen])

  // Move focus into the account menu when it opens.
  useEffect(() => {
    if (userMenuOpen) userMenuPanelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [userMenuOpen])

  return (
    <nav aria-label="Main" className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo / Brand */}
          <Link href="/dashboard" className={`flex items-center gap-2 rounded ${FOCUS_RING}`}>
            <span className="font-semibold text-gray-800 text-sm">
              GBTRGHSC
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {links.map(l => {
              const active = isActive(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={`text-sm font-medium transition rounded ${FOCUS_RING} ${
                    active
                      ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {l.label}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <NotificationBell />

            <span className="text-sm text-gray-500 hidden sm:block">
              {user ? `${user.first_name} ${user.last_name}` : ''}
            </span>

            {/* Avatar + dropdown */}
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => setUserMenuOpen(o => !o)}
                className={`rounded-full hover:opacity-80 transition ${FOCUS_RING}`}
                title="Account"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-controls={userMenuOpen ? userMenuId : undefined}
              >
                <Avatar firstName={user?.first_name} lastName={user?.last_name} />
              </button>

              {userMenuOpen && (
                <div
                  ref={userMenuPanelRef}
                  id={userMenuId}
                  role="menu"
                  aria-label="Account"
                  className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-20"
                >
                  <div className="px-3 py-2 border-b border-gray-100 mb-1">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {user ? `${user.first_name} ${user.last_name}` : 'User'}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    )}
                  </div>
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    aria-current={isActive('/profile') ? 'page' : undefined}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition ${FOCUS_RING} ${
                      isActive('/profile') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <UserIcon size={14} aria-hidden="true" />
                    My profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setUserMenuOpen(false); handleLogout() }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 transition ${FOCUS_RING}`}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Hamburger - only on mobile */}
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className={`md:hidden p-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition ${FOCUS_RING}`}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? mobileMenuId : undefined}
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile menu - collapsed by default */}
        {menuOpen && (
          <div id={mobileMenuId} className="md:hidden border-t border-gray-100 py-3 space-y-1">
            {links.map(l => {
              const active = isActive(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition ${FOCUS_RING} ${
                    active
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {l.label}
                </Link>
              )
            })}

            {/* Mobile user info */}
            <div className="px-3 pt-2 border-t border-gray-100 mt-2">
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-sm font-medium text-gray-700">
                {user ? `${user.first_name} ${user.last_name}` : ''}
              </p>
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                aria-current={isActive('/profile') ? 'page' : undefined}
                className={`mt-1 -ml-1 flex items-center gap-2 px-1 py-2 rounded text-sm font-medium ${FOCUS_RING} ${
                  isActive('/profile') ? 'text-blue-600' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <UserIcon size={14} aria-hidden="true" />
                My profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={`block -ml-1 px-1 py-2 rounded text-sm font-medium text-red-600 hover:text-red-700 ${FOCUS_RING}`}
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
