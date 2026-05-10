import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function MockResultsPage() {
  useEffect(() => {
    document.title = 'ILDIZmock — My Mock Tests'
  }, [])

  const query = useQuery({
    queryKey: ['my-mock-results'],
    queryFn: async () =>
      (await api.get<MockResultsResponse>('/student/mock/results/')).data,
  })

  const rows = query.data?.results ?? []
  const stats = query.data?.stats

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              My Mock Tests
            </h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-8 py-10">
        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && <p className="text-cta-600">Failed to load mock results.</p>}

        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatCard label="Latest Overall" value={fmt(stats.latest_overall)} highlight />
            <StatCard label="Avg L" value={fmt(stats.avg_listening)} tone="cta" />
            <StatCard label="Avg R" value={fmt(stats.avg_reading)} tone="brand" />
            <StatCard label="Avg W" value={fmt(stats.avg_writing)} tone="accent" />
            <StatCard label="Avg S" value={fmt(stats.avg_speaking)} tone="slate" />
          </div>
        )}

        {rows.length > 0 && (
          <div
            className="rounded-[20px] border border-slate-100 bg-white p-7"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <h2 className="mb-4 text-base font-extrabold text-slate-900">Progress</h2>
            <ProgressChart rows={rows} />
          </div>
        )}

        <section>
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">Mock Test History</h2>
          {rows.length === 0 && !query.isLoading ? (
            <div className="rounded-[20px] border-2 border-dashed border-slate-200 px-6 py-16 text-center text-slate-500">
              You haven't joined any mock tests yet.
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-[20px] border border-slate-100 bg-white"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Session</th>
                      <th className="px-6 py-3.5 text-center">L</th>
                      <th className="px-6 py-3.5 text-center">R</th>
                      <th className="px-6 py-3.5 text-center">W</th>
                      <th className="px-6 py-3.5 text-center">S</th>
                      <th className="px-6 py-3.5 text-center">Overall</th>
                      <th className="px-6 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-3.5 text-slate-600">
                          {formatDate(r.session_date)}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-slate-900">
                          {r.session_name}
                        </td>
                        <td
                          className="px-6 py-3.5 text-center font-bold tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {fmt(r.listening_score)}
                        </td>
                        <td
                          className="px-6 py-3.5 text-center font-bold tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {fmt(r.reading_score)}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span
                            className="font-bold tabular-nums"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {fmt(r.writing_score)}
                          </span>
                          {r.writing_status === 'pending' && (
                            <div className="text-[10px] font-semibold text-amber-600">
                              pending
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span
                            className="font-bold tabular-nums"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {fmt(r.speaking_score)}
                          </span>
                          {r.speaking_status === 'pending' && (
                            <div className="text-[10px] font-semibold text-amber-600">
                              pending
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {r.overall_band_score ? (
                            <span
                              className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold tabular-nums text-white"
                              style={{ background: 'var(--gradient-brand)' }}
                            >
                              {fmt(r.overall_band_score)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Link
                            to={`/student/mock/${r.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                          >
                            Details <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="text-center">
          <p className="text-sm text-slate-500">
            Mock tests are scheduled by your center and run synchronously.
          </p>
        </section>
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
  tone = 'slate',
}: {
  label: string
  value: string
  highlight?: boolean
  tone?: 'brand' | 'accent' | 'cta' | 'slate'
}) {
  const colorMap: Record<string, string> = {
    brand: 'var(--brand-700)',
    accent: 'var(--accent-700)',
    cta: 'var(--cta-700)',
    slate: 'var(--slate-900)',
  }
  return (
    <div
      className="rounded-[18px] border border-slate-100 bg-white p-5 text-center"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1.5 font-extrabold tracking-tight ${
          highlight ? 'text-3xl' : 'text-2xl'
        }`}
        style={{
          color: highlight ? 'var(--slate-900)' : colorMap[tone],
          fontFamily: highlight ? undefined : 'var(--font-mono)',
        }}
      >
        {value}
      </p>
    </div>
  )
}

type Series = {
  key: 'overall' | 'listening' | 'reading' | 'writing' | 'speaking'
  label: string
  color: string
  width: number
}

const SERIES: Series[] = [
  { key: 'overall', label: 'Overall', color: '#0F172A', width: 3 },
  { key: 'reading', label: 'Reading', color: '#2563EB', width: 2 },
  { key: 'listening', label: 'Listening', color: '#EF4444', width: 2 },
  { key: 'writing', label: 'Writing', color: '#14B8A6', width: 2 },
  { key: 'speaking', label: 'Speaking', color: '#94A3B8', width: 2 },
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
            <span className="font-semibold text-slate-600">{s.label}</span>
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
                stroke="#E2E8F0"
                strokeDasharray={band === 0 ? '0' : '3 3'}
                strokeWidth={1}
              />
              <text
                x={PAD_X - 6}
                y={yFor(band) + 3}
                fontSize="10"
                fill="#94A3B8"
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
                fill="#0F172A"
              />
            )
          })}

          {labels.map((label, i) => (
            <text
              key={`lbl-${i}`}
              x={xFor(i)}
              y={H - 4}
              fontSize="10"
              fill="#64748B"
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
