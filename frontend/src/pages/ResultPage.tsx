import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, History, RotateCcw, UserPlus, X } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

type AnswerRow = {
  question: number
  question_order: number
  question_number: number
  question_text: string
  question_prompt: string
  question_type: string
  user_answer: unknown
  is_correct: boolean
  correct_answer: unknown
}

type ResultTest = {
  id: string
  name: string
  is_practice_enabled?: boolean
  practice_time_limit?: number | null
}

type ResultResponse = {
  id: string
  test: ResultTest | null
  test_name: string
  module: 'listening' | 'reading' | 'writing' | 'speaking'
  status: string
  submitted_at: string | null
  raw_score: number | null
  total_questions: number | null
  band_score: string | null
  essay_text: string
  word_count: number | null
  answers: AnswerRow[]
}

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)

  const query = useQuery({
    queryKey: ['result', attemptId],
    queryFn: async () =>
      (await api.get<ResultResponse>(`/attempts/${attemptId}/result/`)).data,
    enabled: !!attemptId,
  })

  const retry = useMutation({
    mutationFn: async () => {
      const testId = query.data?.test?.id
      if (!testId) throw new Error('test id missing')
      const res = await api.post<{ id: string }>(`/tests/${testId}/attempts`)
      return res.data.id
    },
    onSuccess: (newId) => navigate(`/take/${newId}`),
    onError: () => toast.error('Qayta urinishni boshlab bo‘lmadi'),
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

  const isPractice = r.test?.is_practice_enabled === true
  const sortedAnswers = [...r.answers].sort(
    (a, b) =>
      (a.question_number || a.question_order || 0) -
      (b.question_number || b.question_order || 0),
  )

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
                  Sign in to save results and see your history →
                </p>
                <p className="mt-1 text-amber-800">
                  Right now this result is not linked to your account.
                </p>
              </div>
              <Link to="/login">
                <Button size="sm" className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
                  Kirish
                </Button>
              </Link>
            </div>
          </div>
        )}

        {isPractice && (
          <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Practice mode</p>
            <p className="mt-0.5">
              Quyida har savol uchun darhol javoblar ko‘rsatildi. Cheklov
              yo‘q — istagancha qayta urinib ko‘rishingiz mumkin.
            </p>
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

        {sortedAnswers.length > 0 && (
          <Card>
            <CardContent className="space-y-3 p-6">
              <CardTitle className="mb-1 text-base">Savollar bo‘yicha tahlil</CardTitle>
              <ol className="space-y-3">
                {sortedAnswers.map((a) => (
                  <li
                    key={a.question}
                    className={`flex gap-3 rounded-md border-l-4 p-3 ${
                      a.is_correct
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-rose-500 bg-rose-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                        a.is_correct ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    >
                      {a.is_correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {a.question_number || a.question_order}
                        {'. '}
                        {a.question_prompt || a.question_text || `Question ${a.question}`}
                      </p>
                      <div className="mt-1 space-y-0.5 text-sm">
                        <p>
                          <span className="text-slate-500">Sizning javobingiz: </span>
                          <span
                            className={
                              a.is_correct
                                ? 'font-semibold text-emerald-700'
                                : 'text-rose-700'
                            }
                          >
                            {formatAnswer(a.user_answer)}
                          </span>
                        </p>
                        {!a.is_correct && (
                          <p>
                            <span className="text-slate-500">To‘g‘ri javob: </span>
                            <span className="font-semibold text-emerald-700">
                              {formatAnswer(a.correct_answer)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-4">
          {user && r.test?.id && (
            <Button
              onClick={() => retry.mutate()}
              disabled={retry.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {retry.isPending ? 'Yaratilmoqda…' : 'Qayta urinish'}
            </Button>
          )}
          <Link to={`/take/${r.id}?review=1`}>
            <Button variant="outline">Review</Button>
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

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return '(javob berilmagan)'
  if (typeof value === 'string') return value || '(javob berilmagan)'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatAnswer).join(', ')
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
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
