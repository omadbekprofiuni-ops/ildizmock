import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  FileText,
  Headphones,
  Loader2,
  PenLine,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type PracticeTest = {
  id: string
  name: string
  module: 'listening' | 'reading' | 'writing'
  test_type: string
  difficulty: string
  duration_minutes: number
  description: string
  question_count: number
  is_practice_enabled: boolean
  practice_time_limit: number | null
}

const MODULE_META = {
  listening: {
    label: 'Listening',
    Icon: Headphones,
    accent: 'text-emerald-600',
    chip: 'bg-emerald-100 text-emerald-800',
  },
  reading: {
    label: 'Reading',
    Icon: BookOpen,
    accent: 'text-blue-600',
    chip: 'bg-blue-100 text-blue-800',
  },
  writing: {
    label: 'Writing',
    Icon: PenLine,
    accent: 'text-orange-600',
    chip: 'bg-orange-100 text-orange-800',
  },
} as const

export default function PracticeListPage() {
  const navigate = useNavigate()
  useEffect(() => { document.title = 'ILDIZmock — Practice' }, [])

  const query = useQuery({
    queryKey: ['practice-tests'],
    queryFn: async () =>
      (await api.get<PracticeTest[]>('/tests/?practice=1')).data,
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
  const grouped = {
    listening: tests.filter((t) => t.module === 'listening'),
    reading: tests.filter((t) => t.module === 'reading'),
    writing: tests.filter((t) => t.module === 'writing'),
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Practice</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container space-y-10 py-10">
        <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-white">
          <h2 className="text-3xl font-bold">Practice Mode</h2>
          <p className="mt-2 text-emerald-100">
            O‘z vaqtingizda mashq qiling, javob bergandan keyin darhol natijani
            va to‘g‘ri javoblarni ko‘ring.
          </p>
          <div className="mt-4">
            <Link to="/practice/history">
              <Button variant="secondary" size="sm">
                Practice tarixi <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>

        {query.isLoading && (
          <p className="text-muted-foreground">Loading…</p>
        )}
        {query.isError && (
          <p className="text-destructive">Practice testlarni yuklab bo‘lmadi.</p>
        )}

        {!query.isLoading && tests.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Hozircha practice uchun ochilgan test yo‘q.
            </CardContent>
          </Card>
        )}

        {(['listening', 'reading', 'writing'] as const).map((module) => {
          const list = grouped[module]
          const meta = MODULE_META[module]
          if (list.length === 0) return null
          return (
            <section key={module}>
              <div className="mb-3 flex items-center gap-2">
                <meta.Icon className={`h-5 w-5 ${meta.accent}`} />
                <h3 className="text-xl font-semibold">{meta.label} Practice</h3>
                <span className="text-sm text-muted-foreground">
                  ({list.length})
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="flex h-full flex-col p-5">
                      <span
                        className={`mb-2 inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-semibold ${meta.chip}`}
                      >
                        {meta.label}
                      </span>
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
                          {t.practice_time_limit
                            ? `${t.practice_time_limit} min`
                            : 'Vaqt yo‘q'}
                        </span>
                      </div>

                      <Button
                        className="w-full"
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
            </section>
          )
        })}
      </main>
    </div>
  )
}
