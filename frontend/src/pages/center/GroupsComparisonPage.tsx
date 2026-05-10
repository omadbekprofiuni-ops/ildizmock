import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  Minus,
  Trophy,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  PageHeader,
  PageShell,
  StateCard,
  SurfaceCard,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

type Row = {
  id: number
  name: string
  teacher: string | null
  student_count: number
  avg_score: number | null
  latest_avg: number | null
  target_band_score: number | null
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data'
}

function TrendIcon({ trend }: { trend: Row['trend'] }) {
  if (trend === 'improving')
    return <ArrowUp size={14} className="text-emerald-600" />
  if (trend === 'declining')
    return <ArrowDown size={14} className="text-cta-600" />
  if (trend === 'stable') return <Minus size={14} className="text-slate-400" />
  return <span className="text-xs text-slate-400">—</span>
}

export default function GroupsComparisonPage() {
  const { slug } = useParams<{ slug: string }>()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    api
      .get<Row[]>(`/center/${slug}/groups/comparison/`)
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <PageShell>
      <Link
        to={`/${slug}/admin/groups`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Groups
      </Link>

      <PageHeader
        title="Compare groups"
        subtitle="Ranking of active groups by average score"
      />

      {loading ? (
        <StateCard Icon={Trophy} title="Loading…" />
      ) : rows.length === 0 ? (
        <StateCard
          Icon={Trophy}
          title="No groups yet"
          description="First create a few groups and assign students."
        />
      ) : (
        <SurfaceCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Teacher</th>
                  <th className="px-3 py-2 text-center">Students</th>
                  <th className="px-3 py-2 text-center">O‘rtacha</th>
                  <th className="px-3 py-2 text-center">So‘nggi</th>
                  <th className="px-3 py-2 text-center">Maqsad</th>
                  <th className="px-3 py-2 text-center">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={
                      idx === 0
                        ? 'bg-amber-50/50 hover:bg-amber-50'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="px-3 py-2.5 font-mono text-slate-700">
                      {idx === 0 ? (
                        <Award size={16} className="text-amber-500" />
                      ) : (
                        idx + 1
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/${slug}/admin/groups/${r.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {r.teacher ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">
                      {r.student_count}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-emerald-700">
                      {r.avg_score != null ? r.avg_score.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-brand-700">
                      {r.latest_avg != null ? r.latest_avg.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-700">
                      {r.target_band_score != null
                        ? r.target_band_score.toFixed(1)
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <TrendIcon trend={r.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}
    </PageShell>
  )
}
