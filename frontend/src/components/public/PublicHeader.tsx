import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'
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

function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        overflow: 'hidden',
      }}
    >
      <img
        src={brandLogo}
        alt="Mock Exam"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  )
}

export function PublicHeader() {
  const { t } = useTranslation()
  const user = useAuth((s) => s.user)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <BrandMark size={40} />
          <span className="text-xl font-extrabold tracking-tight">
            <span className="text-brand-900">ILDIZ</span>
            <span className="text-teal-600">mock</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `relative rounded-[10px] px-4 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? 'text-brand-700 after:absolute after:-bottom-0.5 after:left-4 after:right-4 after:h-0.5 after:rounded after:bg-brand-600'
                    : 'text-slate-700 hover:bg-brand-50 hover:text-brand-600'
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
                className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-brand-600"
              >
                {t('common.login')}
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cta-500 px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_10px_24px_rgba(45,79,216,0.30)]"
              >
                {t('common.signup')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-bold text-white"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700"
                  >
                    {t('common.login')}
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl bg-cta-500 px-4 py-2.5 text-center text-sm font-bold text-white"
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
