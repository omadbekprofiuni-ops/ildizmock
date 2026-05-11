/**
 * ETAP 20 Tab 3 — Tahlil/Hisobot.
 *
 * Trend (oxirgi 6 oy) + at-risk (davomati < 70%) talabalar ro'yxati.
 * Chart.js o'rniga inline SVG line chart — qo'shimcha bog'liqlik kerak emas.
 */
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { StateCard, SurfaceCard } from '@/components/admin-shell'
import { api } from '@/lib/api'

import type { AttendanceGroup } from '../AttendancePage'

interface AnalyticsResponse {
  group?: { id: number; name: string }
  trend?: Array<{ month: string; percent: number | null; marked: number }>
  at_risk: Array<{
    student_id: number
    student_name: string
    username: string
    percent: number
    marked: number
    attended: number
  }>
}

const MONTH_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

function monthLabel(key: string) {
  const [, m] = key.split('-')
  const idx = Number(m) - 1
  return MONTH_SHORT[idx] ?? key
}

function TrendChart({
  trend,
}: {
  trend: Array<{ month: string; percent: number | null; marked: number }>
}) {
  const W = 600
  const H = 240
  const padding = { top: 20, right: 20, bottom: 36, left: 36 }
  const innerW = W - padding.left - padding.right
  const innerH = H - padding.top - padding.bottom

  const points = trend.map((t, idx) => ({
    x: trend.length > 1
      ? padding.left + (innerW * idx) / (trend.length - 1)
      : padding.left + innerW / 2,
    y: t.percent != null
      ? padding.top + innerH * (1 - t.percent / 100)
      : null,
    label: monthLabel(t.month),
    percent: t.percent,
  }))

  const path = points
    .filter((p) => p.y !== null)
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ')

  const yTicks = [0, 25, 50, 75, 100]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Y axis grid */}
      {yTicks.map((t) => {
        const y = padding.top + innerH * (1 - t / 100)
        return (
          <g key={t}>
            <line
              x1={padding.left}
              x2={padding.left + innerW}
              y1={y}
              y2={y}
              stroke="#E2E8F0"
              strokeDasharray="3 3"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
              {t}%
            </text>
          </g>
        )
      })}

      {/* Line */}
      {path && (
        <path d={path} fill="none" stroke="#1F3FAB" strokeWidth={2.5} strokeLinejoin="round" />
      )}

      {/* Points */}
      {points.map((p, idx) =>
        p.y == null ? null : (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={4} fill="#1F3FAB" />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              className="fill-brand-700 text-[10px] font-bold"
            >
              {p.percent}%
            </text>
          </g>
        ),
      )}

      {/* X axis labels */}
      {points.map((p, idx) => (
        <text
          key={idx}
          x={p.x}
          y={H - padding.bottom + 18}
          textAnchor="middle"
          className="fill-slate-500 text-[10px] font-semibold"
        >
          {p.label}
        </text>
      ))}
    </svg>
  )
}

export default function AttendanceAnalyticsTab({
  slug,
  groups,
}: {
  slug: string
  groups: AttendanceGroup[]
}) {
  const [groupId, setGroupId] = useState<number | ''>('')

  const analyticsQ = useQuery({
    queryKey: ['attendance-analytics', slug, groupId],
    queryFn: async () => {
      const params: Record<string, number> = {}
      if (groupId) params.group = Number(groupId)
      return (
        await api.get<AnalyticsResponse>(
          `/center/${slug}/attendance/v2/analytics/`,
          { params },
        )
      ).data
    },
    enabled: !!slug,
  })

  const data = analyticsQ.data
  const trend = useMemo(() => data?.trend ?? [], [data])
  const hasTrend = trend.some((t) => t.percent != null)

  return (
    <div className="space-y-4">
      <SurfaceCard className="flex flex-col gap-2 md:flex-row md:items-end">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Guruh
          </span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Barcha guruhlar (markaz bo'yicha)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </SurfaceCard>

      {analyticsQ.isLoading ? (
        <SurfaceCard className="text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" /> Yuklanmoqda...
        </SurfaceCard>
      ) : (
        <>
          {groupId && (
            <SurfaceCard>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-600" />
                <h2 className="text-sm font-extrabold text-slate-900">
                  Davomat trendi (oxirgi 6 oy)
                </h2>
              </div>
              {hasTrend ? (
                <TrendChart trend={trend} />
              ) : (
                <p className="py-6 text-center text-sm text-slate-400">
                  Trend uchun yetarli ma'lumot yo'q
                </p>
              )}
            </SurfaceCard>
          )}

          <SurfaceCard>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600" />
              <h2 className="text-sm font-extrabold text-slate-900">
                Xavfli talabalar (davomati &lt; 70%)
              </h2>
            </div>
            {(data?.at_risk ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Xavfli talabalar yo'q. ✨
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(data?.at_risk ?? []).map((s) => (
                  <li key={s.student_id}>
                    <Link
                      to={`/${slug}/admin/attendance/student/${s.student_id}`}
                      className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {s.student_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          @{s.username} · {s.attended} / {s.marked} sessiya
                        </p>
                      </div>
                      <span className="ml-3 shrink-0 text-sm font-extrabold text-rose-600">
                        {s.percent}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>

          {!groupId && (
            <StateCard
              title="Trend chart"
              description="Guruhni tanlang — oxirgi 6 oylik davomat trendi shu yerda chiqadi."
            />
          )}
        </>
      )}
    </div>
  )
}
