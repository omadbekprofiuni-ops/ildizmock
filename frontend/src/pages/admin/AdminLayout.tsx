import { FileText, GraduationCap, LayoutDashboard, LogOut, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/stores/auth'

type Props = { children: ReactNode }

const NAV = [
  { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/admin/tests', label: 'Testlar', Icon: FileText, end: false },
  { to: '/admin/teachers', label: 'Teachers', Icon: GraduationCap, end: false },
  { to: '/admin/students', label: 'Students', Icon: Users, end: false },
]

export default function AdminLayout({ children }: Props) {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
        <div className="flex h-14 items-center border-b border-slate-800 px-5">
          <Link to="/admin" className="text-lg font-bold tracking-tight">
            ILDIZmock
          </Link>
          <span className="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-slate-900">
            ADMIN
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 text-xs text-slate-400">
            Kirgan: <span className="text-slate-200">{user?.phone}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
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
