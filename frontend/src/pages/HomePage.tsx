import { useQuery } from '@tanstack/react-query'
import { BookOpen, Headphones, Mic, Pen } from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

type ModuleEntry = {
  id: 'listening' | 'reading' | 'writing' | 'speaking'
  title: string
  description: string
  Icon: ComponentType<{ className?: string }>
  comingSoon?: boolean
  href: string
}

const MODULES: ModuleEntry[] = [
  { id: 'listening', title: 'Listening', description: 'Audio + savol-javob.', Icon: Headphones, href: '/tests/listening' },
  { id: 'reading', title: 'Reading', description: 'Akademik passage savollari.', Icon: BookOpen, href: '/tests/reading' },
  { id: 'writing', title: 'Writing', description: 'Inshe + ustoz tahlili.', Icon: Pen, href: '/tests/writing' },
  { id: 'speaking', title: 'Speaking', description: 'AI bilan suhbat (tez kunda).', Icon: Mic, comingSoon: true, href: '/tests/speaking' },
]

export default function HomePage() {
  const user = useAuth((s) => s.user)
  useEffect(() => { document.title = 'IELTSation — Bosh sahifa' }, [])

  const counts = useQuery({
    queryKey: ['tests-counts'],
    queryFn: async () => (await api.get<Record<string, number>>('/tests/counts/')).data,
  })

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">IELTSation</h1>
          <UserMenu />
        </div>
      </header>

      <main className="container py-12">
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight">
            Salom, {user?.first_name}
          </h2>
          <p className="mt-1 text-[var(--muted)]">Qaysi modulni sinaymiz?</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ id, title, description, Icon, comingSoon, href }) => {
            const count = counts.data?.[id] ?? null
            return (
              <Link key={id} to={href} className="block">
                <article className="group flex h-full flex-col rounded-lg border border-[var(--border)] bg-white p-6 transition-shadow hover:border-slate-400 hover:shadow-md">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="rounded-md border border-[var(--border)] bg-slate-50 p-2.5">
                      <Icon className="h-5 w-5" />
                    </div>
                    {comingSoon && (
                      <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                        Tez kunda
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-[var(--muted)]">
                      {counts.isLoading ? (
                        <span className="inline-block h-3 w-14 animate-pulse rounded bg-slate-200" />
                      ) : count !== null ? (
                        `${count} ta test`
                      ) : ''}
                    </span>
                    <span className="text-sm font-medium text-[var(--accent)] group-hover:underline">
                      {comingSoon ? 'Bilib oling →' : 'Boshlash →'}
                    </span>
                  </div>
                </article>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
