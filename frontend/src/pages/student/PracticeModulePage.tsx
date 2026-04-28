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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Module = 'listening' | 'reading' | 'writing'

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

const META: Record<Module, {
  label: string
  Icon: typeof Headphones
  gradient: string
  text: string
  btn: string
}> = {
  listening: {
    label: 'Listening',
    Icon: Headphones,
    gradient: 'from-blue-600 to-blue-700',
    text: 'text-blue-700',
    btn: 'bg-blue-600 hover:bg-blue-700',
  },
  reading: {
    label: 'Reading',
    Icon: BookOpen,
    gradient: 'from-purple-600 to-purple-700',
    text: 'text-purple-700',
    btn: 'bg-purple-600 hover:bg-purple-700',
  },
  writing: {
    label: 'Writing',
    Icon: PenLine,
    gradient: 'from-orange-600 to-orange-700',
    text: 'text-orange-700',
    btn: 'bg-orange-600 hover:bg-orange-700',
  },
}

export default function PracticeModulePage() {
  const { module } = useParams<{ module: string }>()
  const navigate = useNavigate()

  if (!module || !['listening', 'reading', 'writing'].includes(module)) {
    return <Navigate to="/practice" replace />
  }
  const m = module as Module
  const meta = META[m]

  useEffect(() => {
    document.title = `ILDIZmock — ${meta.label} Practice`
  }, [meta.label])

  const query = useQuery({
    queryKey: ['practice-tests', m],
    queryFn: async () =>
      (await api.get<PracticeTest[]>(`/tests/?practice=1&module=${m}`)).data,
  })

  const startAttempt = useMutation({
    mutationFn: async (test: PracticeTest) => {
      const res = await api.post<{ id: string }>(`/tests/${test.id}/attempts`)
      return { attemptId: res.data.id }
    },
    onSuccess: ({ attemptId }) => navigate(`/take/${attemptId}`),
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail
      toast.error(detail || 'Practice testni boshlashda xatolik')
    },
  })

  const tests = query.data ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/practice">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Practice
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">{meta.label} Practice</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container space-y-6 py-8">
        <div className={`rounded-2xl bg-gradient-to-r ${meta.gradient} p-6 text-white shadow`}>
          <div className="flex items-center gap-4">
            <meta.Icon className="h-10 w-10" />
            <div>
              <h2 className="text-2xl font-bold">{meta.label} Practice</h2>
              <p className="text-sm text-white/80">
                Faqat {meta.label.toLowerCase()} bo‘limini mashq qiling — instant feedback bilan.
              </p>
            </div>
          </div>
        </div>

        {query.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {query.isError && (
          <p className="text-destructive">Testlarni yuklab bo‘lmadi.</p>
        )}

        {!query.isLoading && tests.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Hozircha {meta.label.toLowerCase()} practice testlari yo‘q.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <Card key={t.id} className="transition hover:shadow-lg">
              <CardContent className="flex h-full flex-col p-5">
                <div className="mb-3 flex items-start justify-between">
                  <span
                    className={`inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold ${meta.text}`}
                  >
                    {t.difficulty || meta.label}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    {meta.label}
                  </span>
                </div>
                <h4 className="mb-2 text-base font-semibold">{t.name}</h4>
                <p className="mb-4 line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {t.description || '—'}
                </p>

                <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {t.question_count} savol
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {t.practice_time_limit ?? t.duration_minutes} min
                  </span>
                </div>

                <Button
                  className={`w-full text-white ${meta.btn}`}
                  onClick={() => startAttempt.mutate(t)}
                  disabled={startAttempt.isPending}
                >
                  {startAttempt.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Boshlanmoqda…
                    </>
                  ) : (
                    <>Boshlash</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
