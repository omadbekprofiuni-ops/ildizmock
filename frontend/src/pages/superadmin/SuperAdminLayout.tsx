import {
  ArrowLeft,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  LogOut,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/stores/auth'
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
  '/super/audio': 'Audio files',
  '/super/stats': 'Statistics',
  '/super/settings': 'Settings',
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

  // Match nav item with longest pathname for breadcrumb title
  const currentTitle =
    NAV.slice()
      .sort((a, b) => b.to.length - a.to.length)
      .find((it) =>
        it.end ? location.pathname === it.to : location.pathname.startsWith(it.to),
      )?.label
    ?? TITLES[location.pathname]
    ?? 'Super Admin'

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans text-slate-900">
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-6">
          <Link to="/super" className="flex items-center gap-2">
            <img
              src="/ildizmock-logo.png"
              alt="ILDIZmock"
              className="h-9 w-9 object-contain"
            />
            <span className="text-lg font-bold tracking-tight text-red-600">ILDIZmock</span>
          </Link>
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
            SUPER
          </span>
        </div>

        {inOrgContext && (
          <div className="border-b border-slate-100 px-5 py-3">
            <button
              onClick={onExitOrgContext}
              className="mb-2 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-3 w-3" /> Back to main panel
            </button>
            <div className="text-sm font-semibold text-slate-900">[{orgName}]</div>
          </div>
        )}

        <nav className="flex-1 space-y-1 p-4">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-bold text-red-700">
              {(user?.first_name || user?.username || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user?.first_name || user?.username}
              </p>
              <p className="truncate text-xs text-slate-500">superadmin</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Logout"
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Super Admin</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">{currentTitle}</span>
          </div>
          {inOrgContext && (
            <div className="text-xs text-slate-500">
              Markaz: <span className="font-medium text-slate-900">{orgName}</span>
            </div>
          )}
        </header>

        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
