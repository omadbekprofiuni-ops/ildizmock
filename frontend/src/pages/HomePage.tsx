import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  BookOpen,
  Clock,
  Headphones,
  Lock,
  Mic,
  Monitor,
  PenTool,
  Play,
  X,
  Zap,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PublicLayout } from '@/components/public/PublicLayout'
import { api } from '@/lib/api'
import { guestAttempts, type GuestAttemptRecord } from '@/lib/guest-attempts'
import { useAuth } from '@/stores/auth'

type ModuleId = 'listening' | 'reading' | 'writing' | 'speaking'

interface ModuleEntry {
  id: ModuleId
  titleKey: string
  descriptionKey: string
  Icon: ComponentType<{ className?: string }>
  href: string
  tone: 'brand' | 'accent' | 'cta' | 'slate'
  authRequired?: boolean
  comingSoon?: boolean
}

const MODULES: ModuleEntry[] = [
  {
    id: 'reading',
    titleKey: 'practice.reading.title',
    descriptionKey: 'practice.reading.description',
    Icon: BookOpen,
    href: '/tests/reading',
    tone: 'brand',
  },
  {
    id: 'writing',
    titleKey: 'practice.writing.title',
    descriptionKey: 'practice.writing.description',
    Icon: PenTool,
    href: '/tests/writing',
    tone: 'accent',
    authRequired: true,
  },
  {
    id: 'listening',
    titleKey: 'practice.listening.title',
    descriptionKey: 'practice.listening.description',
    Icon: Headphones,
    href: '/tests/listening',
    tone: 'cta',
  },
  {
    id: 'speaking',
    titleKey: 'practice.speaking.title',
    descriptionKey: 'practice.speaking.description',
    Icon: Mic,
    href: '/tests/speaking',
    tone: 'slate',
    comingSoon: true,
  },
]

interface FeatureEntry {
  Icon: ComponentType<{ className?: string }>
  titleKey: string
  descriptionKey: string
  tone: 'brand' | 'accent' | 'cta'
}

const FEATURES: FeatureEntry[] = [
  {
    Icon: Monitor,
    titleKey: 'home.features.authentic.title',
    descriptionKey: 'home.features.authentic.description',
    tone: 'brand',
  },
  {
    Icon: Clock,
    titleKey: 'home.features.timing.title',
    descriptionKey: 'home.features.timing.description',
    tone: 'accent',
  },
  {
    Icon: Zap,
    titleKey: 'home.features.scoring.title',
    descriptionKey: 'home.features.scoring.description',
    tone: 'cta',
  },
  {
    Icon: BarChart3,
    titleKey: 'home.features.tracking.title',
    descriptionKey: 'home.features.tracking.description',
    tone: 'brand',
  },
]

const STEPS = [
  {
    num: '1',
    tone: 'brand' as const,
    title: 'Sign Up Free',
    desc: 'Create your account in 30 seconds — no card, no hassle.',
  },
  {
    num: '2',
    tone: 'accent' as const,
    title: 'Pick a Module',
    desc: 'Reading, Listening, Writing, or Speaking — start with what you need most.',
  },
  {
    num: '3',
    tone: 'cta' as const,
    title: 'Get Your Band',
    desc: 'Submit and receive a detailed score breakdown with a study plan.',
  },
]

const STATS = [
  { v: '1,247', l: 'Active Students' },
  { v: '38,000+', l: 'Tests Taken' },
  { v: '6.8 → 7.4', l: 'Avg. Band Improvement' },
  { v: '98%', l: 'Recommend ILDIZmock' },
]

const TRUST = [
  'Authentic Cambridge format',
  'Works on any device',
  'No card required',
]

export default function HomePage() {
  const { t } = useTranslation()
  const user = useAuth((s) => s.user)
  const [guestList, setGuestList] = useState<GuestAttemptRecord[]>([])

  useEffect(() => {
    document.title = 'ILDIZmock — Real Computer-Delivered IELTS Practice'
    if (!user) setGuestList(guestAttempts.list())
  }, [user])

  const counts = useQuery({
    queryKey: ['tests-counts'],
    queryFn: async () => (await api.get<Record<string, number>>('/tests/counts/')).data,
  })

  return (
    <PublicLayout>
      {/* ── HERO (ILDIZmock split layout) ── */}
      <section className="relative overflow-hidden px-8 pb-20 pt-16">
        <div className="hero-bg" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            {/* Left — bold IELTS exam title (rounded brand blocks) */}
            <div>
              <div className="eyebrow">
                <span className="eyebrow__dot eyebrow__dot--pulse" />
                Computer-Delivered IELTS · Instant Score
              </div>

              <h1 className="mt-5 text-[44px] font-extrabold uppercase leading-[0.95] tracking-tight text-slate-900 md:text-6xl lg:text-[78px]">
                Prepare
                <br />
                for the
                <br />
                <span className="mt-4 inline-flex flex-wrap items-center gap-2.5">
                  <span
                    className="inline-block rounded-2xl px-4 py-1.5 text-white"
                    style={{ background: 'var(--gradient-brand)' }}
                  >
                    IELTS
                  </span>
                  <span className="inline-block rounded-2xl bg-slate-900 px-4 py-1.5 text-white">
                    Exam
                  </span>
                </span>
              </h1>

              {/* Accent underline — adds visual identity, breaks Examy parity */}
              <div className="mt-5 flex items-center gap-3">
                <span
                  className="h-1.5 w-20 rounded-full"
                  style={{ background: 'var(--gradient-brand)' }}
                />
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Practice · Score · Improve
                </span>
              </div>

              <div
                className="mt-8 inline-flex flex-col gap-1 rounded-2xl border border-slate-100 bg-white px-5 py-4"
                style={{ boxShadow: 'var(--shadow-md)' }}
              >
                <p className="text-sm font-semibold text-slate-700">
                  Trusted by{' '}
                  <span className="font-extrabold text-brand-600">1,200+</span> Uzbek students
                </p>
                <p className="text-xs text-slate-500">
                  someone registered{' '}
                  <span className="font-semibold text-emerald-600">31 minutes</span> ago
                </p>
              </div>
            </div>

            {/* Right — pitch card + CTAs + trust signals */}
            <div className="relative">
              {/* Decorative gradient blob */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-20 blur-3xl"
                style={{ background: 'var(--gradient-brand)' }}
              />

              <div
                className="relative rounded-3xl border border-slate-100 bg-white p-8"
                style={{ boxShadow: 'var(--shadow-lg)' }}
              >
                <p className="text-2xl leading-relaxed text-slate-800 md:text-[26px]">
                  Take a Mock Test and get your IELTS Score for{' '}
                  <span className="font-extrabold text-slate-900">FREE</span>{' '}
                  within{' '}
                  <span
                    className="inline-block bg-clip-text font-extrabold text-transparent"
                    style={{ backgroundImage: 'var(--gradient-brand)' }}
                  >
                    60 seconds
                  </span>
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3.5">
                  <Link
                    to={user ? '/practice' : '/tests/reading'}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cta-500 px-7 py-4 text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(239,68,68,0.25)]"
                  >
                    <Play className="h-5 w-5" />
                    {t('home.hero.cta') || 'Start Practice Test'}
                  </Link>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-700 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {t('nav.pricing')}
                  </Link>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-slate-500">
                  {TRUST.map((label) => (
                    <span key={label} className="inline-flex items-center gap-2">
                      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-teal-50 text-teal-600">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating preview screenshot */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
            style={{ boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Browser chrome */}
            <div className="flex h-9 items-center gap-2 border-b border-slate-200 bg-slate-100 px-4">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              </div>
              <div
                className="ml-3 rounded bg-white px-3 py-1 text-[11px] text-slate-500"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                ildizmock.uz/tests/reading/practice
              </div>
            </div>

            {/* Mock test runner */}
            <div className="grid min-h-[380px] grid-cols-1 md:grid-cols-2">
              <div className="border-b border-slate-100 p-8 md:border-b-0 md:border-r">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
                  Reading · Passage 1
                </div>
                <h3 className="mb-3.5 text-[22px] font-extrabold text-slate-900">
                  The History of Glass-making in Uzbekistan
                </h3>
                <p className="mb-2.5 text-[13.5px] leading-relaxed text-slate-600">
                  Glass-making has a long and storied history in Central Asia, stretching back over a millennium. Archaeological excavations near Khwarazm have uncovered{' '}
                  <span style={{ background: 'var(--accent-100)' }}>fragments of glass vessels</span> dating from the 9th century, demonstrating the sophistication of medieval Uzbek artisans.
                </p>
                <p className="text-[13.5px] leading-relaxed text-slate-600">
                  By the time of the Timurid dynasty, glass-blowing workshops in Samarkand were producing pieces of remarkable...
                </p>
              </div>
              <div className="bg-slate-50 p-8">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Questions 1–5
                </div>
                <div className="mb-2.5 rounded-xl border-2 border-brand-500 bg-white p-4">
                  <div className="mb-2.5 text-[13px] font-bold">
                    1. Glass-making in Uzbekistan dates back to the…
                  </div>
                  {['9th century', '12th century', '15th century', '17th century'].map((opt, i) => (
                    <label key={opt} className="flex items-center gap-2 py-1.5 text-[13px] text-slate-700">
                      <input
                        type="radio"
                        name="hp-q1"
                        defaultChecked={i === 0}
                        style={{ accentColor: 'var(--brand-600)' }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="text-[13px] font-bold text-slate-500">
                    2. Workshops in Samarkand were known for…
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating timer chip */}
          <div
            className="absolute -right-3 top-[60px] hidden items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 md:flex"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <span className="icon-tile icon-tile--cta" style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 0 }}>
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[11px] font-bold text-slate-500">TIME REMAINING</div>
              <div className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-mono)' }}>
                52:14
              </div>
            </div>
          </div>

          {/* Floating score chip */}
          <div
            className="absolute -left-4 bottom-8 hidden items-center gap-3.5 rounded-2xl border border-slate-100 bg-white p-4 md:flex"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-extrabold tracking-tight text-white"
              style={{ background: 'var(--gradient-brand)' }}
            >
              7.5
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500">YOUR LATEST BAND</div>
              <div className="text-[13px] font-bold text-slate-900">Reading · +0.5 since last week</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-slate-50 px-8 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="eyebrow eyebrow--accent">
              <span className="eyebrow__dot eyebrow__dot--accent" />
              Why ILDIZmock
            </div>
            <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">
              {t('home.features.title')}
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-slate-600">
              {t('home.features.subtitle')}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ Icon, titleKey, descriptionKey, tone }) => (
              <div
                key={titleKey}
                className="rounded-[20px] border border-slate-100 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-brand-100"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <div className={`icon-tile icon-tile--${tone}`}>
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2.5 text-[18px] font-extrabold text-slate-900">{t(titleKey)}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{t(descriptionKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRACTICE MODULES ── */}
      <section className="px-8 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
              {t('practice.title')}
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-slate-600">
              {t('practice.subtitle')}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((mod) => {
              const count = counts.data?.[mod.id] ?? null
              const writingLocked = mod.authRequired && !user
              const target = mod.comingSoon
                ? '/tests/speaking'
                : writingLocked
                  ? '/login'
                  : mod.href

              const card = (
                <div
                  className={`group h-full rounded-[20px] border border-slate-100 bg-white p-7 transition-all ${
                    mod.comingSoon
                      ? 'cursor-not-allowed opacity-70'
                      : 'cursor-pointer hover:-translate-y-0.5 hover:border-brand-100'
                  }`}
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  <div className={`icon-tile icon-tile--${mod.tone}`}>
                    <mod.Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-2 text-[18px] font-extrabold text-slate-900">
                    {t(mod.titleKey)}
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed text-slate-600">
                    {t(mod.descriptionKey)}
                  </p>
                  <div className="flex items-center justify-between">
                    {mod.comingSoon ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        {t('common.comingSoon')}
                      </span>
                    ) : writingLocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                        <Lock className="h-3 w-3" /> Login
                      </span>
                    ) : counts.isLoading ? (
                      <span className="inline-block h-4 w-20 animate-pulse rounded bg-slate-200" />
                    ) : count !== null ? (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {count} tests
                      </span>
                    ) : (
                      <span />
                    )}
                    {!mod.comingSoon && (
                      <span className="text-sm font-bold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                        Start →
                      </span>
                    )}
                  </div>
                </div>
              )

              return mod.comingSoon ? (
                <div key={mod.id}>{card}</div>
              ) : (
                <Link key={mod.id} to={target}>
                  {card}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-slate-50 px-8 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">How it works</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-slate-600">
              Three steps from signup to band score. No long onboarding.
            </p>
          </div>
          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* dotted connector */}
            <div
              className="absolute hidden h-0.5 md:block"
              style={{
                top: 36,
                left: '16.66%',
                right: '16.66%',
                background:
                  'repeating-linear-gradient(to right, var(--slate-300) 0 6px, transparent 6px 12px)',
              }}
            />
            {STEPS.map((s) => {
              const colorMap: Record<string, string> = {
                brand: 'var(--brand-600)',
                accent: 'var(--accent-600)',
                cta: 'var(--cta-500)',
              }
              const bgMap: Record<string, string> = {
                brand: 'var(--brand-50)',
                accent: 'var(--accent-50)',
                cta: 'var(--cta-50)',
              }
              return (
                <div key={s.num} className="relative text-center">
                  <div
                    className="relative z-[2] mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border-4 border-white text-3xl font-extrabold tracking-tight"
                    style={{
                      background: bgMap[s.tone],
                      color: colorMap[s.tone],
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    {s.num}
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold text-slate-900">{s.title}</h3>
                  <p className="mx-auto mt-2.5 max-w-[280px] text-[14.5px] leading-relaxed text-slate-600">
                    {s.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="px-8 pt-24">
        <div className="mx-auto max-w-7xl">
          <div
            className="relative overflow-hidden rounded-[28px] px-12 py-14 text-white"
            style={{ background: 'var(--gradient-hero)' }}
          >
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="relative grid grid-cols-2 gap-8 md:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.l}>
                  <div className="text-[44px] font-extrabold leading-none tracking-tight">{s.v}</div>
                  <div className="mt-1.5 text-[13px] font-semibold tracking-wide opacity-80">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Guest attempts */}
      {!user && guestList.length > 0 && (
        <section className="px-8 py-12">
          <div className="mx-auto max-w-4xl rounded-[20px] border border-slate-100 bg-white p-7" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Your anonymous attempts</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Saved in your browser. Sign up to link them to your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  guestAttempts.clear()
                  setGuestList([])
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-700 hover:underline"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
            <ul className="divide-y divide-slate-200">
              {guestList.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {g.test_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {g.module} · {new Date(g.started_at).toLocaleDateString('en-US')} ·{' '}
                      {g.status === 'graded' ? 'Submitted' : 'In progress'}
                    </div>
                  </div>
                  <Link
                    to={g.status === 'in_progress' ? `/take/${g.id}` : `/result/${g.id}`}
                    className="rounded-lg border-2 border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    {g.status === 'in_progress' ? 'Continue' : 'Result'}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA ── */}
      <section className="px-8 py-24">
        <div className="mx-auto max-w-7xl">
          <div
            className="relative overflow-hidden rounded-[32px] px-12 py-20 text-center text-white"
            style={{ background: 'var(--gradient-hero)' }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                {t('home.cta.title')}
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/85">
                {t('home.cta.subtitle')}
              </p>
              <Link
                to={user ? '/practice' : '/tests/reading'}
                className="mt-9 inline-flex items-center justify-center gap-2 rounded-2xl bg-cta-500 px-8 py-[18px] text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(239,68,68,0.35)]"
              >
                <Play className="h-5 w-5" />
                {t('home.cta.button')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
