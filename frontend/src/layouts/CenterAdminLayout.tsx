import {
  BarChart3,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'

import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

interface OrgInfo {
  slug: string
  name: string
  logo?: string | null
  primary_color?: string | null
}

const NAV_ITEMS = [
  { to: '', label: 'Bosh sahifa', icon: LayoutDashboard, end: true },
  { to: 'students', label: "O'quvchilar", icon: Users },
  { to: 'teachers', label: 'Ustozlar', icon: GraduationCap },
  { to: 'tests', label: 'Testlar', icon: BookOpen },
  { to: 'mock', label: 'Mock sessiyalar', icon: BookOpen },
  { to: 'analytics', label: 'Analytics', icon: BarChart3 },
  { to: 'settings', label: 'Sozlamalar', icon: Settings },
]

const TITLES: Record<string, { title: string; crumb?: string }> = {
  '': { title: 'Bosh sahifa' },
  students: { title: "O'quvchilar", crumb: 'Foydalanuvchilar' },
  teachers: { title: 'Ustozlar', crumb: 'Foydalanuvchilar' },
  tests: { title: 'Testlar', crumb: 'Test bazasi' },
  mock: { title: 'Mock sessiyalar', crumb: 'Sinov' },
  analytics: { title: 'Analytics', crumb: 'Hisobotlar' },
  settings: { title: 'Sozlamalar', crumb: 'Markaz' },
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

  // Determine current section for breadcrumb/title
  const path = location.pathname
  const seg = path.replace(`/${slug}/admin`, '').replace(/^\//, '').split('/')[0] ?? ''
  const meta = TITLES[seg] ?? { title: seg || 'Bosh sahifa' }

  const initials = (org?.name || slug || '?').slice(0, 2).toUpperCase()

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900">
      {/* SIDEBAR */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <Link
          to={`/${slug}/admin`}
          className="flex h-16 items-center gap-3 border-b border-slate-100 px-6"
        >
          {org?.logo ? (
            <img
              src={org.logo}
              alt={org.name}
              className="h-9 w-9 rounded-xl bg-slate-50 object-contain p-1"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold text-sm"
              style={{ background: org?.primary_color || '#DC2626' }}
            >
              {initials}
            </div>
          )}
          <div className="leading-tight">
            <div className="font-bold tracking-tight text-red-600">ILDIZmock</div>
            <div className="text-xs text-slate-500 truncate max-w-[120px]">
              {org?.name ?? slug}
            </div>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 p-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to || 'index'}
              to={to ? `/${slug}/admin/${to}` : `/${slug}/admin`}
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
                {user?.first_name} {user?.last_name}
              </p>
              <p className="truncate text-xs text-slate-500">@{user?.username}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Chiqish"
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{meta.crumb || 'Markaz'}</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">{meta.title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Markaz:</span>
            <span className="font-medium text-slate-900">{org?.name ?? slug}</span>
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
