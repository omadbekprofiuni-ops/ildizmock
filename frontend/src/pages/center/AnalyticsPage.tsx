import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type AnalyticsResponse = {
  totals: {
    students: number
    teachers: number
    sessions: number
    participants: number
    completed: number
  }
  averages: {
    overall: number | null
    listening: number | null
    reading: number | null
    writing: number | null
    speaking: number | null
    max_overall: number | null
    min_overall: number | null
  }
  score_distribution: { label: string; count: number }[]
  monthly_trend: { month: string; count: number; avg_score: number | null }[]
  top_students: {
    id: number
    full_name: string
    listening_score: number | null
    reading_score: number | null
    writing_score: number | null
    speaking_score: number | null
    overall_band_score: number | null
    session_name: string
    session_date: string
  }[]
  recent_sessions: {
    id: number
    name: string
    date: string
    status: string
    participants_total: number
  }[]
}

function fmt(value: number | null, digits = 1): string {
  return value === null || value === undefined ? '—' : value.toFixed(digits)
}

export default function CenterAnalyticsPage() {
  const { slug } = useParams<{ slug: string }>()
  useEffect(() => { document.title = 'ILDIZmock — Analytics' }, [])

  const query = useQuery({
    queryKey: ['center-analytics', slug],
    queryFn: async () =>
      (await api.get<AnalyticsResponse>(`/center/${slug}/analytics/`)).data,
    enabled: !!slug,
  })

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get(`/center/${slug}/analytics/export.xlsx`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Mock_Results_${slug}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    onError: () => toast.error('Couldn't download Excel'),
  })

  const data = query.data

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Center results, trends, and top students.
          </p>
        </div>
        <Button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" /> Excel export
            </>
          )}
        </Button>
      </div>

      {query.isLoading && <p className="text-slate-500">Loading…</p>}
      {query.isError && (
        <p className="text-rose-600">Couldn't load data.</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Students" value={data.totals.students} />
            <Stat label="Sessions" value={data.totals.sessions} />
            <Stat
              label="Completed tests"
              value={data.totals.completed}
              hint={`${data.totals.participants} ishtirokchi`}
            />
            <Stat
              label="O‘rtacha overall"
              value={fmt(data.averages.overall)}
              accent="text-emerald-600"
              hint={
                data.averages.max_overall !== null
                  ? `Eng yuqori: ${fmt(data.averages.max_overall)}`
                  : undefined
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-base font-semibold">Score distribution</h2>
                <BarChart data={data.score_distribution} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-base font-semibold">Section o‘rtacha ballari</h2>
                <SectionBars
                  values={[
                    { label: 'Listening', value: data.averages.listening, color: '#10b981' },
                    { label: 'Reading', value: data.averages.reading, color: '#3b82f6' },
                    { label: 'Writing', value: data.averages.writing, color: '#f97316' },
                    { label: 'Speaking', value: data.averages.speaking, color: '#a855f7' },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-base font-semibold">6-month trend</h2>
              <TrendChart data={data.monthly_trend} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b p-4">
                <h2 className="text-base font-semibold">Top 10 students</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Session</th>
                      <th className="px-4 py-3 text-center">L</th>
                      <th className="px-4 py-3 text-center">R</th>
                      <th className="px-4 py-3 text-center">W</th>
                      <th className="px-4 py-3 text-center">S</th>
                      <th className="px-4 py-3 text-center">Overall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.top_students.map((s, i) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold">{i + 1}</td>
                        <td className="px-4 py-3">{s.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <div>{s.session_name}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(s.session_date).toLocaleDateString('uz-UZ')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{fmt(s.listening_score)}</td>
                        <td className="px-4 py-3 text-center font-mono">{fmt(s.reading_score)}</td>
                        <td className="px-4 py-3 text-center font-mono">{fmt(s.writing_score)}</td>
                        <td className="px-4 py-3 text-center font-mono">{fmt(s.speaking_score)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-white">
                            {fmt(s.overall_band_score)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.top_students.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          Hozircha tugallangan testlar yo‘q.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {data.recent_sessions.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-base font-semibold">Recent sessions</h2>
                <ul className="divide-y">
                  {data.recent_sessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(s.date).toLocaleDateString('uz-UZ')} · {s.status}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {s.participants_total} ishtirokchi
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
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
      <div className={`mt-1 text-3xl font-semibold ${accent ?? 'text-slate-900'}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

function BarChart({ data }: { data: { label: string; count: number }[] }) {
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
              className="h-full bg-blue-600"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionBars({
  values,
}: {
  values: { label: string; value: number | null; color: string }[]
}) {
  return (
    <div className="space-y-3">
      {values.map((v) => {
        const num = v.value ?? 0
        return (
          <div key={v.label}>
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span>{v.label}</span>
              <span className="font-mono text-slate-900">{fmt(v.value)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full"
                style={{ width: `${Math.min(num / 9, 1) * 100}%`, background: v.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TrendChart({
  data,
}: {
  data: { month: string; count: number; avg_score: number | null }[]
}) {
  if (data.length === 0) return <p className="text-sm text-slate-500">Information yo‘q</p>

  const W = 800
  const H = 220
  const PAD_X = 40
  const PAD_Y = 20
  const xFor = (i: number) =>
    data.length === 1
      ? W / 2
      : PAD_X + (i * (W - 2 * PAD_X)) / (data.length - 1)
  const yScore = (band: number) => H - PAD_Y - (band / 9) * (H - 2 * PAD_Y)
  const maxCount = Math.max(1, ...data.map((d) => d.count))
  const yCount = (count: number) =>
    H - PAD_Y - (count / maxCount) * (H - 2 * PAD_Y)

  const scorePath = data
    .map((d, i) => {
      if (d.avg_score === null) return ''
      return `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yScore(d.avg_score).toFixed(1)}`
    })
    .filter(Boolean)
    .join(' ')

  const countPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yCount(d.count).toFixed(1)}`)
    .join(' ')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-blue-600" />
          Testlar soni
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-orange-600" />
          O‘rtacha band (0–9)
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full min-w-[480px]">
          {[0, 3, 5, 7, 9].map((band) => (
            <g key={band}>
              <line
                x1={PAD_X}
                x2={W - PAD_X}
                y1={yScore(band)}
                y2={yScore(band)}
                stroke="#e2e8f0"
                strokeDasharray={band === 0 ? '0' : '3 3'}
                strokeWidth={1}
              />
              <text x={PAD_X - 6} y={yScore(band) + 3} fontSize="10" fill="#94a3b8" textAnchor="end">
                {band}
              </text>
            </g>
          ))}
          {countPath && (
            <path d={countPath} fill="none" stroke="#2563eb" strokeWidth={2} />
          )}
          {scorePath && (
            <path d={scorePath} fill="none" stroke="#ea580c" strokeWidth={2.5} />
          )}
          {data.map((d, i) => (
            <text
              key={i}
              x={xFor(i)}
              y={H - 4}
              fontSize="10"
              fill="#64748b"
              textAnchor="middle"
            >
              {d.month}
            </text>
          ))}
          {data.map((d, i) => (
            <circle key={`p-${i}`} cx={xFor(i)} cy={yCount(d.count)} r={3} fill="#2563eb" />
          ))}
          {data.map((d, i) =>
            d.avg_score !== null ? (
              <circle
                key={`s-${i}`}
                cx={xFor(i)}
                cy={yScore(d.avg_score)}
                r={3}
                fill="#ea580c"
              />
            ) : null,
          )}
        </svg>
      </div>
    </div>
  )
}
