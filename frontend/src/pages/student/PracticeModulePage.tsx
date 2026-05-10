import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FileText,
  Headphones,
  Loader2,
  PenLine,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Module = 'listening' | 'reading' | 'writing'
type Tone = 'brand' | 'accent' | 'cta'

type PracticeTest = {
  id: string
  name: string
  module: Module
  difficulty: string
  duration_minutes: number
  description: string
  question_count: number
  practice_time_limit: number | null
}

const META: Record<Module, { label: string; Icon: typeof Headphones; tone: Tone }> = {
  reading: { label: 'Reading', Icon: BookOpen, tone: 'brand' },
  listening: { label: 'Listening', Icon: Headphones, tone: 'cta' },
  writing: { label: 'Writing', Icon: PenLine, tone: 'accent' },
}

export default function PracticeModulePage() {
  const { module } = useParams<{ module: string }>()
  const navigate = useNavigate()

  const isValid = module && (['listening', 'reading', 'writing'] as string[]).includes(module)
  const m = (isValid ? module : 'reading') as Module
  const meta = META[m]

  useEffect(() => {
    document.title = `ILDIZmock — ${meta.label} Practice`
  }, [meta.label])

  const query = useQuery({
    queryKey: ['practice-tests', m],
    queryFn: async () =>
      (await api.get<PracticeTest[]>(`/tests/?practice=1&module=${m}`)).data,
    enabled: !!isValid,
  })

  const startAttempt = useMutation({
    mutationFn: async (test: PracticeTest) => {
      const res = await api.post<{ id: string }>(`/tests/${test.id}/attempts`)
      return { attemptId: res.data.id }
    },
    onSuccess: ({ attemptId }) => navigate(`/take/${attemptId}`),
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail
      toast.error(detail || 'Failed to start the practice test')
    },
  })

  if (!isValid) return <Navigate to="/practice" replace />

  const tests = query.data ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/practice"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Practice
            </Link>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              {meta.label} Practice
            </h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-8 py-10">
        {/* Module hero */}
        <section
          className="relative overflow-hidden rounded-[24px] p-9 text-white"
          style={{ background: 'var(--gradient-hero)', boxShadow: 'var(--shadow-lg)' }}
        >
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative flex items-center gap-5">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"
            >
              <meta.Icon className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                {meta.label} Practice
              </h2>
              <p className="mt-1.5 text-sm text-white/85">
                Practise the {meta.label.toLowerCase()} module on its own — with instant
                feedback after each attempt.
              </p>
            </div>
          </div>
        </section>

        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && <p className="text-cta-600">Couldn't load tests.</p>}

        {!query.isLoading && tests.length === 0 && (
          <div className="rounded-[20px] border-2 border-dashed border-slate-200 px-6 py-16 text-center text-slate-500">
            No {meta.label.toLowerCase()} practice tests yet.
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <article
              key={t.id}
              className="flex h-full flex-col rounded-[20px] border border-slate-100 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-brand-100"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="mb-3 flex items-start justify-between">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    meta.tone === 'brand'
                      ? 'bg-brand-50 text-brand-700'
                      : meta.tone === 'accent'
                        ? 'bg-teal-50 text-teal-700'
                        : 'bg-cta-50 text-cta-700'
                  }`}
                >
                  {t.difficulty || meta.label}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {meta.label}
                </span>
              </div>
              <h4 className="mb-2 text-base font-extrabold text-slate-900">{t.name}</h4>
              <p className="mb-5 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
                {t.description || '—'}
              </p>
              <div className="mb-5 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> {t.question_count} questions
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />{' '}
                  {t.practice_time_limit ?? t.duration_minutes} min
                </span>
              </div>
              <button
                type="button"
                onClick={() => startAttempt.mutate(t)}
                disabled={startAttempt.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {startAttempt.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                  </>
                ) : (
                  <>Start</>
                )}
              </button>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
