import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'
import { api } from '@/lib/api'
import { roleLabel, useAuth } from '@/stores/auth'

interface OrgInfo {
  slug: string
  name: string
  logo?: string | null
  primary_color?: string | null
}

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
    roles: ['org_admin', 'admin', 'superadmin', 'super_admin'],
  },
  {
    to: 'students',
    label: 'Students',
    icon: Users,
    roles: ['org_admin', 'admin', 'superadmin', 'super_admin'],
  },
  {
    to: 'teachers',
    label: 'Teachers',
    icon: GraduationCap,
    roles: ['org_admin', 'admin', 'superadmin', 'super_admin'],
  },
  { to: 'groups', label: 'Groups', icon: UsersRound },
  { to: 'attendance', label: 'Attendance', icon: CalendarCheck },
  {
    to: 'tests',
    label: 'Tests',
    icon: BookOpen,
    roles: ['org_admin', 'admin', 'superadmin', 'super_admin'],
  },
  {
    to: 'mock',
    label: 'Mock sessions',
    icon: BookOpen,
    roles: ['org_admin', 'admin', 'superadmin', 'super_admin'],
  },
  {
    to: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    roles: ['org_admin', 'admin', 'superadmin', 'super_admin'],
  },
  {
    to: 'settings',
    label: 'Settings',
    icon: Settings,
    roles: ['org_admin', 'admin', 'superadmin', 'super_admin'],
  },
]

const TITLES: Record<string, { title: string; crumb?: string }> = {
  '': { title: 'Dashboard' },
  students: { title: 'Students', crumb: 'Users' },
  teachers: { title: 'Teachers', crumb: 'Users' },
  groups: { title: 'Groups', crumb: 'Monitoring' },
  attendance: { title: 'Attendance', crumb: 'Monitoring' },
  tests: { title: 'Tests', crumb: 'Test bank' },
  mock: { title: 'Mock sessions', crumb: 'Exams' },
  analytics: { title: 'Analytics', crumb: 'Reports' },
  settings: { title: 'Settings', crumb: 'Center' },
}

function BrandMark({ size = 32 }: { size?: number }) {
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

export default function CenterAdminLayout() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  useEffect(() => {
    if (!slug) return
    api
      .get(`/public/orgs/${slug}/`)
      .then((r) => setOrg(r.data))
      .catch(() => setOrg(null))
  }, [slug])

  const handleLogout = async () => {
    await logout()
    navigate(`/${slug}/login`, { replace: true })
  }

  const path = location.pathname
  const seg = path.replace(`/${slug}/admin`, '').replace(/^\//, '').split('/')[0] ?? ''
  const meta = TITLES[seg] ?? { title: seg || 'Dashboard' }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900">
      {/* SIDEBAR — dark slate */}
      <aside
        className="hidden w-64 flex-col text-white md:flex"
        style={{ background: 'var(--slate-900)' }}
      >
        <Link
          to={`/${slug}/admin`}
          className="flex h-[72px] items-center gap-3 border-b border-white/5 px-5"
        >
          <BrandMark size={36} />
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight">
              <span className="text-white">ILDIZ</span>
              <span className="text-teal-400">mock</span>
            </div>
            <div className="max-w-[140px] truncate text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">
              {org?.name ?? slug}
            </div>
          </div>
        </Link>

        <nav className="flex-1 space-y-0.5 px-3 py-5">
          {NAV_ITEMS.filter(
            (it) => !it.roles || (user?.role && it.roles.includes(user.role)),
          ).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to || 'index'}
              to={to ? `/${slug}/admin/${to}` : `/${slug}/admin`}
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
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-white"
              style={{ background: 'var(--gradient-brand)' }}
            >
              {(user?.first_name || user?.username || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="truncate text-[11px] text-white/60">
                {roleLabel(user?.role)} · @{user?.username}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[72px] items-center justify-between border-b border-slate-100 bg-white px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-500">{meta.crumb || 'Center'}</span>
            <span className="text-slate-300">/</span>
            <span className="font-extrabold text-slate-900">{meta.title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Center:</span>
            <span className="font-bold text-slate-900">{org?.name ?? slug}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl p-6 lg:p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
