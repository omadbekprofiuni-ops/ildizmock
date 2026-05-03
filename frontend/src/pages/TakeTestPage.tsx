import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Clock, Home, Loader2, Maximize2, Minimize2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

import { LockedAudio } from '@/components/LockedAudio'
import { QuestionRenderer } from '@/components/questions'
import type { AnswerValue, QuestionData } from '@/components/questions/types'
import { TestStartDialog } from '@/components/TestStartDialog'
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
import { guestAttempts } from '@/lib/guest-attempts'
import { ieltsRules } from '@/lib/ielts-rules'

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

type ListeningPart = {
  id: number
  part_number: number
  audio_url: string | null
  image_url: string | null
  audio_duration_seconds: number | null
  instructions: string
  questions: QuestionData[]
}

type WritingTaskFromApi = {
  id: number
  task_number: number
  prompt: string
  chart_image_url: string | null
  min_words: number
  suggested_minutes: number
  requirements: string
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
    listening_parts?: ListeningPart[]
    writing_tasks?: WritingTaskFromApi[]
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
  // Wizard listening testlar — listening_parts'dan passage-shaped sektsiyalar.
  const sections = useMemo<Passage[]>(() => {
    if (
      result.test.module === 'listening' &&
      result.test.listening_parts &&
      result.test.listening_parts.length > 0
    ) {
      return result.test.listening_parts
        .slice()
        .sort((a, b) => a.part_number - b.part_number)
        .map((lp) => ({
          id: lp.id,
          part_number: lp.part_number,
          title: `Part ${lp.part_number}`,
          content: lp.instructions ?? '',
          audio_file: lp.audio_url,
          audio_duration_seconds: lp.audio_duration_seconds,
          min_words: null,
          order: lp.part_number,
          questions: lp.questions,
        }))
    }
    return result.test.passages
  }, [result.test.module, result.test.listening_parts, result.test.passages])

  const allQuestions = useMemo(
    () => sections.flatMap((p) => p.questions),
    [sections],
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
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Result
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
          {sections.map((p) => (
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
          {sections.map((p) => {
            let numberCursor = sections
              .filter((pp) => pp.order < p.order)
              .reduce((sum, pp) => sum + pp.questions.length, 0)
            return (
              <div key={p.id} className="mb-10">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Part {p.part_number} — questions
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
                          {/* Fill questions show user answer in input — we don't display again */}
                          {q.question_type !== 'fill' && (
                            <span>
                              Sizning javob:{' '}
                              <strong>
                                {hasAnswer ? String(userAnswer) : '(no answer)'}
                              </strong>
                            </span>
                          )}
                          {q.question_type === 'fill' && !hasAnswer && (
                            <span>Javob berilmagan</span>
                          )}
                          {!isCorrect && (
                            <span className="ml-auto">
                              Correct answer: <strong>{correctAnswer}</strong>
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
                aria-label={`Question ${i + 1}`}
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
  const [isFullscreen, setIsFullscreen] = useState(() => ieltsRules.isFullscreen())
  const userExitedFsRef = useRef(false)
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
    onSuccess: () => {
      try { guestAttempts.update(attempt.id, { status: 'graded' }) } catch { /* not a guest record */ }
      navigate(`/result/${attempt.id}`, { replace: true })
    },
    onError: () => toast.error('Submitda xatolik'),
  })

  // ===== IELTS rules enforcement =====
  useEffect(() => {
    let exitCount = 0
    const removeContextMenu = ieltsRules.blockContextMenu()
    const removeDevTools = ieltsRules.blockDevTools()
    const removeReload = ieltsRules.blockReload('Reloading will discard your test. Continue?')
    const removeCopyPaste = ieltsRules.blockCopyPaste(document)

    const removeTabHide = ieltsRules.onTabHide(() => {
      exitCount += 1
      if (exitCount === 1) {
        toast.warning('⚠️ Testdan chiqmang! Bu birinchi ogohlantirish.')
      } else if (exitCount === 2) {
        toast.warning('⚠️ Second warning. If you exit again the test will auto-submit.')
      } else if (exitCount >= 3 && !submitMutation.isPending) {
        toast.error('Test avto-submit qilindi (cheating).')
        submitMutation.mutate()
      }
    })

    const removeFsChange = ieltsRules.onFullscreenChange(() => {
      const fs = ieltsRules.isFullscreen()
      setIsFullscreen(fs)
      if (
        !fs &&
        !userExitedFsRef.current &&
        !submitMutation.isPending &&
        !submitMutation.isSuccess
      ) {
        toast.warning(
          'Test fullscreen rejimida bajarilishi kerak — qayta to\'liq ekranga o\'tkazildi.',
        )
        setTimeout(() => ieltsRules.enterFullscreen(), 50)
      }
    })

    return () => {
      removeContextMenu()
      removeDevTools()
      removeReload()
      removeCopyPaste()
      removeTabHide()
      removeFsChange()
      ieltsRules.exitFullscreen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFullscreen = () => {
    if (ieltsRules.isFullscreen()) {
      userExitedFsRef.current = true
      ieltsRules.exitFullscreen()
    } else {
      userExitedFsRef.current = false
      ieltsRules.enterFullscreen()
    }
  }

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
      toast.info('Time is up — submitting automatically…')
      submitMutation.mutate()
    }
  }, [timeUp, submitMutation])

  // Listening testlar yangi modelda — listening_parts'ni passage-shaped qilamiz
  // shunda quyidagi JSX ikkala model bilan ishlay oladi.
  const sections = useMemo<Passage[]>(() => {
    if (
      attempt.test.module === 'listening' &&
      attempt.test.listening_parts &&
      attempt.test.listening_parts.length > 0
    ) {
      return attempt.test.listening_parts
        .slice()
        .sort((a, b) => a.part_number - b.part_number)
        .map((lp) => ({
          id: lp.id,
          part_number: lp.part_number,
          title: `Part ${lp.part_number}`,
          content: lp.instructions ?? '',
          audio_file: lp.audio_url,
          audio_duration_seconds: lp.audio_duration_seconds,
          min_words: null,
          order: lp.part_number,
          questions: lp.questions,
        }))
    }
    return attempt.test.passages
  }, [attempt.test.module, attempt.test.listening_parts, attempt.test.passages])

  const allQuestions = useMemo(
    () => sections.flatMap((p) => p.questions),
    [sections],
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
    ? 'Saving…'
    : dirtyRef.current
      ? 'Unsaved changes'
      : saveMutation.isSuccess
        ? 'Saved'
        : ''

  return (
    <div className="test-app flex h-screen flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-6 text-white">
        <div className="flex items-center gap-3">
          <a href="/home" title="Home">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-white hover:bg-slate-800 hover:text-white"
            >
              <Home className="h-4 w-4" />
            </Button>
          </a>
          {/* ETAP 18 — IELTS badge (red) */}
          <span className="rounded-md bg-brand-500 px-2 py-1 text-[11px] font-bold tracking-wider text-white">
            IELTS
          </span>
          <span className="text-xs uppercase tracking-wider text-slate-400">
            ID
          </span>
          <span className="font-mono text-xs text-slate-300">
            {attempt.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 md:inline">{saveStatus}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-2 text-white hover:bg-slate-800 hover:text-white"
            title={
              isFullscreen
                ? 'Ekranni kichraytirish (favqulodda holat uchun)'
                : 'Full screen rejimiga o‘tish'
            }
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
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
        <section
          className={`${
            attempt.test.module === 'reading' ? 'w-3/5' : 'w-1/2'
          } overflow-y-auto border-r bg-white p-6`}
        >
          {sections.map((p) => (
            <article key={p.id} className="mb-10">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Part {p.part_number}
              </h2>
              <h3 className="mb-4 text-xl font-bold text-slate-900">{p.title}</h3>
              {p.audio_file && attempt.test.module === 'listening' && (
                <LockedAudio src={p.audio_file} />
              )}
              <div className="prose prose-slate max-w-none whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
                {p.content}
              </div>
            </article>
          ))}
        </section>

        <section
          className={`${
            attempt.test.module === 'reading' ? 'w-2/5' : 'w-1/2'
          } overflow-y-auto bg-white p-6`}
        >
          {sections.map((p) => {
            let numberCursor = sections
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
                  Part {p.part_number} — questions
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
                  aria-label={`Go to question: ${i + 1}`}
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
            <DialogTitle>Submit the test??</DialogTitle>
            <DialogDescription>
              {answeredCount} / {allQuestions.length} questions answered.
              Once submitted, answers cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                submitMutation.mutate()
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Submitting…' : 'Submit'}
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
          <p className="text-destructive">could not load result.</p>
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
        <p className="text-destructive">Failed to load test.</p>
      </div>
    )
  }
  if (attemptQuery.data.status !== 'in_progress') {
    return <Navigate to={`/result/${attemptId}`} replace />
  }
  return <TestGate attempt={attemptQuery.data} />
}

// ====== Pre-test rules dialog gate ======

function TestGate({ attempt }: { attempt: Attempt }) {
  const [started, setStarted] = useState(false)
  const navigate = useNavigate()

  if (!started) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <p className="text-sm text-slate-500">Accept the rules to start…</p>
        </div>
        <TestStartDialog
          open
          module={attempt.test.module}
          onConfirm={async () => {
            await ieltsRules.enterFullscreen()
            setStarted(true)
          }}
          onCancel={() => navigate(-1)}
        />
      </>
    )
  }

  if (attempt.test.module === 'writing') {
    return <WriteAttemptView attempt={attempt} />
  }
  return <LiveAttemptView attempt={attempt} />
}

// ====== WRITING ATTEMPT ======

// ETAP 14 BUG #2 multi-task — combined essay format
const TASK_DELIMITER_PATTERN = /=== TASK (\d+) ===\n([\s\S]*?)(?=(?:\n*=== TASK \d+ ===)|$)/g

function parseCombinedEssay(combined: string): Record<number, string> {
  const out: Record<number, string> = {}
  if (!combined) return out
  let m: RegExpExecArray | null
  TASK_DELIMITER_PATTERN.lastIndex = 0
  while ((m = TASK_DELIMITER_PATTERN.exec(combined))) {
    const num = Number(m[1])
    if (!Number.isNaN(num)) out[num] = m[2].trim()
  }
  return out
}

function combineAnswers(
  tasks: { id: number; task_number: number }[],
  answers: Record<number, string>,
): string {
  return tasks
    .slice()
    .sort((a, b) => a.task_number - b.task_number)
    .map((t) => `=== TASK ${t.task_number} ===\n${answers[t.id] || ''}`)
    .join('\n\n')
}

function getWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0
}

function WriteAttemptView({ attempt }: { attempt: Attempt }) {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [isFullscreen, setIsFullscreen] = useState(() => ieltsRules.isFullscreen())
  const userExitedFsRef = useRef(false)
  const dirtyRef = useRef(false)
  const initialisedRef = useRef(false)

  // Multi-task support — har task uchun alohida javob
  const writingTasks = attempt.test.writing_tasks ?? []
  const legacyTask = attempt.test.passages[0]
  const hasWizardTasks = writingTasks.length > 0

  // Synthetic single-task — agar legacy passage'dan kelgan bo'lsa
  const tasks = hasWizardTasks
    ? writingTasks
    : legacyTask
      ? [{
          id: -1,
          task_number: legacyTask.part_number ?? 1,
          prompt: legacyTask.content,
          chart_image_url: null,
          min_words: legacyTask.min_words ?? 150,
          suggested_minutes: 60,
          requirements: '',
        }]
      : []

  const [taskAnswers, setTaskAnswers] = useState<Record<number, string>>(
    () => {
      const parsed = parseCombinedEssay(attempt.essay_text || '')
      // Agar parsing bermasa, butun matnni birinchi taskka beramiz
      if (Object.keys(parsed).length === 0 && attempt.essay_text && tasks[0]) {
        return { [tasks[0].id]: attempt.essay_text }
      }
      // task_number key'ni task.id ga aylantiramiz
      const byId: Record<number, string> = {}
      for (const t of tasks) {
        if (parsed[t.task_number]) byId[t.id] = parsed[t.task_number]
      }
      return byId
    },
  )
  const [activeTaskId, setActiveTaskId] = useState<number>(tasks[0]?.id ?? -1)

  useEffect(() => {
    if (!initialisedRef.current) {
      initialisedRef.current = true
    }
  }, [attempt])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const combinedEssay = useMemo(
    () => combineAnswers(tasks, taskAnswers),
    [tasks, taskAnswers],
  )

  const saveMutation = useMutation({
    mutationFn: async (essay_text: string) =>
      api.patch(`/attempts/${attempt.id}/essay/`, { essay_text }),
  })

  const submitMutation = useMutation({
    mutationFn: async () =>
      api.post(`/attempts/${attempt.id}/submit-writing/`, { essay_text: combinedEssay }),
    onSuccess: () => navigate('/writing/sent', { replace: true }),
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Submitda xatolik')
    },
  })

  // ===== IELTS rules enforcement (writing) =====
  useEffect(() => {
    let exitCount = 0
    const removeContextMenu = ieltsRules.blockContextMenu()
    const removeDevTools = ieltsRules.blockDevTools()
    const removeReload = ieltsRules.blockReload()
    // For writing: don't block paste in textarea (students need to type freely),
    // but block on document level for copy of prompt
    const removeTabHide = ieltsRules.onTabHide(() => {
      exitCount += 1
      if (exitCount === 1) {
        toast.warning('⚠️ Testdan chiqmang! Bu birinchi ogohlantirish.')
      } else if (exitCount === 2) {
        toast.warning('⚠️ Second warning. If you exit again the test will auto-submit.')
      } else if (exitCount >= 3 && !submitMutation.isPending) {
        toast.error('Test avto-submit qilindi (cheating).')
        submitMutation.mutate()
      }
    })
    const removeFsChange = ieltsRules.onFullscreenChange(() => {
      const fs = ieltsRules.isFullscreen()
      setIsFullscreen(fs)
      if (
        !fs &&
        !userExitedFsRef.current &&
        !submitMutation.isPending &&
        !submitMutation.isSuccess
      ) {
        toast.warning(
          'Test fullscreen rejimida bajarilishi kerak — qayta to\'liq ekranga o\'tkazildi.',
        )
        setTimeout(() => ieltsRules.enterFullscreen(), 50)
      }
    })

    return () => {
      removeContextMenu()
      removeDevTools()
      removeReload()
      removeTabHide()
      removeFsChange()
      ieltsRules.exitFullscreen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFullscreen = () => {
    if (ieltsRules.isFullscreen()) {
      userExitedFsRef.current = true
      ieltsRules.exitFullscreen()
    } else {
      userExitedFsRef.current = false
      ieltsRules.enterFullscreen()
    }
  }

  useEffect(() => {
    if (!dirtyRef.current) return
    const handle = setTimeout(() => {
      saveMutation.mutate(combinedEssay)
      dirtyRef.current = false
    }, 2000)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedEssay])

  const startedAtMs = new Date(attempt.started_at).getTime()
  const totalSec = attempt.test.duration_minutes * 60
  const elapsedSec = Math.floor((now - startedAtMs) / 1000)
  const remainingSec = Math.max(0, totalSec - elapsedSec)
  const timeUp = remainingSec === 0

  useEffect(() => {
    if (timeUp && !submitMutation.isPending) {
      toast.info('Time is up — submitting automatically…')
      submitMutation.mutate()
    }
  }, [timeUp, submitMutation])

  // Faol task ma'lumotlari
  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? tasks[0]
  const taskTitle = activeTask ? `Task ${activeTask.task_number}` : 'Writing task'
  const taskPrompt = activeTask?.prompt ?? ''
  const taskRequirements = activeTask?.requirements ?? ''
  const chartImageUrl = activeTask?.chart_image_url ?? null
  const minWords = activeTask?.min_words ?? 150
  const activeAnswer = activeTask ? (taskAnswers[activeTask.id] || '') : ''
  const wordCount = getWordCount(activeAnswer)
  const reachedMin = wordCount >= minWords

  // Submit modal uchun — har task uchun word count
  const totalWords = tasks.reduce(
    (sum, t) => sum + getWordCount(taskAnswers[t.id] || ''),
    0,
  )
  const allTasksMet = tasks.every(
    (t) => getWordCount(taskAnswers[t.id] || '') >= (t.min_words ?? 150),
  )

  const saveStatus = saveMutation.isPending
    ? 'Saving…'
    : dirtyRef.current
      ? 'Unsaved changes'
      : saveMutation.isSuccess
        ? 'Saved'
        : ''

  return (
    <div className="test-app flex h-screen flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-6 text-white">
        <div className="flex items-center gap-3">
          <a href="/home" title="Home">
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-2 text-white hover:bg-slate-800 hover:text-white"
            title={
              isFullscreen
                ? 'Ekranni kichraytirish (favqulodda holat uchun)'
                : 'Full screen rejimiga o‘tish'
            }
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
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

      {/* Multi-task tab bar — faqat bir nechta task bo'lsa */}
      {tasks.length > 1 && (
        <div className="flex items-center gap-1 border-b bg-white px-4">
          {tasks
            .slice()
            .sort((a, b) => a.task_number - b.task_number)
            .map((t) => {
              const ans = taskAnswers[t.id] || ''
              const wc = getWordCount(ans)
              const ok = wc >= (t.min_words ?? 150)
              const isActive = t.id === activeTaskId
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTaskId(t.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Task {t.task_number}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      ok
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {wc}/{t.min_words ?? 150}
                  </span>
                </button>
              )
            })}
        </div>
      )}

      <main className="test-body flex min-h-0 flex-1 overflow-hidden">
        <section className="w-1/2 overflow-y-auto border-r bg-white p-6">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {taskTitle}
          </h2>
          <h3 className="mb-4 text-xl font-bold text-slate-900">
            {activeTask ? `Task ${activeTask.task_number}` : 'Writing task'}
          </h3>
          {chartImageUrl ? (
            <img
              src={chartImageUrl}
              alt={`Task ${activeTask?.task_number ?? 1} chart`}
              className="mb-4 max-h-72 w-full rounded-md border border-slate-200 object-contain"
            />
          ) : null}
          <div className="prose prose-slate mt-4 max-w-none whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
            {taskPrompt}
          </div>
          {taskRequirements && (
            <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              {taskRequirements}
            </p>
          )}
          <p className="mt-4 text-sm text-slate-500">
            Write at least <strong>{minWords}</strong> words.
          </p>
        </section>

        <section className="flex w-1/2 flex-col bg-white">
          <div className="flex items-center justify-between border-b px-6 py-2 text-sm">
            <span
              className={`font-semibold ${
                reachedMin ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {wordCount}
              <span className="ml-1 font-normal text-slate-500">
                / {minWords} min words
              </span>
              {reachedMin ? (
                <span className="ml-2">✓</span>
              ) : wordCount > 0 ? (
                <span className="ml-2 text-xs font-normal text-rose-600">
                  ({minWords - wordCount} so'z yetishmaydi)
                </span>
              ) : null}
            </span>
            <span className="text-xs text-slate-500">{saveStatus || 'Auto-save 2s'}</span>
          </div>
          <textarea
            value={activeAnswer}
            onChange={(e) => {
              if (!activeTask) return
              dirtyRef.current = true
              setTaskAnswers((prev) => ({ ...prev, [activeTask.id]: e.target.value }))
            }}
            placeholder={`Write your Task ${activeTask?.task_number ?? 1} answer here…`}
            className="flex-1 resize-none border-0 p-6 text-[15px] leading-relaxed text-slate-900 focus:outline-none"
          />
        </section>
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yuborishni tasdiqlaysizmi?</DialogTitle>
            <DialogDescription>
              Yuborilgandan keyin o'zgartirib bo'lmaydi. Ustoz qo'lda baholaydi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {tasks.map((t) => {
              const wc = getWordCount(taskAnswers[t.id] || '')
              const need = t.min_words ?? 150
              const ok = wc >= need
              return (
                <div
                  key={t.id}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                    ok ? 'bg-emerald-50' : 'bg-rose-50'
                  }`}
                >
                  <span className="font-medium text-slate-900">
                    Task {t.task_number}
                  </span>
                  <span
                    className={ok ? 'text-emerald-700' : 'text-rose-700'}
                  >
                    {wc} / {need} so'z {ok ? '✓' : `(${need - wc} kerak)`}
                  </span>
                </div>
              )
            })}
            <p className="pt-2 text-xs text-slate-500">
              Jami: <strong>{totalWords}</strong> so'z
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Bekor
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                submitMutation.mutate()
              }}
              disabled={submitMutation.isPending}
              className={!allTasksMet ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              {submitMutation.isPending
                ? 'Yuborilmoqda…'
                : allTasksMet
                  ? 'Yuborish'
                  : "Baribir yuborish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
