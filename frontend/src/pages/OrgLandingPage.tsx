import { useQuery } from '@tanstack/react-query'
import { BookOpen, Headphones, Mic, PenTool, Play } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

type Org = {
  name: string
  slug: string
  primary_color: string
  logo: string | null
}

type Tone = 'brand' | 'accent' | 'cta' | 'slate'

const MODULES: Array<{
  id: string
  title: string
  meta: string
  Icon: typeof Headphones
  tone: Tone
  comingSoon?: boolean
}> = [
  { id: 'reading', title: 'Reading', meta: '60 min · 3 parts · 40 questions', Icon: BookOpen, tone: 'brand' },
  { id: 'listening', title: 'Listening', meta: '30 min · 4 parts · 40 questions', Icon: Headphones, tone: 'cta' },
  { id: 'writing', title: 'Writing', meta: '60 min · 2 tasks', Icon: PenTool, tone: 'accent' },
  { id: 'speaking', title: 'Speaking', meta: '11–14 min · 3 parts', Icon: Mic, tone: 'slate', comingSoon: true },
]

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
      document.documentElement.style.setProperty('--accent', '#2563EB')
    }
  }, [q.data])

  if (q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }
  if (q.isError || !q.data) {
    return <Navigate to="/" replace />
  }
  const org = q.data
  const orgColor = org.primary_color || '#2563EB'

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <span className="text-lg font-extrabold tracking-tight">
              <span className="text-brand-900">ILDIZ</span>
              <span className="text-teal-600">mock</span>
            </span>
            <span className="mx-1 text-slate-300">×</span>
            {org.logo ? (
              <img src={org.logo} alt={org.name} className="h-8 object-contain" />
            ) : (
              <span className="font-extrabold tracking-tight" style={{ color: orgColor }}>
                {org.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link
                to="/home"
                className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:border-brand-300 hover:text-brand-700"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to={`/login?center=${slug}`}
                className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(37,99,235,0.25)]"
                style={{ background: orgColor }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="hero-bg" />
        {/* Hero */}
        <section className="relative px-8 pb-12 pt-20 text-center md:pt-28">
          <div className="mx-auto max-w-3xl">
            <div className="eyebrow">
              <span className="eyebrow__dot" />
              {org.name}
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-[56px] md:leading-[1.05]">
              Welcome to <span className="gradient-text">{org.name}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600">
              Practice IELTS in real exam format. Sign in with the credentials provided
              by your center administrator.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {!user && (
                <Link
                  to={`/login?center=${slug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-4 text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(37,99,235,0.25)]"
                  style={{ background: orgColor }}
                >
                  <Play className="h-5 w-5" />
                  Sign In to Practice
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Modules */}
        <section className="relative px-8 pb-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map(({ id, title, meta, Icon, tone, comingSoon }) => (
                <div
                  key={id}
                  className={`rounded-[20px] border border-slate-100 bg-white p-7 transition-all ${
                    comingSoon
                      ? 'cursor-not-allowed opacity-70'
                      : 'hover:-translate-y-0.5 hover:border-brand-100'
                  }`}
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  <div className={`icon-tile icon-tile--${tone}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-xs text-slate-500">{meta}</p>
                  {comingSoon && (
                    <p className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      Coming soon
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-8 py-7 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} {org.name} · Powered by ILDIZmock
        </div>
      </footer>
    </div>
  )
}
