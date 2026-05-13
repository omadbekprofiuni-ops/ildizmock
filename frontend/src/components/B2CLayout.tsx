import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  History,
  LayoutDashboard,
  Library,
  LogOut,
  User as UserIcon,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

export type B2CNavKey = 'dashboard' | 'catalog' | 'history' | 'credits' | 'profile'

const NAV_ITEMS: Array<{
  key: B2CNavKey
  label: string
  icon: typeof LayoutDashboard
  href: string
  enabled: boolean
}> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/b2c/dashboard', enabled: true },
  { key: 'catalog', label: 'Katalog', icon: Library, href: '/b2c/catalog', enabled: true },
  { key: 'history', label: 'Test History', icon: History, href: '#', enabled: false },
  { key: 'credits', label: 'Kreditlar', icon: CreditCard, href: '/b2c/credits', enabled: true },
  { key: 'profile', label: 'Profil', icon: UserIcon, href: '/b2c/profile', enabled: true },
]

type CreditsBalance = { balance: number }

export function useB2CBalance() {
  return useQuery({
    queryKey: ['b2c-credits-balance'],
    queryFn: async () => (await api.get<CreditsBalance>('/b2c/credits')).data,
    staleTime: 30_000,
  })
}

function B2CSidebar({ active }: { active: B2CNavKey }) {
  return (
    <aside className="sticky top-6 hidden h-fit w-64 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 lg:block">
      <p className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Menyu
      </p>
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.key === active
          if (!item.enabled) {
            return (
              <div
                key={item.key}
                className="flex cursor-not-allowed items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {item.label}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Soon
                </span>
              </div>
            )
          }
          return (
            <Link
              key={item.key}
              to={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function BalanceBadge() {
  const { data, isLoading } = useB2CBalance()
  if (isLoading) {
    return (
      <Link
        to="/b2c/credits"
        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700"
      >
        <Zap className="h-4 w-4" /> …
      </Link>
    )
  }
  const balance = data?.balance ?? 0
  return (
    <Link
      to="/b2c/credits"
      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700 transition-colors hover:border-amber-300 hover:bg-amber-100"
      title="Kreditlar sahifasi"
    >
      <Zap className="h-4 w-4" /> {balance} credit
    </Link>
  )
}

function B2CHeader() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)

  const onLogout = async () => {
    await logout()
    toast.success('Chiqildi')
    navigate('/b2c/login')
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/b2c/dashboard"
          className="text-base font-extrabold tracking-tight text-slate-900"
        >
          ILDIZ<span className="text-brand-600">mock</span>
        </Link>
        <div className="flex items-center gap-3">
          <BalanceBadge />
          <Link
            to="/b2c/profile"
            className="hidden text-sm text-slate-600 hover:text-slate-900 sm:inline"
          >
            {user?.first_name || user?.email}
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700"
          >
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </div>
    </header>
  )
}

export function B2CLayout({
  active,
  children,
}: {
  active: B2CNavKey
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <B2CHeader />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <B2CSidebar active={active} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </main>
  )
}
