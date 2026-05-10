import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Minus,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StateCard,
  SurfaceCard,
  btnPrimary,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

type Group = {
  id: number
  name: string
  description: string
  teacher: { id: number; full_name: string; username: string } | null
  target_band_score: string | null
  class_schedule: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  student_count: number
  avg_score: number | null
  latest_avg: number | null
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  created_at: string
}

function TrendBadge({ trend }: { trend: Group['trend'] }) {
  if (trend === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <ArrowUp size={12} /> Yaxshilanmoqda
      </span>
    )
  }
  if (trend === 'declining') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-cta-50 px-2 py-0.5 text-xs font-medium text-cta-700">
        <ArrowDown size={12} /> Pasaymoqda
      </span>
    )
  }
  if (trend === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        <Minus size={12} /> Barqaror
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
      Not enough data
    </span>
  )
}

export default function GroupsListPage() {
  const { slug } = useParams<{ slug: string }>()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    api
      .get<Group[]>(`/center/${slug}/groups/`)
      .then((r) => setGroups(r.data))
      .finally(() => setLoading(false))
  }, [slug])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) =>
      `${g.name} ${g.teacher?.full_name ?? ''}`.toLowerCase().includes(q),
    )
  }, [groups, filter])

  return (
    <PageShell>
      <PageHeader
        title="Student groups"
        subtitle="Guruhlarning o‘rtacha balli va progressini bir joyda kuzating"
        actions={
          <>
            <Link
              to={`/${slug}/admin/groups/comparison`}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Taqqoslash
            </Link>
            <Link to={`/${slug}/admin/groups/new`} className={btnPrimary}>
              <Plus size={16} /> New group
            </Link>
          </>
        }
      />

      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Group or teacher name…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <span className="text-xs text-slate-500">
            Total: <strong className="text-slate-900">{groups.length}</strong>
          </span>
        </div>
      </SurfaceCard>

      {loading ? (
        <StateCard Icon={Users} title="Loading…" />
      ) : filtered.length === 0 ? (
        <StateCard
          Icon={Users}
          title="No groups yet"
          description="Birinchi guruhni yarating va talabalarni qo‘shing."
          action={
            <Link to={`/${slug}/admin/groups/new`} className={btnPrimary}>
              <Plus size={16} /> New group
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((g) => (
            <Link
              key={g.id}
              to={`/${slug}/admin/groups/${g.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-brand-700">
                    {g.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {g.teacher
                      ? `Teacher: ${g.teacher.full_name}`
                      : 'Teacher tayinlanmagan'}
                  </p>
                </div>
                {g.target_band_score && (
                  <Chip tone="amber">Maqsad {g.target_band_score}</Chip>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-slate-900">
                    {g.student_count}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    Students
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-emerald-700">
                    {g.avg_score != null ? g.avg_score.toFixed(1) : '—'}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-emerald-600">
                    O‘rtacha
                  </div>
                </div>
                <div className="rounded-lg bg-brand-50 px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-brand-700">
                    {g.latest_avg != null ? g.latest_avg.toFixed(1) : '—'}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-brand-600">
                    So‘nggi
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <TrendBadge trend={g.trend} />
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 group-hover:text-brand-600">
                  Batafsil <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  )
}
