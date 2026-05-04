import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

type MockResultRow = {
  id: number
  session_id: number
  session_name: string
  session_date: string
  session_status: string
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
  overall_band_score: string | null
  writing_status: 'pending' | 'grading' | 'graded'
  speaking_status: 'pending' | 'graded'
}

type MockResultsResponse = {
  results: MockResultRow[]
  stats: {
    total: number
    completed: number
    avg_overall: number | null
    avg_listening: number | null
    avg_reading: number | null
    avg_writing: number | null
    avg_speaking: number | null
    latest_overall: number | null
  }
}

function num(value: string | null): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function fmt(value: number | string | null, digits = 1): string {
  const n = typeof value === 'string' ? num(value) : value
  return n === null || n === undefined ? '—' : n.toFixed(digits)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export default function MockResultsPage() {
  useEffect(() => { document.title = 'ILDIZmock — My Mock Tests' }, [])

  const query = useQuery({
    queryKey: ['my-mock-results'],
    queryFn: async () =>
      (await api.get<MockResultsResponse>('/student/mock/results/')).data,
  })

  const rows = query.data?.results ?? []
  const stats = query.data?.stats

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">My Mock Tests</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container space-y-8 py-10">
        {query.isLoading && (
          <p className="text-muted-foreground">Loading…</p>
        )}
        {query.isError && (
          <p className="text-destructive">Failed to load mock results.</p>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatCard label="Latest Overall" value={fmt(stats.latest_overall)} accent />
            <StatCard label="Avg L" value={fmt(stats.avg_listening)} />
            <StatCard label="Avg R" value={fmt(stats.avg_reading)} />
            <StatCard label="Avg W" value={fmt(stats.avg_writing)} />
            <StatCard label="Avg S" value={fmt(stats.avg_speaking)} />
          </div>
        )}

        {rows.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-3 text-base font-semibold">Progress</h2>
              <ProgressChart rows={rows} />
            </CardContent>
          </Card>
        )}

        <section>
          <h2 className="mb-3 text-xl font-semibold">Mock Test History</h2>
          {rows.length === 0 && !query.isLoading ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Hozircha mock testlarda qatnashmagansiz.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Session</th>
                      <th className="px-4 py-3 text-center">L</th>
                      <th className="px-4 py-3 text-center">R</th>
                      <th className="px-4 py-3 text-center">W</th>
                      <th className="px-4 py-3 text-center">S</th>
                      <th className="px-4 py-3 text-center">Overall</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(r.session_date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {r.session_name}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{fmt(r.listening_score)}</td>
                        <td className="px-4 py-3 text-center font-mono">{fmt(r.reading_score)}</td>
                        <td className="px-4 py-3 text-center font-mono">
                          {fmt(r.writing_score)}
                          {r.writing_status === 'pending' && (
                            <div className="text-[10px] text-amber-600">kutilmoqda</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {fmt(r.speaking_score)}
                          {r.speaking_status === 'pending' && (
                            <div className="text-[10px] text-amber-600">kutilmoqda</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.overall_band_score ? (
                            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs tabular-nums text-white">
                              {fmt(r.overall_band_score)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/student/mock/${r.id}`}>
                            <Button variant="outline" size="sm">
                              Batafsil <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        <section className="text-center">
          <p className="text-sm text-muted-foreground">
            Mock testlar markazingiz tomonidan jadvalga qo‘yiladi va sinxron
            tarzda o‘tkaziladi.
          </p>
        </section>
      </main>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p
          className={
            accent
              ? 'mt-1 text-3xl font-bold text-slate-900'
              : 'mt-1 text-2xl font-semibold text-slate-800'
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

type Series = {
  key: 'overall' | 'listening' | 'reading' | 'writing' | 'speaking'
  label: string
  color: string
  width: number
}

const SERIES: Series[] = [
  { key: 'overall', label: 'Overall', color: '#0f172a', width: 3 },
  { key: 'listening', label: 'Listening', color: '#16a34a', width: 2 },
  { key: 'reading', label: 'Reading', color: '#2563eb', width: 2 },
  { key: 'writing', label: 'Writing', color: '#ea580c', width: 2 },
  { key: 'speaking', label: 'Speaking', color: '#9333ea', width: 2 },
]

function ProgressChart({ rows }: { rows: MockResultRow[] }) {
  const ordered = useMemo(() => {
    const last10 = rows.slice(0, 10)
    return [...last10].reverse()
  }, [rows])

  if (ordered.length === 0) return null

  const W = 720
  const H = 220
  const PAD_X = 36
  const PAD_Y = 20

  const xFor = (i: number) =>
    ordered.length === 1
      ? W / 2
      : PAD_X + (i * (W - 2 * PAD_X)) / (ordered.length - 1)
  const yFor = (band: number) => {
    const max = 9
    const min = 0
    const t = (band - min) / (max - min)
    return H - PAD_Y - t * (H - 2 * PAD_Y)
  }

  const labels = ordered.map((r) => {
    const d = new Date(r.session_date)
    return d.toLocaleDateString('uz-UZ', { month: '2-digit', day: '2-digit' })
  })

  const buildPath = (key: Series['key']) => {
    let started = false
    let d = ''
    ordered.forEach((row, i) => {
      const raw =
        key === 'overall'
          ? row.overall_band_score
          : key === 'listening'
            ? row.listening_score
            : key === 'reading'
              ? row.reading_score
              : key === 'writing'
                ? row.writing_score
                : row.speaking_score
      const v = num(raw)
      if (v === null) return
      const cmd = started ? 'L' : 'M'
      d += `${cmd}${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)} `
      started = true
    })
    return d.trim()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-4 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="text-slate-600">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-56 w-full min-w-[480px]"
          preserveAspectRatio="none"
        >
          {[0, 3, 5, 7, 9].map((band) => (
            <g key={band}>
              <line
                x1={PAD_X}
                x2={W - PAD_X}
                y1={yFor(band)}
                y2={yFor(band)}
                stroke="#e2e8f0"
                strokeDasharray={band === 0 ? '0' : '3 3'}
                strokeWidth={1}
              />
              <text
                x={PAD_X - 6}
                y={yFor(band) + 3}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="end"
              >
                {band}
              </text>
            </g>
          ))}

          {SERIES.map((s) => {
            const path = buildPath(s.key)
            if (!path) return null
            return (
              <path
                key={s.key}
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )
          })}

          {ordered.map((row, i) => {
            const v = num(row.overall_band_score)
            if (v === null) return null
            return (
              <circle
                key={`pt-${row.id}`}
                cx={xFor(i)}
                cy={yFor(v)}
                r={3.5}
                fill="#0f172a"
              />
            )
          })}

          {labels.map((label, i) => (
            <text
              key={`lbl-${i}`}
              x={xFor(i)}
              y={H - 4}
              fontSize="10"
              fill="#64748b"
              textAnchor="middle"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}

void GraduationCap
