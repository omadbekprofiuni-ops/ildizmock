import { useQuery } from '@tanstack/react-query'
import { Coins, Eye, Search, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StatCard,
  TableCard,
  adminTable,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

import SuperAdminLayout from './SuperAdminLayout'

type B2CUserRow = {
  id: number
  username: string
  email: string
  full_name: string
  phone: string
  signup_source: '' | 'email' | 'google' | 'admin'
  preferred_language: 'uz' | 'ru' | 'en'
  target_exam: string
  target_band: number | null
  balance: number
  is_active: boolean
  date_joined: string
  last_login: string | null
}

type Resp = {
  summary: { total: number; new_30d: number; shown: number }
  users: B2CUserRow[]
}

type SignupFilter = 'all' | 'email' | 'google' | 'admin'

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB') : '—'
}

export default function SuperAdminB2CUsersPage() {
  const [query, setQuery] = useState('')
  const [signupSource, setSignupSource] = useState<SignupFilter>('all')
  const [balanceRange, setBalanceRange] = useState<'any' | 'zero' | 'low' | 'high'>('any')

  const params: Record<string, string> = { signup_source: signupSource }
  if (query.trim()) params.q = query.trim()
  if (balanceRange === 'zero') {
    params.min_balance = '0'
    params.max_balance = '0'
  } else if (balanceRange === 'low') {
    params.min_balance = '1'
    params.max_balance = '9'
  } else if (balanceRange === 'high') {
    params.min_balance = '10'
  }

  const q = useQuery({
    queryKey: ['super-b2c-users', { query, signupSource, balanceRange }],
    queryFn: async () => (await api.get<Resp>('/super/b2c-users/', { params })).data,
  })

  return (
    <SuperAdminLayout>
      <PageShell>
        <PageHeader
          title="B2C foydalanuvchilar"
          subtitle="Individual (markazga bog‘lanmagan) foydalanuvchilar"
        />

        {q.data && (
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard
              Icon={Users} tone="blue" label="Jami" value={q.data.summary.total}
              hint="Barcha B2C user'lar"
            />
            <StatCard
              Icon={UserPlus} tone="emerald" label="Oxirgi 30 kun" value={q.data.summary.new_30d}
              hint="Yangi ro‘yxatdan o‘tdi"
            />
            <StatCard
              Icon={Coins} tone="amber" label="Ko‘rsatilmoqda" value={q.data.summary.shown}
              hint="Filtr bo‘yicha"
            />
          </div>
        )}

        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email, ism, familiya, username yoki telefon…"
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <select
            value={signupSource}
            onChange={(e) => setSignupSource(e.target.value as SignupFilter)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">Barcha manbalar</option>
            <option value="email">Email</option>
            <option value="google">Google</option>
            <option value="admin">Admin tomonidan</option>
          </select>
          <select
            value={balanceRange}
            onChange={(e) => setBalanceRange(e.target.value as typeof balanceRange)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
          >
            <option value="any">Balansga e‘tibor bermay</option>
            <option value="zero">0 (kreditsiz)</option>
            <option value="low">1–9 credit</option>
            <option value="high">10+ credit</option>
          </select>
        </div>

        {q.isLoading && <p className="text-slate-500">Yuklanmoqda…</p>}
        {q.data && q.data.users.length === 0 && (
          <TableCard>
            <div className="py-12 text-center text-sm text-slate-500">
              Bu filtr bo‘yicha foydalanuvchilar topilmadi.
            </div>
          </TableCard>
        )}
        {q.data && q.data.users.length > 0 && (
          <TableCard>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className={adminTable.th}>Foydalanuvchi</th>
                  <th className={adminTable.th}>Aloqa</th>
                  <th className={adminTable.th}>Manba</th>
                  <th className={adminTable.th}>Maqsad</th>
                  <th className={adminTable.th + ' text-center'}>Balans</th>
                  <th className={adminTable.th}>Qo‘shilgan</th>
                  <th className={adminTable.th + ' text-right'}></th>
                </tr>
              </thead>
              <tbody className={adminTable.tbody}>
                {q.data.users.map((u) => (
                  <tr key={u.id} className={adminTable.trHover}>
                    <td className={adminTable.td}>
                      <div>
                        <div className="font-semibold text-slate-900">{u.full_name}</div>
                        <div className="font-mono text-xs text-slate-500">{u.username}</div>
                      </div>
                    </td>
                    <td className={adminTable.td + ' text-xs'}>
                      <div className="text-slate-700">{u.email || '—'}</div>
                      {u.phone && <div className="text-slate-500">{u.phone}</div>}
                    </td>
                    <td className={adminTable.td}>
                      <SignupBadge source={u.signup_source} />
                    </td>
                    <td className={adminTable.td + ' text-xs'}>
                      {u.target_exam ? (
                        <div>
                          <div className="font-medium text-slate-900">{u.target_exam}</div>
                          {u.target_band !== null && (
                            <div className="text-slate-500">Band {u.target_band}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={adminTable.td + ' text-center'}>
                      <BalanceBadge value={u.balance} />
                    </td>
                    <td className={adminTable.td + ' text-xs text-slate-500'}>
                      {fmtDate(u.date_joined)}
                    </td>
                    <td className={adminTable.td + ' text-right'}>
                      <Link
                        to={`/super/b2c-users/${u.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Eye size={14} /> Ko‘rish
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}
      </PageShell>
    </SuperAdminLayout>
  )
}

function SignupBadge({ source }: { source: string }) {
  if (source === 'google') return <Chip tone="blue">Google</Chip>
  if (source === 'admin') return <Chip tone="violet">Admin</Chip>
  if (source === 'email') return <Chip tone="slate">Email</Chip>
  return <span className="text-xs text-slate-400">—</span>
}

function BalanceBadge({ value }: { value: number }) {
  if (value === 0) {
    return <span className="font-mono text-xs text-slate-400">0</span>
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold text-amber-700">
      ⚡ {value}
    </span>
  )
}
