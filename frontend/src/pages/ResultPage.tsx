import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, History, UserPlus } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

type ResultResponse = {
  id: string
  test_name: string
  module: 'listening' | 'reading' | 'writing' | 'speaking'
  status: string
  submitted_at: string | null
  raw_score: number | null
  total_questions: number | null
  band_score: string | null
  essay_text: string
  word_count: number | null
  answers: { question: number; user_answer: unknown; is_correct: boolean }[]
}

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const user = useAuth((s) => s.user)

  const query = useQuery({
    queryKey: ['result', attemptId],
    queryFn: async () =>
      (await api.get<ResultResponse>(`/attempts/${attemptId}/result/`)).data,
    enabled: !!attemptId,
  })

  if (!attemptId) return <Navigate to="/" replace />

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-muted-foreground">Result yuklanmoqda…</p>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-destructive">could not load result.</p>
      </div>
    )
  }

  const r = query.data
  const isWriting = r.module === 'writing' || r.module === 'speaking'
  const correct = r.raw_score ?? 0
  const total = r.total_questions ?? 0
  const wrong = total - correct
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0

  if (isWriting) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b bg-white">
          <div className="container flex h-16 items-center gap-3">
            <Link to="/home">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Home
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Your essay was submitted</h1>
          </div>
        </header>
        <main className="container max-w-3xl space-y-6 py-10">
          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <History className="h-6 w-6 text-amber-700" />
              </div>
              <h2 className="text-2xl font-bold">AI feedback pending</h2>
              <p className="text-muted-foreground">
                Inshangiz qabul qilindi. Automatic scoring{' '}
                <strong>Phase 2</strong> will add (via the Claude API
                band score and full analysis). For now, a simple word count:
              </p>
              <div className="mx-auto inline-flex gap-6 rounded-md border bg-slate-50 px-6 py-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Words</div>
                  <div className="text-lg font-semibold">{r.word_count ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Test</div>
                  <div className="text-lg font-semibold">{r.test_name}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          {r.essay_text && (
            <Card>
              <CardContent className="p-6">
                <CardTitle className="mb-3 text-base">Sizning inshengiz</CardTitle>
                <div className="whitespace-pre-wrap rounded-md border bg-slate-50 p-4 text-sm text-slate-800">
                  {r.essay_text}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex gap-3">
            <Link to={`/tests/${r.module}`}>
              <Button variant="outline">Other tests</Button>
            </Link>
            <Link to="/history">
              <Button variant="ghost">
                <History className="mr-2 h-4 w-4" /> History
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const unanswered = r.answers.filter(
    (a) => !a.is_correct && a.user_answer == null,
  ).length

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/home">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Home
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">{r.test_name}</h1>
        </div>
      </header>

      <main className="container max-w-3xl space-y-6 py-12">
        {!user && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            <div className="flex items-start gap-3">
              <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  sign up to save results and see your history →
                </p>
                <p className="mt-1 text-amber-800">
                  Right now this result is not linked to your account.
                </p>
              </div>
              <Link to="/register">
                <Button size="sm" className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        )}
        <div className="text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Band Score
          </p>
          <p className="text-7xl font-bold tabular-nums leading-none">
            {r.band_score}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {r.module === 'reading' ? 'Reading' : 'Listening'} module
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Correct" value={correct} tone="success" />
          <StatBox label="Wrong" value={wrong - unanswered} tone="error" />
          <StatBox label="Unanswered" value={unanswered} tone="muted" />
          <StatBox label="Accuracy" value={`${percentage}%`} tone="text" />
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <Link to={`/take/${r.id}?review=1`}>
            <Button className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
              Review
            </Button>
          </Link>
          <Link to={`/tests/${r.module}`}>
            <Button variant="outline">Other tests</Button>
          </Link>
          <Link to="/home">
            <Button variant="ghost">
              <History className="mr-2 h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}

type StatTone = 'success' | 'error' | 'muted' | 'text'

function StatBox({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone: StatTone
}) {
  const color =
    tone === 'success'
      ? 'text-[var(--success)]'
      : tone === 'error'
        ? 'text-[var(--error)]'
        : tone === 'muted'
          ? 'text-[var(--muted)]'
          : 'text-[var(--text)]'
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
    </div>
  )
}
