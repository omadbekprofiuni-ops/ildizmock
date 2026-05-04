import { useQuery } from '@tanstack/react-query'
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  GraduationCap,
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useOrgContext } from '@/stores/orgContext'

import SuperAdminLayout from './SuperAdminLayout'

interface Stats {
  students_count: number
  teachers_count: number
  attempts_total: number
  attempts_graded: number
  avg_band_score: number | null
  mock_sessions_total: number
  mock_sessions_finished: number
  mock_participants_total: number
  total_revenue_uzs: number
  unpaid_charges_count: number
}

function fmtMoney(n: number): string {
  return n.toLocaleString('uz-UZ') + " so'm"
}

export default function OrgStatisticsPage() {
  const { orgId: paramId } = useParams<{ orgId: string }>()
  const ctxId = useOrgContext((s) => s.orgId)
  const orgId = paramId ? Number(paramId) : ctxId
  const orgName = useOrgContext((s) => s.orgName)

  const query = useQuery({
    queryKey: ['super-org-stats', orgId],
    queryFn: async () =>
      (await api.get<Stats>(`/super/organizations/${orgId}/statistics/`)).data,
    enabled: !!orgId,
  })

  const stats = query.data

  return (
    <SuperAdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Statistika</h1>
            <p className="text-sm text-muted-foreground">
              {orgName ? `${orgName} center statistics` : 'No center selected'}
            </p>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {!orgId ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              First select a center.
            </CardContent>
          </Card>
        ) : query.isLoading ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-400">
              Yuklanmoqda...
            </CardContent>
          </Card>
        ) : !stats ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-400">
              Couldn't fetch data.
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                Icon={Users}
                tone="blue"
                label="Students"
                value={stats.students_count}
              />
              <StatCard
                Icon={GraduationCap}
                tone="emerald"
                label="O'qituvchilar"
                value={stats.teachers_count}
              />
              <StatCard
                Icon={Award}
                tone="amber"
                label="O'rtacha band"
                value={stats.avg_band_score?.toFixed(1) ?? '—'}
              />
              <StatCard
                Icon={CreditCard}
                tone="rose"
                label="Tushum"
                value={fmtMoney(stats.total_revenue_uzs)}
                small
              />
            </section>

            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Test urinishlar
                  </h3>
                  <Row
                    Icon={CheckCircle2}
                    label="Total attempts"
                    value={stats.attempts_total}
                  />
                  <Row
                    Icon={Trophy}
                    label="Baholangan"
                    value={stats.attempts_graded}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Mock sessions
                  </h3>
                  <Row
                    Icon={Clock}
                    label="Total sessions"
                    value={stats.mock_sessions_total}
                  />
                  <Row
                    Icon={CheckCircle2}
                    label="Tugagan"
                    value={stats.mock_sessions_finished}
                  />
                  <Row
                    Icon={Users}
                    label="Ishtirokchilar"
                    value={stats.mock_participants_total}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    To'lovlar
                  </h3>
                  <Row
                    Icon={CreditCard}
                    label="Total revenue"
                    value={fmtMoney(stats.total_revenue_uzs)}
                  />
                  <Row
                    Icon={Clock}
                    label="To'lanmagan"
                    value={stats.unpaid_charges_count}
                  />
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}

const TONE_BG: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
}

function StatCard({
  Icon,
  tone,
  label,
  value,
  small,
}: {
  Icon: LucideIcon
  tone: 'blue' | 'emerald' | 'amber' | 'rose'
  label: string
  value: string | number
  small?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${TONE_BG[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p
            className={`mt-0.5 truncate font-bold text-slate-900 ${
              small ? 'text-lg' : 'text-2xl'
            }`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </div>
      <span className="font-mono text-sm font-bold text-slate-900">{value}</span>
    </div>
  )
}
