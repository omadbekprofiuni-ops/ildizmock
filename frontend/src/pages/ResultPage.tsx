import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, History } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

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
        <p className="text-muted-foreground">Natija yuklanmoqda…</p>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-destructive">Natijani yuklab bo‘lmadi.</p>
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
                <ArrowLeft className="mr-2 h-4 w-4" /> Bosh sahifa
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Inshang topshirildi</h1>
          </div>
        </header>
        <main className="container max-w-3xl space-y-6 py-10">
          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <History className="h-6 w-6 text-amber-700" />
              </div>
              <h2 className="text-2xl font-bold">AI feedback kutilmoqda</h2>
              <p className="text-muted-foreground">
                Inshangiz qabul qilindi. Avtomatik baholash{' '}
                <strong>Phase 2</strong>’da qo‘shiladi (Claude API orqali
                band score va to‘liq tahlil). Hozircha oddiy so‘z hisobi:
              </p>
              <div className="mx-auto inline-flex gap-6 rounded-md border bg-slate-50 px-6 py-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">So‘z</div>
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
              <Button variant="outline">Boshqa testlar</Button>
            </Link>
            <Link to="/history">
              <Button variant="ghost">
                <History className="mr-2 h-4 w-4" /> Tarix
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
              <ArrowLeft className="mr-2 h-4 w-4" /> Bosh sahifa
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">{r.test_name}</h1>
        </div>
      </header>

      <main className="container max-w-3xl space-y-6 py-12">
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
          <StatBox label="To‘g‘ri" value={correct} tone="success" />
          <StatBox label="Xato" value={wrong - unanswered} tone="error" />
          <StatBox label="Javob yo‘q" value={unanswered} tone="muted" />
          <StatBox label="Aniqlik" value={`${percentage}%`} tone="text" />
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <Link to={`/take/${r.id}?review=1`}>
            <Button className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
              Review
            </Button>
          </Link>
          <Link to={`/tests/${r.module}`}>
            <Button variant="outline">Boshqa testlar</Button>
          </Link>
          <Link to="/home">
            <Button variant="ghost">
              <History className="mr-2 h-4 w-4" /> Bosh sahifa
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
