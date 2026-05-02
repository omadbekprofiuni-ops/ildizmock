import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { useAuth } from '@/stores/auth'

interface NavItem {
  to: string
  key: string
  exact?: boolean
}

const navItems: NavItem[] = [
  { to: '/', key: 'nav.home', exact: true },
  { to: '/practice', key: 'nav.practice' },
  { to: '/features', key: 'nav.features' },
  { to: '/pricing', key: 'nav.pricing' },
]

export function PublicHeader() {
  const { t } = useTranslation()
  const user = useAuth((s) => s.user)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 shadow-soft">
            <span className="text-xl font-extrabold text-white">I</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">
            ILDIZ<span className="text-brand-500">mock</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-brand-600' : 'text-gray-700 hover:text-brand-500'
                }`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <UserMenu />
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-700 transition-colors hover:text-brand-500"
              >
                {t('common.login')}
              </Link>
              <Link
                to="/login"
                className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
              >
                {t('common.signup')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700"
                  >
                    {t('common.login')}
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    {t('common.signup')}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
