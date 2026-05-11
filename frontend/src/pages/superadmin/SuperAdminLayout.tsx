import {
  ArrowLeft,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  Library,
  LogOut,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { AIQuotaBadge } from '@/components/AIQuotaBadge'
import brandLogo from '@/assets/brand-logo.png'
import { roleLabel, useAuth } from '@/stores/auth'
import { useOrgContext } from '@/stores/orgContext'

type NavItem = {
  to: string
  label: string
  Icon: LucideIcon
  end?: boolean
}

const MAIN_NAV: NavItem[] = [
  { to: '/super', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/super/organizations', label: 'Centers', Icon: Building2 },
  { to: '/super/payments', label: 'Payments', Icon: CreditCard },
  { to: '/super/tests', label: 'Global tests', Icon: FileText },
  { to: '/super/b2c-catalog', label: 'B2C Catalog', Icon: Library },
  { to: '/super/audio', label: 'Audio files', Icon: Headphones },
  { to: '/super/stats', label: 'Statistics', Icon: BarChart3 },
  { to: '/super/settings', label: 'Settings', Icon: Settings },
]

const ORG_CONTEXT_NAV: NavItem[] = [
  { to: '/super/org/dashboard', label: 'Home', Icon: LayoutDashboard, end: true },
  { to: '/super/org/students', label: 'Students', Icon: Building2 },
  { to: '/super/org/teachers', label: 'Teachers', Icon: Building2 },
  { to: '/super/org/writings', label: 'Writing submissions', Icon: FileText },
  { to: '/super/org/stats', label: 'Statistics', Icon: BarChart3 },
  { to: '/super/org/billing', label: 'Payment', Icon: CreditCard },
]

const TITLES: Record<string, string> = {
  '/super': 'Dashboard',
  '/super/organizations': 'Centers',
  '/super/payments': 'Billing',
  '/super/tests': 'Global tests',
  '/super/b2c-catalog': 'B2C Catalog',
  '/super/audio': 'Audio files',
  '/super/stats': 'Statistics',
  '/super/settings': 'Settings',
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.3, overflow: 'hidden' }}
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

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const orgName = useOrgContext((s) => s.orgName)
  const setContext = useOrgContext((s) => s.setContext)

  const inOrgContext = !!orgName
  const NAV = inOrgContext ? ORG_CONTEXT_NAV : MAIN_NAV

  const onLogout = async () => {
    setContext(null, null)
    await logout()
    navigate('/login', { replace: true })
  }

  const onExitOrgContext = () => {
    setContext(null, null)
    navigate('/super', { replace: true })
  }

  const currentTitle =
    NAV.slice()
      .sort((a, b) => b.to.length - a.to.length)
      .find((it) =>
        it.end ? location.pathname === it.to : location.pathname.startsWith(it.to),
      )?.label ??
    TITLES[location.pathname] ??
    'Super Admin'

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans text-slate-900">
      <aside
        className="fixed inset-y-0 left-0 flex w-64 flex-col text-white"
        style={{ background: 'var(--slate-900)' }}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-white/5 px-5">
          <Link to="/super" className="flex items-center gap-3">
            <BrandMark size={36} />
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight">
                <span className="text-white">ILDIZ</span>
                <span className="text-teal-400">mock</span>
              </div>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
                style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#FCD34D' }}
              >
                SUPER
              </span>
            </div>
          </Link>
        </div>

        {inOrgContext && (
          <div className="border-b border-white/5 px-5 py-3">
            <button
              onClick={onExitOrgContext}
              className="mb-2 flex items-center gap-2 text-xs text-white/60 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" /> Back to main panel
            </button>
            <div className="text-sm font-bold text-white">[{orgName}]</div>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 px-3 py-5">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={18} className="opacity-90" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="mb-3">
            <AIQuotaBadge variant="dark" />
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-white"
              style={{ background: 'var(--gradient-brand)' }}
            >
              {(user?.first_name || user?.username || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {user?.first_name || user?.username}
              </p>
              <p className="truncate text-[11px] text-white/60">{roleLabel(user?.role)}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Logout"
              className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex flex-1 flex-col">
        <header className="flex h-[72px] items-center justify-between border-b border-slate-100 bg-white px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-500">Super Admin</span>
            <span className="text-slate-300">/</span>
            <span className="font-extrabold text-slate-900">{currentTitle}</span>
          </div>
          {inOrgContext && (
            <div className="text-xs text-slate-500">
              Center: <span className="font-bold text-slate-900">{orgName}</span>
            </div>
          )}
        </header>

        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
