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
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/stores/auth'
import { useOrgContext } from '@/stores/orgContext'

type NavItem = {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
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

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()
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

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
        <div className="flex h-14 items-center border-b border-slate-800 px-5">
          <Link to="/super" className="text-lg font-bold tracking-tight">
            ILDIZMock
          </Link>
          <span className="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-slate-900">
            SUPER
          </span>
        </div>
        {inOrgContext && (
          <div className="border-b border-slate-800 px-5 py-3">
            <button
              onClick={onExitOrgContext}
              className="mb-2 flex items-center gap-2 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" /> Back to main panel
            </button>
            <div className="text-sm font-semibold">[{orgName}]</div>
          </div>
        )}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 text-xs text-slate-400">
            Signed in: <span className="text-slate-200">{user?.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>
      <main className="ml-60 flex-1">{children}</main>
    </div>
  )
}
