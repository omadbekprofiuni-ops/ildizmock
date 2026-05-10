import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { api } from '@/lib/api'

type Module = 'listening' | 'reading' | 'writing' | 'speaking'

type PracticeAttempt = {
  id: string
  test_id: string
  test_name: string
  module: Module
  difficulty: string
  status: string
  started_at: string
  submitted_at: string | null
  raw_score: number | null
  total_questions: number | null
  band_score: string | null
  time_spent_seconds: number
}

type PracticeHistoryResponse = {
  results: PracticeAttempt[]
  stats: {
    total: number
    completed: number
    by_module: Record<
      'listening' | 'reading' | 'writing',
      {
        attempts: number
        completed: number
        best_band: number | null
        avg_band: number | null
      }
    >
  }
}

const MODULE_CHIP: Record<Module, string> = {
  reading: 'bg-brand-50 text-brand-700',
  listening: 'bg-cta-50 text-cta-700',
  writing: 'bg-teal-50 text-teal-700',
  speaking: 'bg-slate-100 text-slate-700',
}

function fmtBand(value: string | null): string {
  if (!value) return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(1) : '—'
}

function fmtMinutes(seconds: number): string {
  if (!seconds || seconds < 60) return `${seconds || 0} s`
  return `${Math.round(seconds / 60)} min`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PracticeHistoryPage() {
  useEffect(() => {
    document.title = 'ILDIZmock — Practice History'
  }, [])

  const query = useQuery({
    queryKey: ['practice-history'],
    queryFn: async () =>
      (await api.get<PracticeHistoryResponse>('/me/practice/history/')).data,
  })

  const rows = query.data?.results ?? []
  const stats = query.data?.stats

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/practice"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Practice
            </Link>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              Practice History
            </h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-8 py-10">
        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && <p className="text-cta-600">Couldn't load history.</p>}

        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <SummaryCard title="Total attempts" value={stats.total} tone="slate" />
            <SummaryCard
              title="Reading"
              value={stats.by_module.reading.completed}
              hint={
                stats.by_module.reading.avg_band !== null
                  ? `Avg: ${stats.by_module.reading.avg_band.toFixed(1)}`
                  : undefined
              }
              tone="brand"
            />
            <SummaryCard
              title="Listening"
              value={stats.by_module.listening.completed}
              hint={
                stats.by_module.listening.avg_band !== null
                  ? `Avg: ${stats.by_module.listening.avg_band.toFixed(1)}`
                  : undefined
              }
              tone="cta"
            />
            <SummaryCard
              title="Writing"
              value={stats.by_module.writing.completed}
              hint={
                stats.by_module.writing.avg_band !== null
                  ? `Avg: ${stats.by_module.writing.avg_band.toFixed(1)}`
                  : undefined
              }
              tone="accent"
            />
          </div>
        )}

        <section>
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">Attempts</h2>
          {rows.length === 0 && !query.isLoading ? (
            <div className="rounded-[20px] border-2 border-dashed border-slate-200 px-6 py-16 text-center text-slate-500">
              You haven't practiced yet.
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
                      <th className="px-6 py-3.5">Module</th>
                      <th className="px-6 py-3.5">Test</th>
                      <th className="px-6 py-3.5 text-center">Result</th>
                      <th className="px-6 py-3.5 text-center">Band</th>
                      <th className="px-6 py-3.5 text-center">Time</th>
                      <th className="px-6 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((a) => (
                      <tr
                        key={a.id}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-6 py-3.5 text-slate-600">
                          {fmtDate(a.submitted_at || a.started_at)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${
                              MODULE_CHIP[a.module] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {a.module}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-bold text-slate-900">
                          {a.test_name}
                        </td>
                        <td className="px-6 py-3.5 text-center text-slate-700">
                          {a.status === 'graded' && a.total_questions
                            ? `${a.raw_score}/${a.total_questions}`
                            : a.status === 'submitted'
                              ? 'Submitted'
                              : a.status}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {a.band_score ? (
                            <span
                              className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold tabular-nums text-white"
                              style={{ background: 'var(--gradient-brand)' }}
                            >
                              {fmtBand(a.band_score)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-center text-xs text-slate-500">
                          {fmtMinutes(a.time_spent_seconds)}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {a.status === 'in_progress' ? (
                            <Link
                              to={`/take/${a.id}`}
                              className="inline-flex items-center justify-center rounded-lg bg-cta-500 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-cta-600"
                            >
                              Continue
                            </Link>
                          ) : (
                            <Link
                              to={`/result/${a.id}`}
                              className="inline-flex items-center justify-center rounded-lg border-2 border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  hint,
  tone = 'slate',
}: {
  title: string
  value: number
  hint?: string
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
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p
        className="mt-1.5 text-3xl font-extrabold tracking-tight"
        style={{ color: colorMap[tone] }}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p>}
    </div>
  )
}
