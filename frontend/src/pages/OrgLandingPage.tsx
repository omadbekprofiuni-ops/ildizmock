import { useQuery } from '@tanstack/react-query'
import { BookOpen, Headphones, Mic, PenTool } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

type Org = {
  name: string
  slug: string
  primary_color: string
  logo: string | null
}

const MODULES = [
  { id: 'listening', title: 'Listening', meta: '30 daq · 4 parts · 40 questions', Icon: Headphones },
  { id: 'reading', title: 'Reading', meta: '60 daq · 3 parts · 40 questions', Icon: BookOpen },
  { id: 'writing', title: 'Writing', meta: '60 daq · 2 tasks', Icon: PenTool },
  { id: 'speaking', title: 'Speaking', meta: '11–14 daq · 3 parts', Icon: Mic, comingSoon: true },
]

export default function OrgLandingPage() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuth((s) => s.user)

  const q = useQuery({
    queryKey: ['org', slug],
    queryFn: async () => (await api.get<Org>(`/public/organizations/${slug}/`)).data,
    enabled: !!slug,
  })

  useEffect(() => {
    if (q.data?.primary_color) {
      document.documentElement.style.setProperty('--accent', q.data.primary_color)
    }
    if (q.data?.name) {
      document.title = `${q.data.name} — IELTS Mock`
    }
    return () => {
      // restore default brand on unmount
      document.documentElement.style.setProperty('--accent', '#DC2626')
    }
  }, [q.data])

  if (q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }
  if (q.isError || !q.data) {
    return <Navigate to="/" replace />
  }
  const org = q.data

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img
              src="/ildizmock-logo.png"
              alt="ILDIZmock"
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-bold tracking-tight">ILDIZmock</span>
            <span className="text-slate-300">×</span>
            {org.logo ? (
              <img src={org.logo} alt={org.name} className="h-8" />
            ) : (
              <span className="font-semibold" style={{ color: org.primary_color }}>
                {org.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/home"><Button variant="outline" size="sm">Dashboard</Button></Link>
            ) : (
              <Link to={`/login?center=${slug}`}>
                <Button
                  size="sm"
                  className="text-white hover:opacity-90"
                  style={{ backgroundColor: org.primary_color }}
                >
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl flex-1 px-4 py-12">
        <section className="py-12 text-center md:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
            Welcome to {org.name}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--muted)] md:text-lg">
            Practice IELTS in real exam format. Sign in with the credentials provided
            by your center administrator.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!user && (
              <Link to={`/login?center=${slug}`}>
                <Button
                  size="lg"
                  className="text-white hover:opacity-90"
                  style={{ backgroundColor: org.primary_color }}
                >
                  Sign In to Practice
                </Button>
              </Link>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ id, title, meta, Icon, comingSoon }) => (
            <Card key={id} className={comingSoon ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="mb-3 inline-flex rounded-lg border bg-slate-50 p-3">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{meta}</p>
                {comingSoon && (
                  <p className="mt-2 text-xs font-medium text-orange-700">🚧 Coming soon</p>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
      <footer className="border-t border-[var(--border)] bg-white">
        <div className="container mx-auto max-w-6xl px-4 py-6 text-center text-sm text-[var(--muted)]">
          © 2026 {org.name} · Powered by ILDIZmock
        </div>
      </footer>
    </div>
  )
}
