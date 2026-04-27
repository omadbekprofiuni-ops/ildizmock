import { useQuery } from '@tanstack/react-query'
import { BookOpen, ClipboardList, TrendingUp, Users } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

import AdminLayout from './AdminLayout'

type DashboardData = {
  students: number
  users: number
  tests_total: number
  tests_published: number
  attempts_total: number
  attempts_graded: number
  avg_band: number | null
  by_module: Record<string, number>
  recent_attempts: {
    id: string
    user_name: string
    user_username: string
    test_name: string
    module: string
    status: string
    band_score: string | null
    raw_score: number | null
    total_questions: number | null
    started_at: string
  }[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => (await api.get<DashboardData>('/admin/stats/overview')).data,
  })

  return (
    <AdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overall platform metrics
        </p>
      </header>
      <div className="space-y-6 p-8">
        {query.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {query.isError && (
          <p className="text-destructive">
            Failed to load statistics. (Are you sure you have admin permission?)
          </p>
        )}
        {query.data && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Users"
                value={query.data.users}
                hint={`${query.data.students} students`}
                Icon={Users}
                tint="bg-blue-500"
              />
              <StatCard
                label="Tests"
                value={query.data.tests_total}
                hint={`${query.data.tests_published} published`}
                Icon={BookOpen}
                tint="bg-emerald-500"
              />
              <StatCard
                label="Attempts"
                value={query.data.attempts_total}
                hint={`${query.data.attempts_graded} graded`}
                Icon={ClipboardList}
                tint="bg-orange-500"
              />
              <StatCard
                label="Average band"
                value={query.data.avg_band?.toFixed(1) ?? '—'}
                hint="Based on graded attempts"
                Icon={TrendingUp}
                tint="bg-purple-500"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="border-b px-6 py-4">
                  <h2 className="text-lg font-semibold">Recent attempts</h2>
                </div>
                {query.data.recent_attempts.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Nothing yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-6 py-3">User</th>
                        <th className="px-6 py-3">Test</th>
                        <th className="px-6 py-3">Module</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Band</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {query.data.recent_attempts.map((a) => (
                        <tr key={a.id}>
                          <td className="px-6 py-3 font-medium text-slate-900">
                            {a.user_name}
                          </td>
                          <td className="px-6 py-3 text-slate-700">{a.test_name}</td>
                          <td className="px-6 py-3 text-slate-600 capitalize">{a.module}</td>
                          <td className="px-6 py-3 text-slate-600">
                            {formatDate(a.started_at)}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                a.status === 'graded'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-mono text-slate-900">
                            {a.band_score ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

type StatProps = {
  label: string
  value: string | number
  hint?: string
  Icon: React.ComponentType<{ className?: string }>
  tint: string
}

function StatCard({ label, value, hint, Icon, tint }: StatProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`rounded-lg ${tint} p-3 text-white`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
          {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
