import { useQuery } from '@tanstack/react-query'
import { Building2, ClipboardList, DollarSign, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

import SuperAdminLayout from './SuperAdminLayout'

type Stats = {
  orgs_total: number
  orgs_by_status: { active: number; trial: number; expired: number; blocked: number }
  students_total: number
  attempts_this_month: number
  revenue_total_usd: number
  recent_payments: { id: number; organization_name: string; plan_name: string; amount_usd: string; status: string; paid_at: string | null }[]
  recent_students: { phone: string; name: string; org_name: string | null; org_slug: string | null; created_at: string }[]
  soon_expiring: { id: number; name: string; slug: string; days_remaining: number; plan_name: string }[]
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('uz-UZ') : '—'
}

export default function SuperAdminDashboard() {
  const q = useQuery({
    queryKey: ['super-stats'],
    queryFn: async () => (await api.get<Stats>('/superadmin/stats/')).data,
  })

  return (
    <SuperAdminLayout>
      <header className="flex items-center justify-between border-b bg-white px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salom, Super Admin</h1>
          <p className="text-sm text-muted-foreground">ILDIZMock platforma boshqaruvi</p>
        </div>
        <Link to="/super/organizations">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add new center
          </Button>
        </Link>
      </header>

      <div className="space-y-6 p-8">
        {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {q.isError && <p className="text-destructive">Statisticsni yuklab bo‘lmadi.</p>}
        {q.data && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Stat
                Icon={Building2}
                label="Centers"
                value={q.data.orgs_total}
                hint={`${q.data.orgs_by_status.active} faol · ${q.data.orgs_by_status.trial} sinov`}
                tint="bg-blue-500"
              />
              <Stat
                Icon={Users}
                label="Students"
                value={q.data.students_total}
                hint="Hamma markazlarda"
                tint="bg-emerald-500"
              />
              <Stat
                Icon={ClipboardList}
                label="Bu oy"
                value={q.data.attempts_this_month}
                hint="tests topshirildi"
                tint="bg-orange-500"
              />
              <Stat
                Icon={DollarSign}
                label="Daromad"
                value={`$${q.data.revenue_total_usd.toLocaleString()}`}
                hint="Jami to‘langan"
                tint="bg-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 text-base font-semibold">Centers holati</h2>
                  <ul className="space-y-2 text-sm">
                    <StatusRow label="Active" count={q.data.orgs_by_status.active} dot="bg-emerald-500" />
                    <StatusRow label="Trial" count={q.data.orgs_by_status.trial} dot="bg-amber-500" />
                    <StatusRow label="Plan tugagan" count={q.data.orgs_by_status.expired} dot="bg-rose-500" />
                    <StatusRow label="Blocked" count={q.data.orgs_by_status.blocked} dot="bg-slate-500" />
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 text-base font-semibold">Yaqinda tugaydigan tariflar</h2>
                  {q.data.soon_expiring.length === 0 ? (
                    <p className="text-sm text-muted-foreground">7 kun ichida tugaydigan tarif yo‘q.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {q.data.soon_expiring.map((o) => (
                        <li key={o.id} className="flex items-center justify-between">
                          <span>{o.name} · <span className="text-muted-foreground">{o.plan_name}</span></span>
                          <span className="font-mono text-xs text-rose-700">{o.days_remaining} kun</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="border-b px-6 py-4">
                  <h2 className="text-base font-semibold">Recent payments</h2>
                </div>
                {q.data.recent_payments.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Hech narsa yo‘q.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-6 py-3">Center</th>
                        <th className="px-6 py-3">Plan</th>
                        <th className="px-6 py-3">Summa</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {q.data.recent_payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-6 py-3 font-medium">{p.organization_name}</td>
                          <td className="px-6 py-3">{p.plan_name}</td>
                          <td className="px-6 py-3 font-mono">${p.amount_usd}</td>
                          <td className="px-6 py-3">
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                              ✓ {p.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-muted-foreground">{fmtDate(p.paid_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="border-b px-6 py-4">
                  <h2 className="text-base font-semibold">Recently joined students</h2>
                </div>
                {q.data.recent_students.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Hech narsa yo‘q.</p>
                ) : (
                  <ul className="divide-y">
                    {q.data.recent_students.map((s) => (
                      <li key={s.phone} className="flex items-center justify-between px-6 py-3 text-sm">
                        <div>
                          <span className="font-medium">{s.name}</span>
                          {s.org_name && (
                            <span className="text-muted-foreground"> → {s.org_name}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{fmtDate(s.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}

function Stat({
  Icon, label, value, hint, tint,
}: {
  Icon: React.ComponentType<{ className?: string }>
  label: string; value: string | number; hint?: string; tint: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`rounded-lg ${tint} p-3 text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
          {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusRow({ label, count, dot }: { label: string; count: number; dot: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-mono">{count}</span>
    </li>
  )
}
