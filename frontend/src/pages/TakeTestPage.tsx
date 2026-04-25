import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Clock, Home, Loader2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

import { QuestionRenderer } from '@/components/questions'
import type { AnswerValue, QuestionData } from '@/components/questions/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Passage = {
  id: number
  part_number: number
  title: string
  content: string
  audio_file: string | null
  audio_duration_seconds: number | null
  min_words: number | null
  order: number
  questions: QuestionData[]
}

type Attempt = {
  id: string
  status: 'in_progress' | 'submitted' | 'graded' | 'expired'
  started_at: string
  submitted_at: string | null
  time_spent_seconds: number
  test: {
    id: string
    name: string
    module: 'listening' | 'reading' | 'writing' | 'speaking'
    duration_minutes: number
    passages: Passage[]
  }
  answers_saved: Record<string, AnswerValue>
  essay_text: string
  word_count: number | null
}

type ResultAnswer = {
  question: number
  user_answer: AnswerValue
  is_correct: boolean
  points_earned: string
  correct_answer: unknown
}

type Result = {
  id: string
  test_name: string
  module: 'listening' | 'reading' | 'writing' | 'speaking'
  status: string
  started_at: string
  submitted_at: string | null
  raw_score: number
  total_questions: number
  band_score: string
  test: Attempt['test']
  answers: ResultAnswer[]
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatCorrect(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

// ====== REVIEW MODE ======

function ReviewView({ result }: { result: Result }) {
  const [currentQId, setCurrentQId] = useState<number | null>(null)
  const answerMap = useMemo(() => {
    const m = new Map<number, ResultAnswer>()
    for (const a of result.answers) m.set(a.question, a)
    return m
  }, [result])
  const allQuestions = useMemo(
    () => result.test.passages.flatMap((p) => p.questions),
    [result.test.passages],
  )

  const scrollToQuestion = (qid: number) => {
    setCurrentQId(qid)
    const el = document.getElementById(`q-${qid}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="test-app flex h-screen flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-emerald-700 bg-emerald-900 px-6 text-white">
        <div className="flex items-center gap-4">
          <Link to={`/result/${result.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-emerald-800 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Natijaga qaytish
            </Button>
          </Link>
          <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-medium uppercase tracking-wider">
            Review rejimi
          </span>
          <span className="hidden text-sm text-emerald-100 md:inline">
            {result.test_name}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono tabular-nums">
            {result.raw_score}/{result.total_questions} · Band {result.band_score}
          </span>
        </div>
      </header>

      <main className="test-body flex min-h-0 flex-1 overflow-hidden">
        <section className="w-1/2 overflow-y-auto border-r bg-white p-6">
          {result.test.passages.map((p) => (
            <article key={p.id} className="mb-10">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Part {p.part_number}
              </h2>
              <h3 className="mb-4 text-xl font-bold text-slate-900">{p.title}</h3>
              {p.audio_file && result.test.module === 'listening' && (
                <audio controls src={p.audio_file} className="mb-4 w-full" />
              )}
              <div className="prose prose-slate max-w-none whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
                {p.content}
              </div>
            </article>
          ))}
        </section>

        <section className="w-1/2 overflow-y-auto bg-white p-6">
          {result.test.passages.map((p) => {
            let numberCursor = result.test.passages
              .filter((pp) => pp.order < p.order)
              .reduce((sum, pp) => sum + pp.questions.length, 0)
            return (
              <div key={p.id} className="mb-10">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Part {p.part_number} — savollar
                </h3>
                <div className="space-y-6">
                  {p.questions.map((q, i) => {
                    const number = numberCursor + i + 1
                    const a = answerMap.get(q.id)
                    const isCorrect = a?.is_correct ?? false
                    const userAnswer = a?.user_answer ?? null
                    const correctAnswer = formatCorrect(a?.correct_answer)
                    const hasAnswer = userAnswer != null && userAnswer !== ''
                    return (
                      <div
                        id={`q-${q.id}`}
                        key={q.id}
                        className={`rounded-md border p-4 ${
                          isCorrect
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : 'border-rose-200 bg-rose-50/50'
                        } ${currentQId === q.id ? 'ring-2 ring-amber-400' : ''}`}
                      >
                        <QuestionRenderer
                          question={q}
                          value={userAnswer}
                          onChange={() => {}}
                          number={number}
                          readOnly
                        />
                        <div
                          className={`mt-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                            isCorrect
                              ? 'border-emerald-300 bg-white text-emerald-800'
                              : 'border-rose-300 bg-white text-rose-800'
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0" />
                          )}
                          {/* Fill savollarda user javobi input'da ko'rinadi — takroran ko'rsatmaymiz */}
                          {q.question_type !== 'fill' && (
                            <span>
                              Sizning javob:{' '}
                              <strong>
                                {hasAnswer ? String(userAnswer) : '(javob yo‘q)'}
                              </strong>
                            </span>
                          )}
                          {q.question_type === 'fill' && !hasAnswer && (
                            <span>Javob berilmagan</span>
                          )}
                          {!isCorrect && (
                            <span className="ml-auto">
                              To‘g‘ri javob: <strong>{correctAnswer}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {(() => { numberCursor += p.questions.length; return null })()}
              </div>
            )
          })}
        </section>
      </main>

      <footer className="shrink-0 border-t bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {allQuestions.map((q, i) => {
            const a = answerMap.get(q.id)
            const isCorrect = a?.is_correct ?? false
            const isCurrent = currentQId === q.id
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => scrollToQuestion(q.id)}
                className={`q-dot flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'ring-2 ring-amber-400'
                    : ''
                } ${
                  isCorrect
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-rose-500 bg-rose-500 text-white'
                }`}
                aria-label={`Savol ${i + 1}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </footer>
    </div>
  )
}

// ====== LIVE ATTEMPT ======

function LiveAttemptView({ attempt }: { attempt: Attempt }) {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({})
  const [currentQId, setCurrentQId] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const dirtyRef = useRef(false)
  const initialisedRef = useRef(false)

  useEffect(() => {
    if (!initialisedRef.current) {
      const seed: Record<number, AnswerValue> = {}
      for (const [k, v] of Object.entries(attempt.answers_saved || {})) {
        seed[Number(k)] = v
      }
      setAnswers(seed)
      initialisedRef.current = true
    }
  }, [attempt])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const saveMutation = useMutation({
    mutationFn: async (payload: { question_id: number; answer: AnswerValue }[]) =>
      api.patch(`/attempts/${attempt.id}/answers/`, { answers: payload }),
  })

  const submitMutation = useMutation({
    mutationFn: async () => api.post(`/attempts/${attempt.id}/submit/`),
    onSuccess: () => navigate(`/result/${attempt.id}`, { replace: true }),
    onError: () => toast.error('Topshirishda xatolik'),
  })

  useEffect(() => {
    if (!dirtyRef.current) return
    const handle = setTimeout(() => {
      const payload = Object.entries(answers).map(([qid, ans]) => ({
        question_id: Number(qid),
        answer: ans,
      }))
      if (payload.length > 0) saveMutation.mutate(payload)
      dirtyRef.current = false
    }, 2000)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers])

  const startedAtMs = new Date(attempt.started_at).getTime()
  const totalSec = attempt.test.duration_minutes * 60
  const elapsedSec = Math.floor((now - startedAtMs) / 1000)
  const remainingSec = Math.max(0, totalSec - elapsedSec)
  const timeUp = remainingSec === 0

  useEffect(() => {
    if (timeUp && !submitMutation.isPending) {
      toast.info('Vaqt tugadi — avtomatik topshirilyapti…')
      submitMutation.mutate()
    }
  }, [timeUp, submitMutation])

  const allQuestions = useMemo(
    () => attempt.test.passages.flatMap((p) => p.questions),
    [attempt.test.passages],
  )

  const handleAnswer = (qid: number, value: AnswerValue) => {
    dirtyRef.current = true
    setAnswers((prev) => ({ ...prev, [qid]: value }))
    setCurrentQId(qid)
  }

  const scrollToQuestion = (qid: number) => {
    setCurrentQId(qid)
    const el = document.getElementById(`q-${qid}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const answeredCount = Object.values(answers).filter(
    (v) => v != null && v !== '',
  ).length

  const saveStatus = saveMutation.isPending
    ? 'Saqlanmoqda…'
    : dirtyRef.current
      ? 'O‘zgarishlar bor'
      : saveMutation.isSuccess
        ? 'Saqlandi'
        : ''

  return (
    <div className="test-app flex h-screen flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-6 text-white">
        <div className="flex items-center gap-3">
          <a href="/home" title="Bosh sahifa">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-white hover:bg-slate-800 hover:text-white"
            >
              <Home className="h-4 w-4" />
            </Button>
          </a>
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Test ID
          </span>
          <span className="font-mono text-xs text-slate-300">
            {attempt.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 md:inline">{saveStatus}</span>
          <div className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 font-mono text-sm tabular-nums">
            <Clock className="h-4 w-4" />
            <span className={remainingSec < 60 ? 'text-amber-300' : ''}>
              {formatTime(remainingSec)}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={submitMutation.isPending}
          >
            Submit
          </Button>
        </div>
      </header>

      <main className="test-body flex min-h-0 flex-1 overflow-hidden">
        <section className="w-1/2 overflow-y-auto border-r bg-white p-6">
          {attempt.test.passages.map((p) => (
            <article key={p.id} className="mb-10">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Part {p.part_number}
              </h2>
              <h3 className="mb-4 text-xl font-bold text-slate-900">{p.title}</h3>
              {p.audio_file && attempt.test.module === 'listening' && (
                <audio controls src={p.audio_file} className="mb-4 w-full" />
              )}
              <div className="prose prose-slate max-w-none whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
                {p.content}
              </div>
            </article>
          ))}
        </section>

        <section className="w-1/2 overflow-y-auto bg-white p-6">
          {attempt.test.passages.map((p) => {
            let numberCursor = attempt.test.passages
              .filter((pp) => pp.order < p.order)
              .reduce((sum, pp) => sum + pp.questions.length, 0)

            const groups: { instruction: string; questions: QuestionData[] }[] = []
            for (const q of p.questions) {
              const last = groups[groups.length - 1]
              if (last && last.questions[0].group_id === q.group_id) {
                last.questions.push(q)
              } else {
                groups.push({ instruction: q.instruction, questions: [q] })
              }
            }

            return (
              <div key={p.id} className="mb-10">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Part {p.part_number} — savollar
                </h3>
                {groups.map((group, gi) => {
                  const firstN = numberCursor + 1
                  const lastN = numberCursor + group.questions.length
                  const rangeLabel =
                    group.questions.length > 1
                      ? `Questions ${firstN}–${lastN}`
                      : `Question ${firstN}`
                  const node = (
                    <div key={gi} className="question-group mb-8">
                      <div className="mb-3 rounded-md bg-amber-50 px-4 py-2 text-sm text-slate-700">
                        <div className="font-semibold">{rangeLabel}</div>
                        {group.instruction && (
                          <div className="mt-0.5 text-slate-600">
                            {group.instruction}
                          </div>
                        )}
                      </div>
                      <div className="space-y-5">
                        {group.questions.map((q, i) => {
                          const number = numberCursor + i + 1
                          return (
                            <div
                              id={`q-${q.id}`}
                              key={q.id}
                              data-qid={q.id}
                              className={`rounded-md p-2 transition-colors ${
                                currentQId === q.id ? 'bg-amber-50' : ''
                              }`}
                              onFocus={() => setCurrentQId(q.id)}
                            >
                              <QuestionRenderer
                                question={q}
                                value={answers[q.id] ?? null}
                                onChange={(v) => handleAnswer(q.id, v)}
                                number={number}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                  numberCursor += group.questions.length
                  return node
                })}
              </div>
            )
          })}
        </section>
      </main>

      <footer className="shrink-0 border-t bg-white px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{answeredCount}</span>{' '}
            / {allQuestions.length} javob
          </div>
          <div className="flex max-w-full flex-1 flex-wrap gap-1.5 overflow-x-auto">
            {allQuestions.map((q, i) => {
              const answered =
                answers[q.id] != null && answers[q.id] !== ''
              const isCurrent = currentQId === q.id
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => scrollToQuestion(q.id)}
                  className={`q-dot flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                    isCurrent
                      ? 'border-amber-400 bg-amber-400 text-slate-900'
                      : answered
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  aria-label={`Savolga o'tish: ${i + 1}`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      </footer>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Testni topshirishga tayyormisiz?</DialogTitle>
            <DialogDescription>
              {answeredCount} / {allQuestions.length} savolga javob berdingiz.
              Topshirgandan keyin javoblarni o‘zgartirib bo‘lmaydi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                submitMutation.mutate()
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Yuborilmoqda…' : 'Topshirish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ====== WRAPPER ======

export default function TakeTestPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const [search] = useSearchParams()
  const isReview = search.get('review') === '1'

  const attemptQuery = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: async () => (await api.get<Attempt>(`/attempts/${attemptId}/`)).data,
    enabled: !!attemptId && !isReview,
    refetchOnMount: 'always',
  })

  const resultQuery = useQuery({
    queryKey: ['result-full', attemptId],
    queryFn: async () =>
      (await api.get<Result>(`/attempts/${attemptId}/result/`)).data,
    enabled: !!attemptId && isReview,
  })

  if (!attemptId) return <Navigate to="/" replace />

  if (isReview) {
    if (resultQuery.isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      )
    }
    if (resultQuery.isError || !resultQuery.data) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-destructive">Natijani yuklab bo‘lmadi.</p>
        </div>
      )
    }
    return <ReviewView result={resultQuery.data} />
  }

  if (attemptQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )
  }
  if (attemptQuery.isError || !attemptQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-destructive">Testni yuklab bo‘lmadi.</p>
      </div>
    )
  }
  if (attemptQuery.data.status !== 'in_progress') {
    return <Navigate to={`/result/${attemptId}`} replace />
  }
  if (attemptQuery.data.test.module === 'writing') {
    return <WriteAttemptView attempt={attemptQuery.data} />
  }
  return <LiveAttemptView attempt={attemptQuery.data} />
}

// ====== WRITING ATTEMPT ======

function WriteAttemptView({ attempt }: { attempt: Attempt }) {
  const navigate = useNavigate()
  const [essay, setEssay] = useState(attempt.essay_text || '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const dirtyRef = useRef(false)
  const initialisedRef = useRef(false)

  useEffect(() => {
    if (!initialisedRef.current) {
      setEssay(attempt.essay_text || '')
      initialisedRef.current = true
    }
  }, [attempt])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const saveMutation = useMutation({
    mutationFn: async (essay_text: string) =>
      api.patch(`/attempts/${attempt.id}/essay/`, { essay_text }),
  })

  const submitMutation = useMutation({
    mutationFn: async () =>
      api.post(`/attempts/${attempt.id}/submit-writing/`, { essay_text: essay }),
    onSuccess: () => navigate('/writing/sent', { replace: true }),
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Topshirishda xatolik')
    },
  })

  useEffect(() => {
    if (!dirtyRef.current) return
    const handle = setTimeout(() => {
      saveMutation.mutate(essay)
      dirtyRef.current = false
    }, 2000)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essay])

  const startedAtMs = new Date(attempt.started_at).getTime()
  const totalSec = attempt.test.duration_minutes * 60
  const elapsedSec = Math.floor((now - startedAtMs) / 1000)
  const remainingSec = Math.max(0, totalSec - elapsedSec)
  const timeUp = remainingSec === 0

  useEffect(() => {
    if (timeUp && !submitMutation.isPending) {
      toast.info('Vaqt tugadi — avtomatik topshirilyapti…')
      submitMutation.mutate()
    }
  }, [timeUp, submitMutation])

  const task = attempt.test.passages[0]
  const minWords = task?.min_words ?? 150
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0
  const reachedMin = wordCount >= minWords

  const saveStatus = saveMutation.isPending
    ? 'Saqlanmoqda…'
    : dirtyRef.current
      ? 'O‘zgarishlar bor'
      : saveMutation.isSuccess
        ? 'Saqlandi'
        : ''

  return (
    <div className="test-app flex h-screen flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-6 text-white">
        <div className="flex items-center gap-3">
          <a href="/home" title="Bosh sahifa">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-white hover:bg-slate-800 hover:text-white"
            >
              <Home className="h-4 w-4" />
            </Button>
          </a>
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Writing
          </span>
          <span className="font-mono text-xs text-slate-300">
            {attempt.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 md:inline">{saveStatus}</span>
          <div className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 font-mono text-sm tabular-nums">
            <Clock className="h-4 w-4" />
            <span className={remainingSec < 60 ? 'text-amber-300' : ''}>
              {formatTime(remainingSec)}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={submitMutation.isPending}
          >
            Submit
          </Button>
        </div>
      </header>

      <main className="test-body flex min-h-0 flex-1 overflow-hidden">
        <section className="w-1/2 overflow-y-auto border-r bg-white p-6">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Task {task?.part_number ?? 1}
          </h2>
          <h3 className="mb-4 text-xl font-bold text-slate-900">
            {task?.title ?? 'Writing task'}
          </h3>
          <div className="rounded-md bg-slate-100 p-4 text-center text-xs text-slate-500">
            [chart / image placeholder]
          </div>
          <div className="prose prose-slate mt-4 max-w-none whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
            {task?.content}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Kamida <strong>{minWords}</strong> ta so‘z yozing.
          </p>
        </section>

        <section className="flex w-1/2 flex-col bg-white">
          <div className="flex items-center justify-between border-b px-6 py-2 text-sm">
            <span className={reachedMin ? 'text-emerald-700' : 'text-slate-600'}>
              {wordCount} so‘z {reachedMin ? '✓' : `(${minWords - wordCount} kerak)`}
            </span>
            <span className="text-xs text-slate-500">Auto-save 2s</span>
          </div>
          <textarea
            value={essay}
            onChange={(e) => {
              dirtyRef.current = true
              setEssay(e.target.value)
            }}
            placeholder="Insheyingizni shu yerda yozing…"
            className="flex-1 resize-none border-0 p-6 text-[15px] leading-relaxed text-slate-900 focus:outline-none"
          />
        </section>
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insheyni topshirishga tayyormisiz?</DialogTitle>
            <DialogDescription>
              {wordCount} ta so‘z yozdingiz (minimum {minWords}).
              Topshirgandan keyin o‘zgartirib bo‘lmaydi. AI baholash keyingi bosqichda.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                submitMutation.mutate()
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Yuborilmoqda…' : 'Topshirish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
