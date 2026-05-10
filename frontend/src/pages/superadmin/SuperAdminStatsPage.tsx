import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import SuperAdminLayout from './SuperAdminLayout'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

type StatsResponse = {
  orgs_total: number
  orgs_by_status: {
    active: number
    trial: number
    expired: number
    blocked: number
  }
  students_total: number
  teachers_total: number
  tests_total: number
  tests_global: number
  mock_sessions_total: number
  mock_sessions_finished: number
  mock_completed_count: number
  mock_avg_overall: number | null
  attempts_this_month: number
  attempts_total: number
  attempts_by_module: Record<
    'listening' | 'reading' | 'writing' | 'speaking',
    { attempts: number; avg_band: number | null }
  >
  revenue_total_usd: number
  recent_payments: {
    id: number
    organization: number
    organization_name?: string
    plan: number
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

const MODULE_COLORS = {
  listening: { bg: 'bg-emerald-500', text: 'text-emerald-700' },
  reading: { bg: 'bg-blue-500', text: 'text-blue-700' },
  writing: { bg: 'bg-orange-500', text: 'text-orange-700' },
  speaking: { bg: 'bg-purple-500', text: 'text-purple-700' },
} as const

export default function SuperAdminStatsPage() {
  useEffect(() => { document.title = 'ILDIZmock — Statistics' }, [])

  const query = useQuery({
    queryKey: ['super-stats'],
    queryFn: async () => (await api.get<StatsResponse>('/super/stats/')).data,
  })

  const data = query.data

  return (
    <SuperAdminLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Platform-wide overview metrics.
          </p>
        </div>

        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && (
          <p className="text-cta-600">Couldn't load statistics.</p>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat
                label="Centers"
                value={data.orgs_total}
                hint={`${data.orgs_by_status.active} faol · ${data.orgs_by_status.trial} trial`}
              />
              <Stat
                label="Students"
                value={data.students_total}
                hint={`${data.teachers_total} teachers`}
              />
              <Stat
                label="Testlar"
                value={data.tests_total}
                hint={`${data.tests_global} global`}
              />
              <Stat
                label="Mock sessions"
                value={data.mock_sessions_total}
                hint={`${data.mock_sessions_finished} completed`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat
                label="This month's attempts"
                value={data.attempts_this_month}
                hint={`Total: ${data.attempts_total}`}
                accent="text-blue-600"
              />
              <Stat
                label="Mock results"
                value={data.mock_completed_count}
                hint={
                  data.mock_avg_overall !== null
                    ? `O‘rtacha: ${data.mock_avg_overall.toFixed(1)}`
                    : 'O‘rtacha: —'
                }
                accent="text-emerald-600"
              />
              <Stat
                label="Trial markazlar"
                value={data.orgs_by_status.trial}
                hint={`${data.orgs_by_status.expired} muddat tugagan`}
                accent="text-amber-600"
              />
              <Stat
                label="Revenue ($)"
                value={`$${data.revenue_total_usd.toFixed(0)}`}
                accent="text-violet-600"
              />
            </div>

            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-base font-semibold">
                  Modul bo‘yicha attempts
                </h2>
                <div className="space-y-4">
                  {(['listening', 'reading', 'writing', 'speaking'] as const).map(
                    (m) => {
                      const stat = data.attempts_by_module[m]
                      const total = data.attempts_total || 1
                      const ratio = (stat.attempts / total) * 100
                      const colors = MODULE_COLORS[m]
                      return (
                        <div key={m}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className={`font-medium capitalize ${colors.text}`}>
                              {m}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-slate-600">
                              <span className="font-mono">{stat.attempts}</span>
                              {stat.avg_band !== null && (
                                <span>O‘rtacha band: {stat.avg_band.toFixed(1)}</span>
                              )}
                            </div>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full ${colors.bg}`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="p-0">
                  <div className="border-b p-4">
                    <h2 className="text-base font-semibold">New studentlar</h2>
                  </div>
                  {data.recent_students.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">Hozircha yo‘q.</p>
                  ) : (
                    <ul className="divide-y">
                      {data.recent_students.map((s, i) => (
                        <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                          <div>
                            <div className="font-medium text-slate-900">{s.name}</div>
                            <div className="text-xs text-slate-500">@{s.username}</div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            {s.org_name || '—'}
                            <div>{new Date(s.created_at).toLocaleDateString('uz-UZ')}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="border-b p-4">
                    <h2 className="text-base font-semibold">Tarif yaqinda tugaydi</h2>
                  </div>
                  {data.soon_expiring.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">
                      No centers with plans expiring soon.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {data.soon_expiring.map((o) => (
                        <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                          <div>
                            <div className="font-medium text-slate-900">{o.name}</div>
                            <div className="text-xs text-slate-500">{o.plan_name}</div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              o.days_remaining <= 3
                                ? 'bg-cta-100 text-cta-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {o.days_remaining} days
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}

function Stat({
  label, value, hint, accent,
}: {
  label: string; value: string | number; hint?: string; accent?: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? 'text-slate-900'}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
