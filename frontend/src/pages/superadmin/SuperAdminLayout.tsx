import {
  ArrowLeft,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  Gift,
  Headphones,
  LayoutDashboard,
  Library,
  LogOut,
  Settings,
  Sparkles,
  Users,
  Zap,
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
  soon?: boolean
}

type NavGroup = {
  label: string | null
  items: NavItem[]
}

// ETAP 19 — 5 ta kategoriyaga guruhlangan sidebar.
const MAIN_NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ to: '/super', label: 'Dashboard', Icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Tashkilotlar',
    items: [
      { to: '/super/organizations', label: 'Markazlar', Icon: Building2 },
      { to: '/super/payments', label: 'To‘lovlar', Icon: CreditCard },
      { to: '/super/stats', label: 'Statistika', Icon: BarChart3 },
    ],
  },
  {
    label: 'B2C',
    items: [
      { to: '/super/b2c-users', label: 'Foydalanuvchilar', Icon: Users },
      { to: '/super/b2c-catalog', label: 'Katalog', Icon: Library },
      { to: '/super/credits', label: 'Kreditlar', Icon: Zap },
      { to: '/super/promo-codes', label: 'Promo kodlar', Icon: Gift },
    ],
  },
  {
    label: 'Testlar',
    items: [{ to: '/super/tests', label: 'Global testlar', Icon: FileText }],
  },
  {
    label: 'Tizim',
    items: [
      { to: '/super/settings/ai-providers', label: 'AI Providers', Icon: Sparkles },
      { to: '/super/audio', label: 'Audio fayllar', Icon: Headphones },
      { to: '/super/settings', label: 'Sozlamalar', Icon: Settings, end: true },
    ],
  },
]

const MAIN_NAV_FLAT: NavItem[] = MAIN_NAV_GROUPS.flatMap((g) => g.items)

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
  '/super/organizations': 'Markazlar',
  '/super/payments': 'To‘lovlar',
  '/super/tests': 'Global testlar',
  '/super/b2c-users': 'B2C foydalanuvchilar',
  '/super/b2c-catalog': 'B2C Katalog',
  '/super/credits': 'Kreditlar',
  '/super/promo-codes': 'Promo kodlar',
  '/super/audio': 'Audio fayllar',
  '/super/stats': 'Statistika',
  '/super/settings': 'Sozlamalar',
  '/super/settings/ai-providers': 'AI Providers',
}

function NavItemLink({ to, label, Icon, end, soon }: NavItem) {
  return (
    <NavLink
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
      {soon && (
        <span className="ml-auto rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-300">
          Soon
        </span>
      )}
    </NavLink>
  )
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

  const onLogout = async () => {
    setContext(null, null)
    await logout()
    navigate('/login', { replace: true })
  }

  const onExitOrgContext = () => {
    setContext(null, null)
    navigate('/super', { replace: true })
  }

  const lookupItems = inOrgContext ? ORG_CONTEXT_NAV : MAIN_NAV_FLAT
  const currentTitle =
    lookupItems
      .slice()
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

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-5">
          {inOrgContext
            ? ORG_CONTEXT_NAV.map((item) => (
                <NavItemLink key={item.to} {...item} />
              ))
            : MAIN_NAV_GROUPS.map((group, gi) => (
                <div key={`g-${gi}`} className={gi > 0 ? 'pt-2' : ''}>
                  {group.label && (
                    <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
                      {group.label}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavItemLink key={item.to} {...item} />
                    ))}
                  </div>
                </div>
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
