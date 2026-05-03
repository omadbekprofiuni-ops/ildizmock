import { ChevronDown, LogOut, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/stores/auth'

export function UserMenu() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!user) return null

  const initial = (user.first_name || user.username || '?')[0]?.toUpperCase() || '?'

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white py-1 pl-1 pr-2 hover:border-slate-400"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="hidden text-sm sm:inline">{user.first_name}</span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-[var(--border)] bg-white shadow-lg">
          <div className="border-b px-3 py-2">
            <div className="text-sm font-medium">
              {user.first_name} {user.last_name}
            </div>
            <div className="font-mono text-xs text-slate-500">{user.phone}</div>
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <User className="h-4 w-4" /> Profile
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      )}
    </div>
  )
}
