import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Mic,
  PenLine,
  Users,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

type DashboardResponse = {
  organization: {
    id: number
    name: string
    slug: string
    logo: string | null
    primary_color: string
  }
  totals: {
    tests: number
    sessions: number
    completed_sessions: number
    students: number
    teachers: number
    participants: number
    completed_tests: number
    avg_overall: number | null
    recent_sessions_7d: number
  }
  weekly_activity: {
    date: string
    label: string
    sessions: number
    participants: number
  }[]
  score_distribution: { label: string; count: number }[]
  recent_sessions: {
    id: number
    name: string
    date: string
    status: string
    participants_total: number
  }[]
  pending: {
    writing: number
    speaking: number
  }
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Kutilmoqda',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  finished: 'Tugagan',
}

export default function CenterDashboard() {
  const { slug } = useParams<{ slug: string }>()

  const query = useQuery({
    queryKey: ['center-dashboard', slug],
    queryFn: async () =>
      (await api.get<DashboardResponse>(`/center/${slug}/dashboard/`)).data,
    enabled: !!slug,
  })

  const data = query.data

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-light text-slate-900">Bosh sahifa</h1>
        {data && (
          <p className="mt-1 text-sm text-slate-500">{data.organization.name}</p>
        )}
      </div>

      {query.isLoading && <p className="text-slate-500">Yuklanmoqda…</p>}
      {query.isError && (
        <p className="text-rose-600">Ma‘lumotlar yuklanmadi.</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Talabalar"
              value={data.totals.students}
              hint={`${data.totals.teachers} ustoz`}
              tone="blue"
              Icon={Users}
            />
            <StatCard
              label="Mock sessiyalar"
              value={data.totals.sessions}
              hint={`${data.totals.completed_sessions} tugatilgan`}
              tone="emerald"
              Icon={CalendarDays}
            />
            <StatCard
              label="Tugatilgan testlar"
              value={data.totals.completed_tests}
              hint={`${data.totals.participants} ishtirokchi`}
              tone="amber"
              Icon={GraduationCap}
            />
            <StatCard
              label="O‘rtacha overall"
              value={
                data.totals.avg_overall !== null
                  ? data.totals.avg_overall.toFixed(1)
                  : '—'
              }
              hint={`Oxirgi 7 kun: ${data.totals.recent_sessions_7d} sessiya`}
              tone="violet"
              Icon={ClipboardList}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-base font-semibold">
                  Haftalik aktivlik
                </h2>
                <WeeklyChart data={data.weekly_activity} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-base font-semibold">
                  Score distribution (overall)
                </h2>
                <ScoreBars data={data.score_distribution} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PendingCard
              label="Writing baholash kutmoqda"
              count={data.pending.writing}
              Icon={PenLine}
              tone="bg-orange-50 text-orange-700"
            />
            <PendingCard
              label="Speaking baholash kutmoqda"
              count={data.pending.speaking}
              Icon={Mic}
              tone="bg-purple-50 text-purple-700"
            />
            <Card>
              <CardContent className="flex h-full flex-col p-6">
                <h2 className="mb-2 text-base font-semibold">Tezkor amallar</h2>
                <div className="space-y-2 text-sm">
                  <Link
                    to={`/${slug}/admin/mock`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-slate-50"
                  >
                    <span>Yangi mock sessiya</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link
                    to={`/${slug}/admin/students`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-slate-50"
                  >
                    <span>Talaba qo‘shish</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link
                    to={`/${slug}/admin/analytics`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-slate-50"
                  >
                    <span>Analytics</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link
                    to={`/${slug}/admin/settings`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-slate-50"
                  >
                    <span>Markaz sozlamalari</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border-b p-4">
                <h2 className="text-base font-semibold">Oxirgi sessiyalar</h2>
              </div>
              {data.recent_sessions.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">
                  Hozircha mock sessiyalar yo‘q.
                </p>
              ) : (
                <ul className="divide-y">
                  {data.recent_sessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="font-medium text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(s.date).toLocaleDateString('uz-UZ')} ·{' '}
                          {STATUS_LABEL[s.status] || s.status}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        {s.participants_total} ishtirokchi
                        <Link
                          to={`/${slug}/admin/mock/${s.id}/results`}
                          className="ml-3 text-sm text-slate-700 hover:underline"
                        >
                          Natijalar →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

const TONE_CLASSES = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
} as const

function StatCard({
  label, value, hint, tone, Icon,
}: {
  label: string
  value: number | string
  hint?: string
  tone: keyof typeof TONE_CLASSES
  Icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className={`h-1 ${TONE_CLASSES[tone]}`} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              {label}
            </div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">
              {value}
            </div>
            {hint && (
              <div className="mt-1 text-xs text-slate-500">{hint}</div>
            )}
          </div>
          <Icon className="h-5 w-5 text-slate-400" />
        </div>
      </div>
    </div>
  )
}

function WeeklyChart({
  data,
}: {
  data: { label: string; sessions: number; participants: number }[]
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.sessions, d.participants)))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-blue-600" />
          Sessiyalar
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500" />
          Ishtirokchilar
        </span>
      </div>
      <div className="grid grid-cols-7 gap-3 pt-3">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="flex h-32 w-full items-end justify-center gap-1">
              <div
                className="w-3 rounded-t bg-blue-600"
                style={{
                  height: `${(d.sessions / max) * 100}%`,
                  minHeight: d.sessions ? 4 : 0,
                }}
                title={`${d.sessions} sessiya`}
              />
              <div
                className="w-3 rounded-t bg-emerald-500"
                style={{
                  height: `${(d.participants / max) * 100}%`,
                  minHeight: d.participants ? 4 : 0,
                }}
                title={`${d.participants} ishtirokchi`}
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoreBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span>{d.label}</span>
            <span className="font-mono text-slate-900">{d.count}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-violet-600"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function PendingCard({
  label, count, Icon, tone,
}: {
  label: string
  count: number
  Icon: React.ComponentType<{ className?: string }>
  tone: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-3xl font-semibold text-slate-900">{count}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
