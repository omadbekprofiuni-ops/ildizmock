import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function MyWritingsPage() {
  const q = useQuery({
    queryKey: ['my-writings'],
    queryFn: async () => (await api.get<MyWriting[]>('/me/writings/')).data,
  })

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/home">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Home
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Mening yozma ishlarim</h1>
        </div>
      </header>

      <main className="container py-10">
        {q.isLoading && <p className="text-[var(--muted)]">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-[var(--muted)]">
              You haven't submitted any essays yet.
            </CardContent>
          </Card>
        )}
        {q.data && q.data.length > 0 && (
          <div className="space-y-4">
            {q.data.map((w) => (
              <Card key={w.id}>
                <CardContent className="p-6">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{w.test_name}</h3>
                      <p className="text-sm text-[var(--muted)]">
                        Yuborilgan: {formatDate(w.submitted_at)} · {w.word_count} so‘z
                      </p>
                    </div>
                    {w.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                        <Clock className="h-3 w-3" /> Pending review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> Graded ·{' '}
                        Band {w.teacher_band}
                      </span>
                    )}
                  </div>
                  {w.status === 'graded' && (
                    <div className="space-y-3">
                      {w.teacher_feedback && (
                        <div className="rounded-md border bg-slate-50 p-4">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Teacher izohi {w.teacher_name && `(${w.teacher_name})`}
                          </p>
                          <p className="whitespace-pre-wrap text-sm text-slate-800">
                            {w.teacher_feedback}
                          </p>
                        </div>
                      )}
                      <details className="rounded-md border bg-white p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          Yozgan inshangiz
                        </summary>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
                          {w.essay_text}
                        </p>
                      </details>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
