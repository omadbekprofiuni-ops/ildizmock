import { useQuery } from '@tanstack/react-query'
import { Building2, ClipboardList, DollarSign, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StatCard,
  SurfaceCard,
  TableCard,
  adminTable,
  btnPrimary,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

import SuperAdminLayout from './SuperAdminLayout'

type Stats = {
  orgs_total: number
  orgs_by_status: { active: number; trial: number; expired: number; blocked: number }
  students_total: number
  attempts_this_month: number
  revenue_total_usd: number
  recent_payments: {
    id: number
    organization_name: string
    plan_name: string
    amount_usd: string
    status: string
    paid_at: string | null
  }[]
  recent_students: {
    username: string
    name: string
    org_name: string | null
    org_slug: string | null
    created_at: string
  }[]
  soon_expiring: {
    id: number
    name: string
    slug: string
    days_remaining: number
    plan_name: string
  }[]
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB') : '—'
}

export default function SuperAdminDashboard() {
  const q = useQuery({
    queryKey: ['super-stats'],
    queryFn: async () => (await api.get<Stats>('/superadmin/stats/')).data,
  })

  return (
    <SuperAdminLayout>
      <PageShell>
        <PageHeader
          title="Hello, Super Admin"
          subtitle="ILDIZmock platform management"
          actions={
            <Link to="/super/organizations" className={btnPrimary}>
              <Plus size={16} /> Add new center
            </Link>
          }
        />

        {q.isLoading && <p className="text-slate-500">Loading…</p>}
        {q.isError && <p className="text-rose-600">Failed to load statistics.</p>}

        {q.data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                Icon={Building2}
                tone="blue"
                label="Centers"
                value={q.data.orgs_total}
                hint={`${q.data.orgs_by_status.active} active · ${q.data.orgs_by_status.trial} trial`}
              />
              <StatCard
                Icon={Users}
                tone="emerald"
                label="Students"
                value={q.data.students_total}
                hint="Across all centers"
              />
              <StatCard
                Icon={ClipboardList}
                tone="orange"
                label="This month"
                value={q.data.attempts_this_month}
                hint="tests submitted"
              />
              <StatCard
                Icon={DollarSign}
                tone="violet"
                label="Revenue"
                value={`$${q.data.revenue_total_usd.toLocaleString()}`}
                hint="Total paid"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SurfaceCard>
                <h2 className="mb-4 text-base font-semibold text-slate-900">Centers status</h2>
                <ul className="space-y-3 text-sm">
                  <StatusRow label="Active" count={q.data.orgs_by_status.active} tone="emerald" />
                  <StatusRow label="Trial" count={q.data.orgs_by_status.trial} tone="amber" />
                  <StatusRow label="Plan expired" count={q.data.orgs_by_status.expired} tone="rose" />
                  <StatusRow label="Blocked" count={q.data.orgs_by_status.blocked} tone="slate" />
                </ul>
              </SurfaceCard>

              <SurfaceCard>
                <h2 className="mb-4 text-base font-semibold text-slate-900">
                  Plans expiring soon
                </h2>
                {q.data.soon_expiring.length === 0 ? (
                  <p className="text-sm text-slate-500">No plans expiring within 7 days.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {q.data.soon_expiring.map((o) => (
                      <li key={o.id} className="flex items-center justify-between">
                        <span>
                          <span className="font-medium text-slate-900">{o.name}</span>{' '}
                          <span className="text-slate-500">· {o.plan_name}</span>
                        </span>
                        <Chip tone="rose">{o.days_remaining} kun</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </SurfaceCard>
            </div>

            <TableCard title="Recent payments">
              {q.data.recent_payments.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">Nothing yet.</p>
              ) : (
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th className={adminTable.th}>Center</th>
                      <th className={adminTable.th}>Plan</th>
                      <th className={adminTable.th}>Amount</th>
                      <th className={adminTable.th}>Status</th>
                      <th className={adminTable.th}>Date</th>
                    </tr>
                  </thead>
                  <tbody className={adminTable.tbody}>
                    {q.data.recent_payments.map((p) => (
                      <tr key={p.id} className={adminTable.trHover}>
                        <td className={adminTable.td + ' font-semibold text-slate-900'}>
                          {p.organization_name}
                        </td>
                        <td className={adminTable.td}>{p.plan_name}</td>
                        <td className={adminTable.td + ' font-mono'}>${p.amount_usd}</td>
                        <td className={adminTable.td}>
                          <Chip tone="emerald">✓ {p.status}</Chip>
                        </td>
                        <td className={adminTable.td + ' text-slate-500'}>
                          {fmtDate(p.paid_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TableCard>

            <TableCard title="Recently joined students">
              {q.data.recent_students.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">Nothing yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {q.data.recent_students.map((s) => (
                    <li
                      key={s.username}
                      className="flex items-center justify-between px-6 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{s.name}</p>
                          {s.org_name && (
                            <p className="text-xs text-slate-500">→ {s.org_name}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">{fmtDate(s.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TableCard>
          </div>
        )}
      </PageShell>
    </SuperAdminLayout>
  )
}

function StatusRow({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: 'emerald' | 'amber' | 'rose' | 'slate'
}) {
  const dotClass = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-400',
  }[tone]
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-700">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </span>
      <span className="font-mono text-slate-900">{count}</span>
    </li>
  )
}
