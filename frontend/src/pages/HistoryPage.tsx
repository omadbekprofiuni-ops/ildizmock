import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { api } from '@/lib/api'

type AttemptHistoryItem = {
  id: string
  test: string
  test_name: string
  module: 'listening' | 'reading' | 'writing' | 'speaking'
  status: 'in_progress' | 'submitted' | 'graded' | 'expired'
  started_at: string
  submitted_at: string | null
  raw_score: number | null
  total_questions: number | null
  band_score: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const MODULE_TITLES = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
} as const

const MODULE_TONES: Record<keyof typeof MODULE_TITLES, 'brand' | 'accent' | 'cta' | 'slate'> = {
  reading: 'brand',
  listening: 'cta',
  writing: 'accent',
  speaking: 'slate',
}

export default function HistoryPage() {
  const query = useQuery({
    queryKey: ['attempts'],
    queryFn: async () => (await api.get<AttemptHistoryItem[]>('/attempts/')).data,
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-8">
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
            Submission History
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-10">
        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && <p className="text-cta-600">Failed to load history.</p>}

        {query.data && query.data.length === 0 && (
          <div
            className="rounded-[20px] border-2 border-dashed border-slate-200 px-6 py-16 text-center text-slate-500"
          >
            You haven't submitted any tests yet.
          </div>
        )}

        {query.data && query.data.length > 0 && (
          <div
            className="overflow-hidden rounded-[20px] border border-slate-100 bg-white"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Test</th>
                  <th className="px-6 py-3.5">Module</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Result</th>
                  <th className="px-6 py-3.5">Band</th>
                  <th className="px-6 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data.map((a) => {
                  const graded = a.status === 'graded'
                  const date = a.submitted_at || a.started_at
                  const tone = MODULE_TONES[a.module]
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900">{a.test_name}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            tone === 'brand'
                              ? 'bg-brand-50 text-brand-700'
                              : tone === 'accent'
                                ? 'bg-teal-50 text-teal-700'
                                : tone === 'cta'
                                  ? 'bg-cta-50 text-cta-700'
                                  : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {MODULE_TITLES[a.module]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{formatDate(date)}</td>
                      <td className="px-6 py-4 text-slate-700">
                        {graded
                          ? `${a.raw_score}/${a.total_questions}`
                          : a.status === 'in_progress'
                            ? <span className="text-cta-600 font-semibold">In progress</span>
                            : a.status}
                      </td>
                      <td className="px-6 py-4">
                        {graded ? (
                          <span
                            className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold tabular-nums text-white"
                            style={{ background: 'var(--gradient-brand)' }}
                          >
                            {a.band_score}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {graded ? (
                          <Link
                            to={`/result/${a.id}`}
                            className="inline-flex items-center justify-center rounded-lg border-2 border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                          >
                            View
                          </Link>
                        ) : a.status === 'in_progress' ? (
                          <Link
                            to={`/take/${a.id}`}
                            className="inline-flex items-center justify-center rounded-lg bg-cta-500 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-cta-600"
                          >
                            Continue
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
