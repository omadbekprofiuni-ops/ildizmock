import { useQuery } from '@tanstack/react-query'
import { BookOpen, Headphones, Lock, Mic, PenTool, X } from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Footer } from '@/components/Footer'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { guestAttempts, type GuestAttemptRecord } from '@/lib/guest-attempts'
import { useAuth } from '@/stores/auth'

type ModuleEntry = {
  id: 'listening' | 'reading' | 'writing' | 'speaking'
  title: string
  meta: string
  Icon: ComponentType<{ className?: string }>
  href: string
  authRequired?: boolean
  comingSoon?: boolean
}

const MODULES: ModuleEntry[] = [
  { id: 'listening', title: 'Listening', meta: '30 daqiqa · 4 qism · 40 savol', Icon: Headphones, href: '/tests/listening' },
  { id: 'reading', title: 'Reading', meta: '60 daqiqa · 3 qism · 40 savol', Icon: BookOpen, href: '/tests/reading' },
  { id: 'writing', title: 'Writing', meta: '60 daqiqa · 2 task', Icon: PenTool, href: '/tests/writing', authRequired: true },
  { id: 'speaking', title: 'Speaking', meta: '11–14 daqiqa · 3 qism', Icon: Mic, href: '/tests/speaking', comingSoon: true },
]

export default function HomePage() {
  const user = useAuth((s) => s.user)
  const [guestList, setGuestList] = useState<GuestAttemptRecord[]>([])
  useEffect(() => {
    document.title = 'IELTSation — Bosh sahifa'
    if (!user) setGuestList(guestAttempts.list())
  }, [user])

  const counts = useQuery({
    queryKey: ['tests-counts'],
    queryFn: async () => (await api.get<Record<string, number>>('/tests/counts/')).data,
  })

  return (
    <div className="flex min-h-screen flex-col bg-white text-[var(--text)]">
      <Navbar />
      <main className="container mx-auto max-w-6xl flex-1 px-4 py-12">
        {/* Hero */}
        <section className="py-12 text-center md:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
            IELTS testini haqiqiy formatda sinab ko‘ring
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--muted)] md:text-lg">
            Computer-delivered test interfeysi · 4 ta modul · Avtomatik baholash · Bepul boshlash
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={user ? '/tests/reading' : '/register'}>
              <Button size="lg" className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
                ▶ Bepul boshlash
              </Button>
            </Link>
            {!user && (
              <Link to="/login">
                <Button size="lg" variant="outline">Hisobingiz bormi?</Button>
              </Link>
            )}
          </div>
        </section>

        {/* 4 module cards */}
        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {MODULES.map(({ id, title, meta, Icon, href, authRequired, comingSoon }) => {
            const count = counts.data?.[id] ?? null
            const writingLocked = authRequired && !user
            const target = comingSoon ? '/tests/speaking' : (writingLocked ? '/register' : href)

            const inner = (
              <article className={`group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all ${comingSoon ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-black hover:shadow-lg'}`}>
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <Icon className="h-6 w-6" />
                  </div>
                  {comingSoon && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                      🚧 Tez kunda
                    </span>
                  )}
                  {writingLocked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <Lock className="h-3 w-3" /> Login kerak
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{meta}</p>
                <p className="mt-3 flex-1 text-xs text-[var(--muted)]">
                  {comingSoon
                    ? 'Speaking modul 2026 may oyida ishga tushadi'
                    : writingLocked
                      ? 'Ro‘yxatdan o‘tib, ustozdan tahlil oling'
                      : counts.isLoading
                        ? <span className="inline-block h-3 w-20 animate-pulse rounded bg-gray-200" />
                        : count !== null ? `${count} ta test mavjud` : ''}
                </p>
                <div className="mt-5">
                  {comingSoon ? (
                    <Button disabled className="w-full" variant="outline">Coming Soon</Button>
                  ) : writingLocked ? (
                    <Button className="w-full" variant="outline">Ro‘yxatdan o‘tish</Button>
                  ) : (
                    <Button className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
                      Boshlash →
                    </Button>
                  )}
                </div>
              </article>
            )
            return comingSoon ? (
              <Link key={id} to={target}>{inner}</Link>
            ) : (
              <Link key={id} to={target}>{inner}</Link>
            )
          })}
        </section>

        {/* Guest's anonymous attempts */}
        {!user && guestList.length > 0 && (
          <section className="mt-12 rounded-xl border border-gray-200 bg-gray-50 p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Sizning anonim urinishlaringiz</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Brauzerda saqlangan. Ro‘yxatdan o‘tsangiz tarixingiz hisobingizga bog‘lanadi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { guestAttempts.clear(); setGuestList([]) }}
                className="text-xs text-[var(--muted)] hover:underline"
              >
                <X className="mr-1 inline h-3 w-3" /> Tozalash
              </button>
            </div>
            <ul className="divide-y divide-gray-200">
              {guestList.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{g.test_name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {g.module} · {new Date(g.started_at).toLocaleDateString('uz-UZ')} ·{' '}
                      {g.status === 'graded' ? 'Topshirilgan' : 'Davom etmoqda'}
                    </div>
                  </div>
                  <Link
                    to={g.status === 'in_progress' ? `/take/${g.id}` : `/result/${g.id}`}
                  >
                    <Button variant="outline" size="sm">
                      {g.status === 'in_progress' ? 'Davom etish' : 'Natija'}
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Features */}
        <section className="mt-16 border-t border-[var(--border)] py-12 text-center">
          <h2 className="mb-6 text-2xl font-semibold">Nima bu IELTSation?</h2>
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="text-sm">
              <span className="text-emerald-600">✓</span>{' '}
              <strong>Haqiqiy IELTS qoidalari</strong>
              <p className="mt-1 text-[var(--muted)]">Cambridge formatida, fullscreen, vaqt qatʼiy</p>
            </div>
            <div className="text-sm">
              <span className="text-emerald-600">✓</span>{' '}
              <strong>Avtomatik baholash</strong>
              <p className="mt-1 text-[var(--muted)]">Reading va Listening — band score zudlik bilan</p>
            </div>
            <div className="text-sm">
              <span className="text-emerald-600">✓</span>{' '}
              <strong>O‘zbek tilida UI</strong>
              <p className="mt-1 text-[var(--muted)]">Test mazmuni inglizcha, interfeys o‘zbekcha</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
