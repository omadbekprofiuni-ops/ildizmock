import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FileText,
  Headphones,
  Lock,
  Mic,
  PenTool,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { Footer } from '@/components/Footer'
import { Navbar } from '@/components/Navbar'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'
import { guestAttempts } from '@/lib/guest-attempts'
import { useAuth } from '@/stores/auth'

import type { GuestAttemptRecord } from '@/lib/guest-attempts'

type TestItem = {
  id: string
  name: string
  module: string
  test_type: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  duration_minutes: number
  description: string
  access_level: string
  question_count: number
}

const VALID_MODULES = ['listening', 'reading', 'writing', 'speaking'] as const
type ModuleId = (typeof VALID_MODULES)[number]
type Tone = 'brand' | 'accent' | 'cta' | 'slate'

const MODULE_TITLES: Record<ModuleId, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
}

const MODULE_META: Record<ModuleId, { Icon: typeof BookOpen; tone: Tone }> = {
  reading: { Icon: BookOpen, tone: 'brand' },
  listening: { Icon: Headphones, tone: 'cta' },
  writing: { Icon: PenTool, tone: 'accent' },
  speaking: { Icon: Mic, tone: 'slate' },
}

const DIFFICULTY_LEVELS: Array<{ id: 'beginner' | 'intermediate' | 'advanced' | 'expert'; label: string; range: string; tone: Tone }> = [
  { id: 'beginner', label: 'Beginner', range: '4.5–5.5', tone: 'accent' },
  { id: 'intermediate', label: 'Intermediate', range: '5.5–6.5', tone: 'brand' },
  { id: 'advanced', label: 'Advanced', range: '6.5–7.5', tone: 'cta' },
  { id: 'expert', label: 'Expert', range: '7.5+', tone: 'slate' },
]

export default function TestListPage() {
  const { module: moduleParam } = useParams<{ module: string }>()
  const [search] = useSearchParams()
  const difficulty = search.get('difficulty')
  const showAll = search.get('all') === '1'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuth((s) => s.user)
  const isValid = !!moduleParam && (VALID_MODULES as readonly string[]).includes(moduleParam)

  useEffect(() => {
    if (isValid) document.title = `ILDIZmock — ${MODULE_TITLES[moduleParam as ModuleId]} Tests`
  }, [isValid, moduleParam])

  const writingLocked = moduleParam === 'writing' && !user

  const list = useQuery({
    queryKey: ['tests', moduleParam],
    queryFn: async () => (await api.get<TestItem[]>(`/tests/?module=${moduleParam}`)).data,
    enabled: isValid && !writingLocked,
  })

  const startAttempt = useMutation({
    mutationFn: async (test: TestItem) => {
      const res = await api.post<{ id: string; guest_token?: string }>(
        `/tests/${test.id}/attempts`,
      )
      return { attemptId: res.data.id, guestToken: res.data.guest_token, test }
    },
    onSuccess: ({ attemptId, guestToken, test }) => {
      if (!user) {
        if (guestToken) {
          localStorage.setItem('ildizmock:guest-token', guestToken)
        }
        guestAttempts.add({
          id: attemptId,
          test_id: test.id,
          test_name: test.name,
          module: test.module as GuestAttemptRecord['module'],
          started_at: new Date().toISOString(),
          status: 'in_progress',
        })
      }
      navigate(`/take/${attemptId}`)
    },
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail
      toast.error(detail || 'Failed to start test')
    },
  })

  const prefetch = (testId: string) => {
    qc.prefetchQuery({
      queryKey: ['test', testId],
      queryFn: async () => (await api.get(`/tests/${testId}/`)).data,
      staleTime: 60_000,
    })
  }

  if (!isValid) return <Navigate to="/" replace />

  if (writingLocked) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Navbar />
        <main className="mx-auto max-w-2xl flex-1 px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <Lock className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            Writing Tests are only for registered users
          </h1>
          <p className="mt-3 text-slate-600">
            Your essay will be reviewed by a teacher with detailed feedback.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-cta-500 px-7 py-4 text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.30)]"
            >
              Sign In
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const moduleTitle = MODULE_TITLES[moduleParam as ModuleId]
  const moduleMeta = MODULE_META[moduleParam as ModuleId]
  const all = list.data ?? []
  const filtered = difficulty ? all.filter((t) => t.difficulty === difficulty) : all
  const showLevelSelector = !difficulty && !showAll

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="relative flex-1">
        <div className="hero-bg" />
        <div className="relative mx-auto max-w-7xl px-8 py-10">
          {/* Header */}
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link
                to="/"
                className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-brand-600"
              >
                <ArrowLeft className="h-4 w-4" /> Home
              </Link>
              <div className="flex items-center gap-4">
                <div className={`icon-tile icon-tile--${moduleMeta.tone}`} style={{ marginBottom: 0 }}>
                  <moduleMeta.Icon className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-[40px]">
                    {moduleTitle} Tests
                  </h1>
                  {showLevelSelector && (
                    <p className="mt-1 text-slate-600">
                      Which level would you like to practice?
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {list.isLoading && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-[20px] border border-slate-100 bg-slate-50"
                />
              ))}
            </div>
          )}

          {/* Step 1: Difficulty levels */}
          {!list.isLoading && showLevelSelector && (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {DIFFICULTY_LEVELS.map((lvl) => {
                  const count = all.filter((t) => t.difficulty === lvl.id).length
                  return (
                    <Link
                      key={lvl.id}
                      to={`/tests/${moduleParam}?difficulty=${lvl.id}`}
                      className="group rounded-[20px] border border-slate-100 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                      style={{ boxShadow: 'var(--shadow-sm)' }}
                    >
                      <div
                        className={`icon-tile icon-tile--${lvl.tone} inline-flex w-auto items-center justify-center px-3.5`}
                        style={{ height: 38, borderRadius: 10, minWidth: 64 }}
                      >
                        <span className="whitespace-nowrap text-[13px] font-extrabold tracking-tight">
                          {lvl.range}
                        </span>
                      </div>
                      <div className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Band {lvl.range}
                      </div>
                      <h3 className="mt-1.5 text-xl font-extrabold text-slate-900">
                        {lvl.label}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold text-slate-700">{count}</span>{' '}
                        {count === 1 ? 'test' : 'tests'}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-600 transition-all group-hover:gap-2 group-hover:text-brand-700">
                        Choose <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
              <div className="mt-6 text-center">
                <Link
                  to={`/tests/${moduleParam}?all=1`}
                  className="text-sm font-semibold text-slate-500 transition-colors hover:text-brand-600 hover:underline"
                >
                  ← Show all tests
                </Link>
              </div>
            </>
          )}

          {/* Step 2: filtered test list */}
          {!list.isLoading && !showLevelSelector && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-600">
                  {difficulty
                    ? `Level: ${
                        DIFFICULTY_LEVELS.find((l) => l.id === difficulty)?.label
                      } (${filtered.length} tests)`
                    : `All tests (${filtered.length})`}
                </p>
                <Link
                  to={`/tests/${moduleParam}`}
                  className="text-sm font-semibold text-slate-500 transition-colors hover:text-brand-600 hover:underline"
                >
                  ← Choose level
                </Link>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-[20px] border-2 border-dashed border-slate-200 px-6 py-16 text-center text-slate-500">
                  No tests at this level yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((t) => (
                    <article
                      key={t.id}
                      onMouseEnter={() => prefetch(t.id)}
                      className="flex flex-col rounded-[20px] border border-slate-100 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-brand-100"
                      style={{ boxShadow: 'var(--shadow-sm)' }}
                    >
                      <h3 className="mb-2 text-lg font-extrabold text-slate-900">
                        {t.name}
                      </h3>
                      <p className="mb-5 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
                        {t.description || 'No description'}
                      </p>
                      <div className="mb-5 flex gap-4 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" /> {t.question_count} questions
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> {t.duration_minutes} min
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={startAttempt.isPending}
                        onClick={() => startAttempt.mutate(t)}
                        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                      >
                        {startAttempt.isPending ? 'Starting…' : 'Start'}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
