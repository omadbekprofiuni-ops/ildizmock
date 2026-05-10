import { FileText, GraduationCap, LayoutDashboard, LogOut, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'
import { roleLabel, useAuth } from '@/stores/auth'

type Props = { children: ReactNode }

const NAV = [
  { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/admin/tests', label: 'Tests', Icon: FileText, end: false },
  { to: '/admin/teachers', label: 'Teachers', Icon: GraduationCap, end: false },
  { to: '/admin/students', label: 'Students', Icon: Users, end: false },
]

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

export default function AdminLayout({ children }: Props) {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className="fixed inset-y-0 left-0 flex w-64 flex-col text-white"
        style={{ background: 'var(--slate-900)' }}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-white/5 px-5">
          <Link to="/admin" className="flex items-center gap-3">
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
                ADMIN
              </span>
            </div>
          </Link>
        </div>
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
              <Icon className="h-4 w-4 opacity-90" />
              {label}
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
              <p className="truncate text-sm font-bold text-white">{user?.username}</p>
              <p className="truncate text-[11px] text-white/60">{roleLabel(user?.role)}</p>
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
      <main className="ml-64 flex-1">{children}</main>
    </div>
  )
}
