import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Star,
  Target,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { B2CLayout } from '@/components/B2CLayout'
import { api } from '@/lib/api'
import { useAuth, type User } from '@/stores/auth'

interface Kpi {
  practice_days: number
  tests_taken: number
  avg_score: number | null
  exam_in_days: number | null
}

interface Streak { current_streak: number; best_streak: number }
interface Weekly {
  sessions_done: number
  sessions_goal: number
  percent: number
  minutes_this_week: number
}
interface Cell { date: string; minutes: number; band: number }
interface GettingStartedItem {
  key: string
  label: string
  done: boolean
  href: string
}
interface GettingStarted {
  items: GettingStartedItem[]
  done_count: number
  total: number
  percent: number
}
interface Section {
  key: string
  name: string
  count: number
  accent: 'blue' | 'rose' | 'emerald' | 'violet'
  ready: boolean
}

interface DashboardData {
  user: User
  kpi: Kpi
  streak: Streak
  weekly: Weekly
  heatmap: (Cell | null)[][]
  getting_started: GettingStarted
  sections: Section[]
}

const SECTION_STYLE: Record<Section['accent'], string> = {
  blue: 'border-l-4 border-blue-500 bg-blue-50/40 hover:bg-blue-50',
  rose: 'border-l-4 border-rose-500 bg-rose-50/40 hover:bg-rose-50',
  emerald: 'border-l-4 border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50',
  violet: 'border-l-4 border-violet-500 bg-violet-50/40 hover:bg-violet-50',
}

const HEAT_BAND: Record<number, string> = {
  0: 'bg-slate-100',
  1: 'bg-rose-200',
  2: 'bg-rose-400',
  3: 'bg-rose-600',
  4: 'bg-rose-800',
}

const WEEKDAY_LABELS = ['Du', '', 'Cho', '', 'Ju', '', 'Ya']

function KpiTile({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-semibold text-slate-500">{suffix}</span>}
      </p>
    </div>
  )
}

function ActivityWidget({
  streak,
  weekly,
  heatmap,
}: {
  streak: Streak
  weekly: Weekly
  heatmap: (Cell | null)[][]
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-5">
        <h2 className="text-lg font-extrabold text-slate-900">Faollik</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Oxirgi 12 hafta — hujayra rangi kun davomidagi mashq daqiqasiga qarab
        </p>
      </div>

      {/* 4 KPI tiles within activity */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-700" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">Joriy streak</p>
          </div>
          <p className="text-2xl font-extrabold text-orange-700">
            {streak.current_streak} <span className="text-sm font-semibold">kun</span>
          </p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-700" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Eng uzun streak</p>
          </div>
          <p className="text-2xl font-extrabold text-amber-700">
            {streak.best_streak} <span className="text-sm font-semibold">kun</span>
          </p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-700" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Haftalik maqsad</p>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">
            {weekly.sessions_done}
            <span className="text-sm font-semibold"> / {weekly.sessions_goal}</span>
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${weekly.percent}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-700" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Bu hafta vaqt</p>
          </div>
          <p className="text-2xl font-extrabold text-sky-700">
            {weekly.minutes_this_week} <span className="text-sm font-semibold">daqiqa</span>
          </p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        <div className="flex shrink-0 flex-col gap-1 pt-0.5 text-[10px] text-slate-400">
          {WEEKDAY_LABELS.map((label, idx) => (
            <span key={idx} className="h-3.5 leading-3.5">{label}</span>
          ))}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-1">
          {heatmap.flatMap((row, rIdx) =>
            row.map((cell, cIdx) => {
              if (!cell) {
                return <div key={`${rIdx}-${cIdx}`} className="h-3.5 w-3.5" />
              }
              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className={`h-3.5 w-3.5 rounded-sm ${HEAT_BAND[cell.band] ?? 'bg-slate-100'}`}
                  title={`${cell.date} — ${cell.minutes} daqiqa`}
                />
              )
            }),
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500">
        <span>Kam</span>
        <span className="h-3 w-3 rounded-sm bg-slate-100" />
        <span className="h-3 w-3 rounded-sm bg-rose-200" />
        <span className="h-3 w-3 rounded-sm bg-rose-400" />
        <span className="h-3 w-3 rounded-sm bg-rose-600" />
        <span className="h-3 w-3 rounded-sm bg-rose-800" />
        <span>Ko'p</span>
      </div>
      <p className="mt-2 text-right text-[11px] text-slate-400">
        0 / 1–15 / 16–30 / 31–60 / 60+ daqiqa
      </p>
    </div>
  )
}

export default function B2CDashboardPage() {
  const user = useAuth((s) => s.user)

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['b2c-dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/b2c/dashboard')).data,
  })

  return (
    <B2CLayout active="dashboard">
      {/* Greeting + KPI */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Salom, {user?.first_name || user?.email}!
            </h1>
            {user?.target_exam && (
              <p className="mt-1 text-sm text-slate-600">
                Maqsad: <span className="font-semibold text-slate-800">{user.target_exam}</span>
                {user.target_band ? <> · Band <span className="font-semibold">{user.target_band}</span></> : null}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile label="Mashq kunlari" value={data?.kpi.practice_days ?? '—'} />
          <KpiTile label="Yechilgan testlar" value={data?.kpi.tests_taken ?? '—'} />
          <KpiTile label="O'rtacha ball" value={data?.kpi.avg_score ?? '—'} />
          <KpiTile
            label="Imtihon"
            value={data?.kpi.exam_in_days ?? '—'}
            suffix={data?.kpi.exam_in_days != null ? 'kun' : undefined}
          />
        </div>
      </section>

      {/* Section overview — endi katalog filter'iga clickable */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Bo'limlar</h2>
          <Link
            to="/b2c/catalog"
            className="text-xs font-bold text-brand-700 hover:underline"
          >
            Katalogni ochish →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {data?.sections.map((s) => (
            <Link
              key={s.key}
              to={`/b2c/catalog?section=${s.key}`}
              className={`block rounded-xl p-4 transition-colors ${SECTION_STYLE[s.accent]}`}
            >
              <p className="text-sm font-bold text-slate-800">{s.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {s.ready ? `${s.count} ta test` : 'Tez orada'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Getting started */}
      {data && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Boshlash</h2>
            <span className="text-sm font-bold text-slate-700">
              {data.getting_started.percent}%
            </span>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            {data.getting_started.done_count} / {data.getting_started.total} bajarildi
          </p>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${data.getting_started.percent}%` }}
            />
          </div>
          <ul className="divide-y divide-slate-100">
            {data.getting_started.items.map((item) => (
              <Link
                key={item.key}
                to={item.href}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50"
              >
                {item.done ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <Circle className="h-6 w-6 text-slate-300" />
                )}
                <span
                  className={`flex-1 text-sm ${
                    item.done ? 'text-slate-400 line-through' : 'text-slate-800'
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-slate-400">→</span>
              </Link>
            ))}
          </ul>
        </section>
      )}

      {/* Activity widget */}
      {data && (
        <ActivityWidget
          streak={data.streak}
          weekly={data.weekly}
          heatmap={data.heatmap}
        />
      )}

      {isLoading && !data && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Yuklanmoqda…
        </div>
      )}
    </B2CLayout>
  )
}
