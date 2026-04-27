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
  { id: 'listening', title: 'Listening', meta: '30 min · 4 parts · 40 questions', Icon: Headphones, href: '/tests/listening' },
  { id: 'reading', title: 'Reading', meta: '60 min · 3 parts · 40 questions', Icon: BookOpen, href: '/tests/reading' },
  { id: 'writing', title: 'Writing', meta: '60 min · 2 tasks', Icon: PenTool, href: '/tests/writing', authRequired: true },
  { id: 'speaking', title: 'Speaking', meta: '11–14 min · 3 parts', Icon: Mic, href: '/tests/speaking', comingSoon: true },
]

export default function HomePage() {
  const user = useAuth((s) => s.user)
  const [guestList, setGuestList] = useState<GuestAttemptRecord[]>([])
  useEffect(() => {
    document.title = 'ILDIZmock — Home'
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
            Practice IELTS in real exam format
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--muted)] md:text-lg">
            Computer-delivered tests · 4 modules · Automatic scoring · Start free
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={user ? '/tests/reading' : '/login'}>
              <Button size="lg" className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
                ▶ Start free
              </Button>
            </Link>
            {!user && (
              <Link to="/login">
                <Button size="lg" variant="outline">Have an account?</Button>
              </Link>
            )}
          </div>
        </section>

        {/* 4 module cards */}
        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {MODULES.map(({ id, title, meta, Icon, href, authRequired, comingSoon }) => {
            const count = counts.data?.[id] ?? null
            const writingLocked = authRequired && !user
            const target = comingSoon ? '/tests/speaking' : (writingLocked ? '/login' : href)

            const inner = (
              <article className={`group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all ${comingSoon ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-black hover:shadow-lg'}`}>
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <Icon className="h-6 w-6" />
                  </div>
                  {comingSoon && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                      🚧 Coming soon
                    </span>
                  )}
                  {writingLocked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <Lock className="h-3 w-3" /> Login required
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{meta}</p>
                <p className="mt-3 flex-1 text-xs text-[var(--muted)]">
                  {comingSoon
                    ? 'Speaking module launches May 2026'
                    : writingLocked
                      ? 'Sign up for teacher feedback'
                      : counts.isLoading
                        ? <span className="inline-block h-3 w-20 animate-pulse rounded bg-gray-200" />
                        : count !== null ? `${count} tests available` : ''}
                </p>
                <div className="mt-5">
                  {comingSoon ? (
                    <Button disabled className="w-full" variant="outline">Coming Soon</Button>
                  ) : writingLocked ? (
                    <Button className="w-full" variant="outline">Sign In</Button>
                  ) : (
                    <Button className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
                      Start →
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
                <h2 className="text-lg font-semibold">Your anonymous attempts</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Saved in your browser. Sign up to link to your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { guestAttempts.clear(); setGuestList([]) }}
                className="text-xs text-[var(--muted)] hover:underline"
              >
                <X className="mr-1 inline h-3 w-3" /> Clear
              </button>
            </div>
            <ul className="divide-y divide-gray-200">
              {guestList.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{g.test_name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {g.module} · {new Date(g.started_at).toLocaleDateString('uz-UZ')} ·{' '}
                      {g.status === 'graded' ? 'Submitted' : 'In progress'}
                    </div>
                  </div>
                  <Link
                    to={g.status === 'in_progress' ? `/take/${g.id}` : `/result/${g.id}`}
                  >
                    <Button variant="outline" size="sm">
                      {g.status === 'in_progress' ? 'Continue' : 'Result'}
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Features */}
        <section className="mt-16 border-t border-[var(--border)] py-12 text-center">
          <h2 className="mb-6 text-2xl font-semibold">What is ILDIZmock?</h2>
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="text-sm">
              <span className="text-emerald-600">✓</span>{' '}
              <strong>Real IELTS rules</strong>
              <p className="mt-1 text-[var(--muted)]">Cambridge format, fullscreen, strict timing</p>
            </div>
            <div className="text-sm">
              <span className="text-emerald-600">✓</span>{' '}
              <strong>Automatic scoring</strong>
              <p className="mt-1 text-[var(--muted)]">Reading and Listening — instant band score</p>
            </div>
            <div className="text-sm">
              <span className="text-emerald-600">✓</span>{' '}
              <strong>Built for Uzbek learners</strong>
              <p className="mt-1 text-[var(--muted)]">English test content, localized interface</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
