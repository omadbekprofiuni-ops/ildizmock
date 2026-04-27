import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

interface OrgInfo {
  slug: string
  name: string
  logo?: string | null
  primary_color?: string | null
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-full transition text-sm ${
    isActive ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10'
  }`

export default function CenterAdminLayout() {
  const { slug } = useParams<{ slug: string }>()
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 flex h-screen w-64 flex-col bg-slate-900 p-6 text-white">
        <Link to={`/${slug}/admin`} className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 font-bold">
            ✕
          </div>
          <div>
            <div className="font-semibold">ILDIZmock</div>
            <div className="text-xs text-orange-400">{org?.name ?? slug}</div>
          </div>
        </Link>

        <nav className="flex-1 space-y-1">
          <NavLink to={`/${slug}/admin`} end className={navItemClass}>
            🏠 <span>Bosh sahifa</span>
          </NavLink>
          <NavLink to={`/${slug}/admin/students`} className={navItemClass}>
            👨‍🎓 <span>Talabalar</span>
          </NavLink>
          <NavLink to={`/${slug}/admin/teachers`} className={navItemClass}>
            👨‍🏫 <span>Ustozlar</span>
          </NavLink>
          <NavLink to={`/${slug}/admin/tests`} className={navItemClass}>
            📚 <span>Testlar</span>
          </NavLink>
          <NavLink to={`/${slug}/admin/mock`} className={navItemClass}>
            🎯 <span>Mock sessiyalar</span>
          </NavLink>
        </nav>

        <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs text-white/60">
          <div>
            Markaz: <span className="text-white">{slug}</span>
          </div>
          <div>
            Kirgan: <span className="text-white">{user?.username}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden p-8">
        <Outlet />
      </main>
    </div>
  )
}
