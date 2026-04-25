import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock, FileText } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type TestItem = {
  id: string
  name: string
  module: string
  test_type: string
  difficulty: string
  duration_minutes: number
  description: string
  access_level: string
  question_count: number
}

const VALID_MODULES = ['listening', 'reading', 'writing', 'speaking'] as const
type ModuleId = (typeof VALID_MODULES)[number]

const MODULE_TITLES: Record<ModuleId, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
}

const MODULE_DESC: Record<ModuleId, string> = {
  listening: 'Audio orqali savollarga javob bering — form, MCQ, map labeling.',
  reading: 'Akademik passage — MCQ, T/F/NG, paragraph matching, fill blank.',
  writing: 'Task 1 + Task 2 inshe. Word counter va auto-save bilan.',
  speaking: 'Mikrofon orqali. Tez kunda qo‘shiladi.',
}

export default function TestListPage() {
  const { module: moduleParam } = useParams<{ module: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isValid =
    !!moduleParam && (VALID_MODULES as readonly string[]).includes(moduleParam)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tests', moduleParam],
    queryFn: async () => {
      const res = await api.get<TestItem[]>(`/tests/?module=${moduleParam}`)
      return res.data
    },
    enabled: isValid,
    staleTime: 5 * 60 * 1000,
  })

  const startAttempt = useMutation({
    mutationFn: async (testId: string) => {
      const res = await api.post<{ id: string }>(`/tests/${testId}/attempts`)
      return res.data
    },
    onSuccess: (attempt) => navigate(`/take/${attempt.id}`),
    onError: () => toast.error('Testni boshlab bo‘lmadi'),
  })

  const prefetchTest = (testId: string) => {
    qc.prefetchQuery({
      queryKey: ['test', testId],
      queryFn: async () => (await api.get(`/tests/${testId}/`)).data,
      staleTime: 60_000,
    })
  }

  if (!isValid) return <Navigate to="/home" replace />

  const moduleTitle = MODULE_TITLES[moduleParam as ModuleId]
  const moduleDesc = MODULE_DESC[moduleParam as ModuleId]

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/home">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Bosh sahifa
            </Button>
          </Link>
        </div>
      </header>

      <main className="container py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{moduleTitle}</h1>
          <p className="mt-1 text-[var(--muted)]">{moduleDesc}</p>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-lg border border-[var(--border)] bg-slate-50"
              />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-[var(--error)]">Testlarni yuklab bo‘lmadi.</p>
        )}

        {!isLoading && data && data.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
            Bu modulda hali testlar mavjud emas.
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((t) => (
              <article
                key={t.id}
                onMouseEnter={() => prefetchTest(t.id)}
                className="flex flex-col rounded-lg border border-[var(--border)] bg-white p-6 transition-colors hover:border-slate-900"
              >
                <h3 className="mb-2 text-lg font-semibold">{t.name}</h3>
                <p className="mb-4 line-clamp-2 flex-1 text-sm text-[var(--muted)]">
                  {t.description || 'Tavsif yo‘q'}
                </p>
                <div className="mb-4 flex gap-4 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> {t.question_count} savol
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {t.duration_minutes} daq
                  </span>
                </div>
                <Button
                  className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]"
                  disabled={startAttempt.isPending}
                  onClick={() => startAttempt.mutate(t.id)}
                >
                  {startAttempt.isPending ? 'Boshlanmoqda…' : 'Boshlash'}
                </Button>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
