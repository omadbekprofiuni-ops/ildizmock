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

import brandLogo from '@/assets/brand-logo.png'
import { UserMenu } from '@/components/UserMenu'
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

type Tone = 'brand' | 'accent' | 'cta'

const MODULE_META: Record<Module, {
  label: string
  Icon: typeof Headphones
  tone: Tone
}> = {
  listening: { label: 'Listening', Icon: Headphones, tone: 'cta' },
  reading: { label: 'Reading', Icon: BookOpen, tone: 'brand' },
  writing: { label: 'Writing', Icon: PenLine, tone: 'accent' },
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

export default function PracticeListPage() {
  useEffect(() => {
    document.title = 'ILDIZmock — Practice'
  }, [])

  const stats = useQuery({
    queryKey: ['practice-stats'],
    queryFn: async () => (await api.get<PracticeStats>('/practice/stats/')).data,
  })

  const data = stats.data
  const modules: Module[] = ['listening', 'reading', 'writing']

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <div className="hidden items-center gap-3 md:flex">
              <BrandMark size={32} />
              <h1 className="text-lg font-extrabold tracking-tight">
                <span className="text-brand-900">Practice</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/practice/history"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <History className="h-4 w-4" /> History
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-8 py-10">
        {/* Hero */}
        <section
          className="relative overflow-hidden rounded-[24px] p-10 text-white"
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
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur">
              Practice mode
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
              Practice on your own time
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85">
              O'zingizga qulay vaqtda mashq qiling — javob bergandan keyin natijani va
              to'g'ri javoblarni darhol ko'rasiz.
            </p>
          </div>
        </section>

        {/* Module cards */}
        <section className="grid gap-5 md:grid-cols-3">
          {modules.map((m) => {
            const meta = MODULE_META[m]
            const s = data?.[m]
            return (
              <Link
                key={m}
                to={`/practice/${m}`}
                className="group rounded-[20px] border border-slate-100 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-brand-100"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <div className={`icon-tile icon-tile--${meta.tone}`}>
                  <meta.Icon className="h-7 w-7" />
                </div>
                <h3 className="mb-3 text-xl font-extrabold text-slate-900">{meta.label}</h3>
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Tests
                    </div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900">
                      {s?.tests_count ?? '—'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Attempts
                    </div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900">
                      {s?.attempts_count ?? 0}
                    </div>
                  </div>
                  <div className={`icon-tile icon-tile--${meta.tone} flex !mb-0 flex-col !rounded-xl !p-2.5`} style={{ width: 'auto', height: 'auto', marginBottom: 0 }}>
                    <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                      Best
                    </div>
                    <div className="mt-1 text-lg font-extrabold">
                      {s?.best_band != null ? s.best_band.toFixed(1) : '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end text-sm font-bold text-brand-600 transition-all group-hover:gap-1.5">
                  Start <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </Link>
            )
          })}
        </section>

        {/* Recent attempts */}
        <section>
          <h3 className="mb-4 text-lg font-extrabold text-slate-900">Recent practice</h3>
          {data?.recent && data.recent.length > 0 ? (
            <div
              className="overflow-hidden rounded-[20px] border border-slate-100 bg-white"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <ul className="divide-y divide-slate-100">
                {data.recent.map((r) => {
                  const meta = MODULE_META[r.module]
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className={`icon-tile icon-tile--${meta.tone} flex-shrink-0`}
                          style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 0 }}
                        >
                          <meta.Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900">
                            {r.test_name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {meta.label}
                            {r.submitted_at
                              ? ' · ' +
                                new Date(r.submitted_at).toLocaleString('uz-UZ', {
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
                        className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                      >
                        {r.band_score != null ? r.band_score.toFixed(1) : '—'}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div
              className="rounded-[20px] border-2 border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500"
            >
              No practice yet. Start with one of the modules above.
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
