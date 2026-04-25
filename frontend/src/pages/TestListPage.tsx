import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock, FileText, Lock } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { Footer } from '@/components/Footer'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
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

const MODULE_TITLES: Record<ModuleId, string> = {
  listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking',
}

const DIFFICULTY_LEVELS = [
  { id: 'beginner', label: 'Boshlang‘ich', range: '4.5–5.5' },
  { id: 'intermediate', label: 'O‘rta', range: '5.5–6.5' },
  { id: 'advanced', label: 'Yuqori', range: '6.5–7.5' },
  { id: 'expert', label: 'Mahoratli', range: '7.5+' },
] as const

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
    if (isValid) document.title = `ILDIZmock — ${MODULE_TITLES[moduleParam as ModuleId]} testlari`
  }, [isValid, moduleParam])

  // Auth gate for writing
  const writingLocked = moduleParam === 'writing' && !user

  // Counts per difficulty (for showing on level cards)
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
      // Guest user: save anonymous attempt + token to localStorage
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
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Testni boshlab bo‘lmadi')
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
        <main className="container mx-auto max-w-2xl flex-1 px-4 py-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Lock className="h-7 w-7 text-gray-700" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Writing testlari faqat ro‘yxatdan o‘tgan foydalanuvchilar uchun</h1>
          <p className="mt-3 text-[var(--muted)]">
            Insheyingiz ustoz tomonidan tekshiriladi va batafsil feedback olasiz.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button size="lg" className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">Ro‘yxatdan o‘tish</Button></Link>
            <Link to="/login"><Button size="lg" variant="outline">Hisobingiz bormi?</Button></Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const moduleTitle = MODULE_TITLES[moduleParam as ModuleId]
  const all = list.data ?? []
  const filtered = difficulty ? all.filter((t) => t.difficulty === difficulty) : all

  // Step 1: difficulty cards (when no filter selected and not "all")
  const showLevelSelector = !difficulty && !showAll

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="container mx-auto max-w-6xl flex-1 px-4 py-10">
        <div className="mb-8">
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
            <ArrowLeft className="h-4 w-4" /> Bosh sahifa
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{moduleTitle} testlari</h1>
          {showLevelSelector && (
            <p className="mt-1 text-[var(--muted)]">Qaysi darajada mashq qilmoqchisiz?</p>
          )}
        </div>

        {list.isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
            ))}
          </div>
        )}

        {/* Step 1: Difficulty levels */}
        {!list.isLoading && showLevelSelector && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DIFFICULTY_LEVELS.map((lvl) => {
                const count = all.filter((t) => t.difficulty === lvl.id).length
                return (
                  <Link key={lvl.id} to={`/tests/${moduleParam}?difficulty=${lvl.id}`}>
                    <article className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-black hover:shadow-lg">
                      <div className="text-xs font-mono uppercase tracking-wider text-[var(--muted)]">Band {lvl.range}</div>
                      <h3 className="mt-2 text-xl font-semibold">{lvl.label}</h3>
                      <p className="mt-3 flex-1 text-sm text-[var(--muted)]">{count} ta test</p>
                      <span className="mt-4 text-sm font-medium text-[var(--accent)] group-hover:underline">Tanlash →</span>
                    </article>
                  </Link>
                )
              })}
            </div>
            <div className="mt-6 text-center">
              <Link to={`/tests/${moduleParam}?all=1`} className="text-sm text-[var(--muted)] hover:underline">
                ← Hammasini ko‘rish (filter siz)
              </Link>
            </div>
          </>
        )}

        {/* Step 2: filtered test list */}
        {!list.isLoading && !showLevelSelector && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-[var(--muted)]">
                {difficulty
                  ? `Daraja: ${DIFFICULTY_LEVELS.find((l) => l.id === difficulty)?.label} (${filtered.length} ta)`
                  : `Hamma testlar (${filtered.length} ta)`}
              </p>
              <Link to={`/tests/${moduleParam}`} className="text-sm text-[var(--muted)] hover:underline">
                ← Daraja tanlash
              </Link>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-[var(--muted)]">
                Bu darajada hali test yo‘q.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((t) => (
                  <article
                    key={t.id}
                    onMouseEnter={() => prefetch(t.id)}
                    className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-black hover:shadow-lg"
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
                      onClick={() => startAttempt.mutate(t)}
                    >
                      {startAttempt.isPending ? 'Boshlanmoqda…' : 'Boshlash'}
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
