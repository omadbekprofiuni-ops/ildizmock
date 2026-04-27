import { Inbox, LogOut, Mic, PenLine, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/stores/auth'

const NAV = [
  { to: '/teacher', label: 'Home', Icon: Inbox, end: true },
  { to: '/teacher/students', label: 'Students', Icon: Users, end: false },
  { to: '/teacher/mock/writing', label: 'Mock Writing', Icon: PenLine, end: false },
  { to: '/teacher/mock/speaking', label: 'Mock Speaking', Icon: Mic, end: false },
]

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
        <div className="flex h-14 items-center border-b border-slate-800 px-5">
          <Link to="/teacher" className="text-lg font-bold tracking-tight">
            ILDIZmock
          </Link>
          <span className="ml-2 rounded bg-emerald-500 px-1.5 py-0.5 text-xs font-semibold text-slate-900">
            TEACHER
          </span>
        </div>
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
