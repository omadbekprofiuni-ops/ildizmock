import { CheckCircle2, FileText, Headphones, Loader2, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type PDFTestItem = {
  id: string
  name: string
  module: 'reading' | 'listening'
  difficulty: string
  total_questions: number
  duration_minutes: number
  is_completed: boolean
}

export default function PDFTestsList() {
  const [tests, setTests] = useState<PDFTestItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ tests: PDFTestItem[] }>('/pdf-tests/student/')
      .then((res) => {
        if (cancelled) return
        setTests(res.data.tests ?? [])
      })
      .catch(() => toast.error('Failed to load tests'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="mr-2 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          PDF tests
        </h1>
        <p className="mt-1.5 text-base text-slate-600">
          Cambridge-style tests prepared by your center.
        </p>
      </header>

      {tests.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-slate-200 px-6 py-16 text-center text-slate-500">
          No PDF tests available right now.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => {
            const tone = t.module === 'listening' ? 'cta' : 'brand'
            return (
              <article
                key={t.id}
                className="rounded-[20px] border border-slate-100 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-brand-100"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <span className={`icon-tile icon-tile--${tone}`} style={{ width: 28, height: 28, borderRadius: 8, marginBottom: 0 }}>
                    {t.module === 'listening' ? (
                      <Headphones size={14} />
                    ) : (
                      <FileText size={14} />
                    )}
                  </span>
                  {t.module}
                  <span className="text-slate-300">•</span>
                  {t.difficulty}
                </div>
                <h3 className="mb-2 text-lg font-extrabold text-slate-900">{t.name}</h3>
                <div className="mb-5 text-sm text-slate-600">
                  {t.total_questions} questions · {t.duration_minutes} min
                </div>
                {t.is_completed ? (
                  <div
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold"
                    style={{ background: 'var(--accent-50)', color: 'var(--accent-700)' }}
                  >
                    <CheckCircle2 size={16} /> Completed
                  </div>
                ) : (
                  <Link
                    to={`/pdf-test/${t.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-cta-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(239,68,68,0.25)]"
                  >
                    <Play size={16} /> Start test
                  </Link>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
