import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, History, RotateCcw, UserPlus, X } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'
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

type SectionBand = {
  raw: number
  max: number
  band: number
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
  section_band_scores?: Record<string, SectionBand>
  essay_text: string
  word_count: number | null
  answers: AnswerRow[]
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.3, overflow: 'hidden' }}
    >
      <img
        src={brandLogo}
        alt="Mock Exam"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  )
}

function ResultHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-8">
        <Link
          to="/home"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="hidden items-center gap-3 md:flex">
          <BrandMark size={32} />
          <h1 className="truncate text-base font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
        </div>
      </div>
    </header>
  )
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
    onError: () => toast.error("Couldn't start a retry"),
  })

  if (!attemptId) return <Navigate to="/" replace />

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading result…</p>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-cta-600">Could not load result.</p>
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
        <ResultHeader title="Your essay was submitted" />
        <main className="mx-auto max-w-3xl space-y-5 px-8 py-10">
          <div
            className="rounded-[20px] border border-slate-100 bg-white p-10 text-center"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="icon-tile icon-tile--amber mx-auto" style={{ width: 56, height: 56 }}>
              <History className="h-7 w-7" />
            </div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
              Feedback pending
            </h2>
            <p className="mt-3 text-slate-600">
              Your essay was received. Your teacher will review and grade it shortly.
              For now, here's a quick word count:
            </p>
            <div className="mx-auto mt-6 inline-flex gap-8 rounded-2xl border border-slate-100 bg-slate-50 px-7 py-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Words
                </div>
                <div className="mt-1 text-xl font-extrabold text-slate-900">
                  {r.word_count ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Test
                </div>
                <div className="mt-1 truncate text-base font-extrabold text-slate-900">
                  {r.test_name}
                </div>
              </div>
            </div>
          </div>

          {r.essay_text && (
            <div
              className="rounded-[20px] border border-slate-100 bg-white p-7"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <h3 className="mb-3 text-base font-extrabold text-slate-900">Your essay</h3>
              <div className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-5 text-sm leading-relaxed text-slate-800">
                {r.essay_text}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              to={`/tests/${r.module}`}
              className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              Other tests
            </Link>
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <History className="h-4 w-4" /> History
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const unanswered = r.answers.filter((a) => !a.is_correct && a.user_answer == null).length
  const isPractice = r.test?.is_practice_enabled === true
  const sortedAnswers = [...r.answers].sort(
    (a, b) =>
      (a.question_number || a.question_order || 0) -
      (b.question_number || b.question_order || 0),
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <ResultHeader title={r.test_name} />

      <main className="mx-auto max-w-3xl space-y-6 px-8 py-12">
        {!user && (
          <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm">
            <UserPlus className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
            <div className="flex-1">
              <p className="font-bold text-amber-900">
                Sign in to save results and see your history →
              </p>
              <p className="mt-1 text-amber-800">
                Right now this result is not linked to your account.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-cta-500 px-4 py-2 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600"
            >
              Sign In
            </Link>
          </div>
        )}

        {isPractice && (
          <div
            className="rounded-2xl border-l-4 p-5 text-sm"
            style={{
              borderColor: 'var(--accent-500)',
              background: 'var(--accent-50)',
              color: 'var(--accent-700)',
            }}
          >
            <p className="font-extrabold">Practice mode</p>
            <p className="mt-0.5 text-[var(--accent-700)]">
              Correct answers are shown for each question. No retry limit.
            </p>
          </div>
        )}

        {/* Big band score */}
        <div
          className="relative overflow-hidden rounded-[28px] p-10 text-center text-white"
          style={{ background: 'var(--gradient-hero)', boxShadow: 'var(--shadow-lg)' }}
        >
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/80">
              Band Score
            </p>
            <p
              className="mt-3 text-[88px] font-extrabold leading-none tracking-tight"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {r.band_score ?? '—'}
            </p>
            <p className="mt-3 text-sm font-semibold capitalize text-white/85">
              {r.module} module
            </p>
          </div>
        </div>

        {/* Stat boxes */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Correct" value={correct} tone="accent" />
          <StatBox label="Wrong" value={wrong - unanswered} tone="cta" />
          <StatBox label="Unanswered" value={unanswered} tone="slate" />
          <StatBox label="Accuracy" value={`${percentage}%`} tone="brand" />
        </div>

        {/* ETAP 25 — Per-skill band scores (only when grader produced them) */}
        {r.section_band_scores &&
          Object.keys(r.section_band_scores).length > 0 && (
            <div
              className="rounded-[20px] border border-slate-100 bg-white p-6"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <h3 className="mb-3 text-base font-extrabold text-slate-900">
                Per-skill bands
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(r.section_band_scores).map(([skill, s]) => {
                  if (skill === 'other' || s.max === 0) return null
                  return (
                    <div
                      key={skill}
                      className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 text-center"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                        {skill}
                      </p>
                      <p className="mt-1 text-3xl font-extrabold tabular-nums text-brand-700">
                        {s.band.toFixed(1)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {s.raw} / {s.max}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        {/* Question analysis */}
        {sortedAnswers.length > 0 && (
          <div
            className="rounded-[20px] border border-slate-100 bg-white p-7"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <h3 className="mb-4 text-base font-extrabold text-slate-900">
              Question analysis
            </h3>
            <ol className="space-y-2.5">
              {sortedAnswers.map((a) => (
                <li
                  key={a.question}
                  className="flex gap-3 rounded-2xl border-l-4 p-4"
                  style={{
                    borderColor: a.is_correct ? 'var(--accent-500)' : 'var(--cta-500)',
                    background: a.is_correct ? 'var(--accent-50)' : 'var(--cta-50)',
                  }}
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      background: a.is_correct ? 'var(--accent-500)' : 'var(--cta-500)',
                    }}
                  >
                    {a.is_correct ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {a.question_number || a.question_order}
                      {'. '}
                      {a.question_prompt || a.question_text || `Question ${a.question}`}
                    </p>
                    <div className="mt-1.5 space-y-0.5 text-sm">
                      <p>
                        <span className="text-slate-500">Your answer: </span>
                        <span
                          className="font-semibold"
                          style={{
                            color: a.is_correct
                              ? 'var(--accent-700)'
                              : 'var(--cta-700)',
                          }}
                        >
                          {formatAnswer(a.user_answer)}
                        </span>
                      </p>
                      {!a.is_correct && (
                        <p>
                          <span className="text-slate-500">Correct answer: </span>
                          <span
                            className="font-bold"
                            style={{ color: 'var(--accent-700)' }}
                          >
                            {formatAnswer(a.correct_answer)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {user && r.test?.id && (
            <button
              type="button"
              onClick={() => retry.mutate()}
              disabled={retry.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              style={{ background: 'var(--accent-600)' }}
            >
              <RotateCcw className="h-4 w-4" />
              {retry.isPending ? 'Creating…' : 'Retry'}
            </button>
          )}
          <Link
            to={`/take/${r.id}?review=1`}
            className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Review
          </Link>
          <Link
            to={`/tests/${r.module}`}
            className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Other tests
          </Link>
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
          >
            <History className="h-4 w-4" /> Home
          </Link>
        </div>
      </main>
    </div>
  )
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return '(no answer)'
  if (typeof value === 'string') return value || '(no answer)'
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

type StatTone = 'brand' | 'accent' | 'cta' | 'slate'

function StatBox({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone: StatTone
}) {
  const colorMap: Record<StatTone, string> = {
    brand: 'var(--brand-700)',
    accent: 'var(--accent-700)',
    cta: 'var(--cta-700)',
    slate: 'var(--slate-700)',
  }
  return (
    <div
      className="rounded-2xl border border-slate-100 bg-white p-5 text-center"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="text-3xl font-extrabold tracking-tight" style={{ color: colorMap[tone] }}>
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  )
}
