import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  listening: 'bg-emerald-100 text-emerald-800',
  reading: 'bg-blue-100 text-blue-800',
  writing: 'bg-orange-100 text-orange-800',
  speaking: 'bg-purple-100 text-purple-800',
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
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PracticeHistoryPage() {
  useEffect(() => { document.title = 'ILDIZmock — Practice History' }, [])

  const query = useQuery({
    queryKey: ['practice-history'],
    queryFn: async () =>
      (await api.get<PracticeHistoryResponse>('/me/practice/history/')).data,
  })

  const rows = query.data?.results ?? []
  const stats = query.data?.stats

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/practice">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Practice
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Practice History</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container space-y-8 py-10">
        {query.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {query.isError && (
          <p className="text-destructive">Couldn't load history.</p>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <SummaryCard title="Total attempts" value={stats.total} />
            <SummaryCard
              title="Listening"
              value={stats.by_module.listening.completed}
              hint={
                stats.by_module.listening.avg_band !== null
                  ? `O‘rtacha: ${stats.by_module.listening.avg_band.toFixed(1)}`
                  : undefined
              }
              accent="text-emerald-600"
            />
            <SummaryCard
              title="Reading"
              value={stats.by_module.reading.completed}
              hint={
                stats.by_module.reading.avg_band !== null
                  ? `O‘rtacha: ${stats.by_module.reading.avg_band.toFixed(1)}`
                  : undefined
              }
              accent="text-blue-600"
            />
            <SummaryCard
              title="Writing"
              value={stats.by_module.writing.completed}
              accent="text-orange-600"
            />
          </div>
        )}

        <section>
          <h2 className="mb-3 text-xl font-semibold">Urinishlar</h2>

          {rows.length === 0 && !query.isLoading ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                You haven't practiced yet.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Module</th>
                      <th className="px-4 py-3">Test</th>
                      <th className="px-4 py-3 text-center">Result</th>
                      <th className="px-4 py-3 text-center">Band</th>
                      <th className="px-4 py-3 text-center">Vaqt</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          {fmtDate(a.submitted_at || a.started_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold capitalize ${
                              MODULE_CHIP[a.module] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {a.module}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {a.test_name}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.status === 'graded' && a.total_questions
                            ? `${a.raw_score}/${a.total_questions}`
                            : a.status === 'submitted'
                              ? 'Yuborilgan'
                              : a.status}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.band_score ? (
                            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs tabular-nums text-white">
                              {fmtBand(a.band_score)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500">
                          {fmtMinutes(a.time_spent_seconds)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.status === 'in_progress' ? (
                            <Link to={`/take/${a.id}`}>
                              <Button size="sm">Continue</Button>
                            </Link>
                          ) : (
                            <Link to={`/result/${a.id}`}>
                              <Button variant="outline" size="sm">
                                Ko‘rish
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </main>
    </div>
  )
}

function SummaryCard({
  title, value, hint, accent,
}: {
  title: string; value: number; hint?: string; accent?: string
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-xs uppercase tracking-wider text-slate-500">{title}</p>
        <p className={`mt-1 text-3xl font-bold ${accent ?? 'text-slate-900'}`}>
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}
