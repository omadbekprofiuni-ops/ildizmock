import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Headphones,
  History,
  PenLine,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

type Module = 'listening' | 'reading' | 'writing'

type PracticeStats = Record<Module, {
  tests_count: number
  attempts_count: number
  best_band: number | null
  avg_band: number | null
}> & {
  recent: {
    id: string
    test_id: string
    test_name: string
    module: Module
    band_score: number | null
    submitted_at: string | null
  }[]
}

const MODULE_META: Record<Module, {
  label: string
  Icon: typeof Headphones
  gradient: string
  bg: string
  text: string
  band: string
}> = {
  listening: {
    label: 'Listening',
    Icon: Headphones,
    gradient: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    band: 'text-blue-700',
  },
  reading: {
    label: 'Reading',
    Icon: BookOpen,
    gradient: 'from-purple-500 to-purple-600',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    band: 'text-purple-700',
  },
  writing: {
    label: 'Writing',
    Icon: PenLine,
    gradient: 'from-orange-500 to-orange-600',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    band: 'text-orange-700',
  },
}

export default function PracticeListPage() {
  useEffect(() => { document.title = 'ILDIZmock — Practice' }, [])

  const stats = useQuery({
    queryKey: ['practice-stats'],
    queryFn: async () =>
      (await api.get<PracticeStats>('/practice/stats/')).data,
  })

  const data = stats.data
  const modules: Module[] = ['listening', 'reading', 'writing']

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
          <div className="flex items-center gap-2">
            <Link to="/practice/history">
              <Button variant="ghost" size="sm">
                <History className="mr-2 h-4 w-4" /> Tarix
              </Button>
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container space-y-8 py-10">
        {/* Hero */}
        <section className="rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 p-8 text-white shadow-lg">
          <h2 className="text-3xl font-bold">Practice Mode</h2>
          <p className="mt-2 text-red-100">
            O‘zingizga qulay vaqtda mashq qiling — javob bergandan keyin
            darhol natijani va to‘g‘ri javoblarni ko‘ring.
          </p>
        </section>

        {/* Module cards */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {modules.map((m) => {
            const meta = MODULE_META[m]
            const s = data?.[m]
            return (
              <Link
                key={m}
                to={`/practice/${m}`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className={`bg-gradient-to-br ${meta.gradient} p-6 text-white`}>
                  <meta.Icon className="h-10 w-10" />
                  <h3 className="mt-3 text-2xl font-bold">{meta.label}</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <div className="text-xs text-slate-500">Testlar</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {s?.tests_count ?? '—'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <div className="text-xs text-slate-500">Urinish</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {s?.attempts_count ?? 0}
                      </div>
                    </div>
                    <div className={`rounded-lg ${meta.bg} px-2 py-2`}>
                      <div className="text-xs text-slate-500">Eng yaxshi</div>
                      <div className={`text-lg font-semibold ${meta.band}`}>
                        {s?.best_band != null ? s.best_band.toFixed(1) : '—'}
                      </div>
                    </div>
                  </div>
                  <div className={`mt-4 flex items-center justify-end text-sm ${meta.text} group-hover:gap-2`}>
                    Boshlash <ArrowRight size={14} className="ml-1" />
                  </div>
                </div>
              </Link>
            )
          })}
        </section>

        {/* Recent attempts */}
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Oxirgi mashqlar</h3>
          {data?.recent && data.recent.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <ul className="divide-y divide-slate-100">
                {data.recent.map((r) => {
                  const meta = MODULE_META[r.module]
                  return (
                    <li key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.bg} ${meta.text}`}>
                          <meta.Icon size={18} />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{r.test_name}</div>
                          <div className="text-xs text-slate-500">
                            {meta.label} ·{' '}
                            {r.submitted_at
                              ? new Date(r.submitted_at).toLocaleString('uz-UZ', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </div>
                        </div>
                      </div>
                      <Link
                        to={`/result/${r.id}`}
                        className={`text-base font-semibold ${meta.band} hover:underline`}
                      >
                        {r.band_score != null ? r.band_score.toFixed(1) : '—'}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
              Hali biron-bir mashq yo‘q. Yuqoridagi modullardan boshlang.
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
