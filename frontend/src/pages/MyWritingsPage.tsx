import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

import { api } from '@/lib/api'

type MyWriting = {
  id: number
  attempt: string
  test_name: string
  essay_text: string
  word_count: number
  status: 'pending' | 'graded'
  teacher_band: string | null
  teacher_feedback: string
  submitted_at: string
  graded_at: string | null
  teacher_name: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('uz-UZ', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MyWritingsPage() {
  const q = useQuery({
    queryKey: ['my-writings'],
    queryFn: async () => (await api.get<MyWriting[]>('/me/writings/')).data,
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
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">My Writings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10">
        {q.isLoading && <p className="text-slate-500">Loading…</p>}

        {q.data && q.data.length === 0 && (
          <div className="rounded-[20px] border-2 border-dashed border-slate-200 px-6 py-16 text-center text-slate-500">
            You haven't submitted any essays yet.
          </div>
        )}

        {q.data && q.data.length > 0 && (
          <div className="space-y-4">
            {q.data.map((w) => (
              <article
                key={w.id}
                className="rounded-[20px] border border-slate-100 bg-white p-7"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold text-slate-900">{w.test_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Submitted: {formatDate(w.submitted_at)} · {w.word_count} words
                    </p>
                  </div>
                  {w.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#B45309]">
                      <Clock className="h-3 w-3" /> Pending review
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: 'var(--accent-50)', color: 'var(--accent-700)' }}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Graded · Band {w.teacher_band}
                    </span>
                  )}
                </div>

                {w.status === 'graded' && (
                  <div className="space-y-3">
                    {w.teacher_feedback && (
                      <div
                        className="rounded-2xl border-l-4 p-5"
                        style={{
                          borderColor: 'var(--accent-500)',
                          background: 'var(--accent-50)',
                        }}
                      >
                        <p
                          className="mb-1.5 text-[11px] font-bold uppercase tracking-wide"
                          style={{ color: 'var(--accent-700)' }}
                        >
                          Teacher feedback {w.teacher_name && `(${w.teacher_name})`}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                          {w.teacher_feedback}
                        </p>
                      </div>
                    )}
                    <details className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <summary className="cursor-pointer text-sm font-bold text-slate-700 hover:text-brand-600">
                        Your essay
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {w.essay_text}
                      </p>
                    </details>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
