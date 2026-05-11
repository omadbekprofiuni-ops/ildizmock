import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  AudioLines,
  Building2,
  Clock,
  Feather,
  Gauge,
  Laptop,
  Library,
  Lock,
  MicVocal,
  Play,
  Timer,
  TrendingUp,
  User as UserIcon,
  X,
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
    Icon: Library,
    href: '/tests/reading',
    tone: 'brand',
  },
  {
    id: 'writing',
    titleKey: 'practice.writing.title',
    descriptionKey: 'practice.writing.description',
    Icon: Feather,
    href: '/tests/writing',
    tone: 'accent',
    authRequired: true,
  },
  {
    id: 'listening',
    titleKey: 'practice.listening.title',
    descriptionKey: 'practice.listening.description',
    Icon: AudioLines,
    href: '/tests/listening',
    tone: 'cta',
  },
  {
    id: 'speaking',
    titleKey: 'practice.speaking.title',
    descriptionKey: 'practice.speaking.description',
    Icon: MicVocal,
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
    Icon: Laptop,
    titleKey: 'home.features.authentic.title',
    descriptionKey: 'home.features.authentic.description',
    tone: 'brand',
  },
  {
    Icon: Timer,
    titleKey: 'home.features.timing.title',
    descriptionKey: 'home.features.timing.description',
    tone: 'accent',
  },
  {
    Icon: Gauge,
    titleKey: 'home.features.scoring.title',
    descriptionKey: 'home.features.scoring.description',
    tone: 'cta',
  },
  {
    Icon: TrendingUp,
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
      {/* ── HERO (centered, full-width feel) ── */}
      <section className="relative overflow-hidden px-8 pb-20 pt-20">
        <div className="hero-bg" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="eyebrow mx-auto hero-anim" style={{ animationDelay: '0ms' }}>
            <span className="eyebrow__dot eyebrow__dot--pulse" />
            Computer-Delivered IELTS · Instant Score
          </div>

          <h1 className="mt-7 text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-slate-900 md:text-6xl lg:text-[78px]">
            <span className="hero-anim inline-block" style={{ animationDelay: '120ms' }}>
              Prepare for the
            </span>
            <br />
            <span className="mt-4 inline-flex flex-wrap items-center justify-center gap-2.5">
              <span
                className="hero-anim-left inline-block rounded-2xl px-4 py-1.5 text-white"
                style={{
                  background: 'var(--gradient-brand)',
                  animationDelay: '320ms',
                }}
              >
                IELTS
              </span>
              <span
                className="hero-anim-right inline-block rounded-2xl bg-slate-900 px-4 py-1.5 text-white"
                style={{ animationDelay: '420ms' }}
              >
                Exam
              </span>
            </span>
          </h1>

          {/* Accent underline — adds visual identity */}
          <div
            className="hero-anim-grow mt-6 flex items-center justify-center gap-3"
            style={{ animationDelay: '600ms' }}
          >
            <span
              className="h-1.5 w-20 rounded-full"
              style={{ background: 'var(--gradient-brand)' }}
            />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Practice · Score · Improve
            </span>
            <span
              className="h-1.5 w-20 rounded-full"
              style={{ background: 'var(--gradient-brand)' }}
            />
          </div>

          <p
            className="hero-anim mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-[19px]"
            style={{ animationDelay: '750ms' }}
          >
            Take a Mock Test and get your IELTS Score for{' '}
            <span className="font-extrabold text-slate-900">FREE</span> within{' '}
            <span
              className="inline-block bg-clip-text font-extrabold text-transparent"
              style={{ backgroundImage: 'var(--gradient-brand)' }}
            >
              60 seconds
            </span>
            . Authentic Cambridge format with real timing and instant scoring.
          </p>

          <div
            className="hero-anim mt-10 flex flex-wrap items-center justify-center gap-3.5"
            style={{ animationDelay: '900ms' }}
          >
            <Link
              to={user ? '/practice' : '/tests/reading'}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cta-500 px-7 py-4 text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_10px_24px_rgba(20,184,152,0.40)]"
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

          {/* Trust signals row */}
          <div
            className="hero-anim mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-slate-500"
            style={{ animationDelay: '1050ms' }}
          >
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

          {/* Trusted by pill — bottom of hero */}
          <div
            className="hero-anim mx-auto mt-10 inline-flex flex-col gap-1 rounded-2xl border border-slate-100 bg-white px-5 py-3 text-left"
            style={{
              boxShadow: 'var(--shadow-md)',
              animationDelay: '1200ms',
            }}
          >
            <p className="text-sm font-semibold text-slate-700">
              Trusted by{' '}
              <span className="font-extrabold text-brand-600">1,200+</span> Uzbek students
            </p>
            <p className="text-xs text-slate-500">
              someone registered{' '}
              <span className="font-semibold text-teal-600">31 minutes</span> ago
            </p>
          </div>
        </div>

        {/* Floating preview screenshots — Reading + Listening side by side */}
        <div className="relative mx-auto mt-16 max-w-7xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            {/* ─── READING SCREEN ─── */}
            <div
              className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white"
              style={{ boxShadow: 'var(--shadow-xl)' }}
            >
              {/* Browser chrome */}
              <div className="flex h-10 items-center gap-2 border-b border-slate-200 bg-slate-100 px-4">
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

              {/* Mock test runner — passage / questions */}
              <div className="grid min-h-[460px] grid-cols-1 md:grid-cols-2">
                <div className="border-b border-slate-100 p-7 md:border-b-0 md:border-r">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
                    Reading · Passage 1
                  </div>
                  <h3 className="mb-3.5 text-[22px] font-extrabold leading-tight text-slate-900">
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
                <div className="bg-slate-50 p-7">
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

              {/* Floating timer chip — inside Reading frame, top right */}
              <div
                className="absolute right-3 top-14 hidden items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 md:flex"
                style={{ boxShadow: 'var(--shadow-lg)' }}
              >
                <span className="icon-tile icon-tile--cta" style={{ width: 38, height: 38, borderRadius: 12, marginBottom: 0 }}>
                  <Clock className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-[11px] font-bold text-slate-500">TIME REMAINING</div>
                  <div className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-mono)' }}>
                    52:14
                  </div>
                </div>
              </div>
            </div>

            {/* ─── LISTENING SCREEN ─── */}
            <div
              className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white"
              style={{ boxShadow: 'var(--shadow-xl)' }}
            >
              {/* Browser chrome */}
              <div className="flex h-10 items-center gap-2 border-b border-slate-200 bg-slate-100 px-4">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                </div>
                <div
                  className="ml-3 rounded bg-white px-3 py-1 text-[11px] text-slate-500"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  ildizmock.uz/tests/listening/practice
                </div>
              </div>

              {/* Mock test runner — audio player / questions */}
              <div className="grid min-h-[460px] grid-cols-1 md:grid-cols-2">
                <div className="border-b border-slate-100 p-7 md:border-b-0 md:border-r">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-teal-600">
                    Listening · Section 1
                  </div>
                  <h3 className="mb-4 text-[22px] font-extrabold leading-tight text-slate-900">
                    Booking a Conference Room
                  </h3>

                  {/* Audio player */}
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                    <div className="mb-2.5 flex items-center gap-3">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                        style={{ background: 'var(--gradient-brand)' }}
                      >
                        <Play className="h-4 w-4" fill="white" />
                      </button>
                      <div className="flex-1">
                        <div className="text-[12px] font-bold text-slate-900">
                          Section 1 · Cambridge 19
                        </div>
                        <div className="text-[10.5px] text-slate-500">
                          Plays once · auto-advances
                        </div>
                      </div>
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-teal-700">
                        ▶ Playing
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10.5px] font-bold text-slate-500"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        01:42
                      </span>
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: '38%', background: 'var(--gradient-brand)' }}
                        />
                      </div>
                      <span
                        className="text-[10.5px] font-bold text-slate-400"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        04:30
                      </span>
                    </div>
                  </div>

                  {/* Audio waveform mock */}
                  <div className="flex h-10 items-end gap-[2px]">
                    {[6, 12, 8, 16, 22, 18, 28, 14, 20, 26, 32, 22, 18, 24, 30, 20, 14, 8, 16, 22, 28, 18, 12, 22, 30, 24, 16, 10].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full"
                        style={{
                          height: `${h}px`,
                          background: i < 11 ? 'var(--brand-500)' : '#CBD5E1',
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                    Listen carefully and answer the questions on the right. The recording will not be repeated.
                  </p>
                </div>

                <div className="bg-slate-50 p-7">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    Questions 1–5 · Form Completion
                  </div>
                  <div className="mb-2.5 rounded-xl border-2 border-teal-500 bg-white p-4">
                    <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                      Booking form
                    </div>
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <span className="text-slate-600">Date:</span>
                      <span className="font-bold text-slate-900">12 March</span>
                    </div>
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <span className="text-slate-600">Room number:</span>
                      <div
                        className="rounded border-2 border-teal-500 bg-teal-50 px-2 py-0.5 text-[12px] font-bold text-teal-700"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        2&nbsp;1&nbsp;4
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-slate-600">Capacity:</span>
                      <span
                        className="rounded border border-dashed border-slate-300 px-3 py-0.5 text-[12px] text-slate-400"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        ____
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-4">
                    <div className="text-[13px] font-bold text-slate-500">
                      3. Equipment requested includes…
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating headphones chip — inside Listening frame, top right */}
              <div
                className="absolute right-3 top-14 hidden items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 md:flex"
                style={{ boxShadow: 'var(--shadow-lg)' }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                  style={{ background: 'var(--gradient-brand)' }}
                >
                  <AudioLines className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[11px] font-bold text-slate-500">AUDIO</div>
                  <div
                    className="text-[13px] font-bold text-slate-900"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    01:42 / 04:30
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating score chip — under the whole grid, anchored bottom-left */}
          <div
            className="absolute -left-4 -bottom-6 hidden items-center gap-3.5 rounded-2xl border border-slate-100 bg-white p-4 md:flex"
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

      {/* ── DUAL LANDING (ETAP 14): B2B vs B2C audience split ── */}
      {!user && (
        <section className="px-8 pt-4">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <div className="eyebrow eyebrow--accent">
                <span className="eyebrow__dot eyebrow__dot--accent" />
                Who is it for?
              </div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 md:text-[34px]">
                ILDIZmock — har kim uchun yo'l bor
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-slate-600">
                O'quv markazlarga to'liq boshqaruv, individual o'quvchilarga
                erkin kirish — bittagina platformada.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* B2B */}
              <Link
                to="/login"
                className="group rounded-[24px] border border-slate-100 bg-white p-8 transition-all hover:-translate-y-0.5 hover:border-brand-100"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="icon-tile icon-tile--brand">
                  <Building2 className="h-7 w-7" />
                </div>
                <h3 className="mb-2.5 text-[22px] font-extrabold tracking-tight text-slate-900">
                  O'quv markazlar uchun
                </h3>
                <p className="text-[14.5px] leading-relaxed text-slate-600">
                  Guruh boshqaruvi, o'qituvchi paneli, davomat va batafsil
                  hisobotlar. Markaz logini orqali kiring.
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                  <li>· Markaz / guruh / o'qituvchi ierarxiyasi</li>
                  <li>· Mock sessiyalar va davomat jurnali</li>
                  <li>· Markazning brending sahifasi</li>
                </ul>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600">
                  Markaz logini <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              {/* B2C */}
              <Link
                to="/b2c/signup"
                className="group rounded-[24px] border border-slate-100 bg-white p-8 transition-all hover:-translate-y-0.5 hover:border-brand-100"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="icon-tile icon-tile--cta">
                  <UserIcon className="h-7 w-7" />
                </div>
                <h3 className="mb-2.5 text-[22px] font-extrabold tracking-tight text-slate-900">
                  Individual foydalanuvchilar uchun
                </h3>
                <p className="text-[14.5px] leading-relaxed text-slate-600">
                  O'zingiz uchun tayyorlanmoqdamisiz? Email orqali ro'yxatdan
                  o'ting va hoziroq boshlang.
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                  <li>· Email orqali tezkor ro'yxat</li>
                  <li>· Modullar va kreditli testlar</li>
                  <li>· Shaxsiy progress va natijalar</li>
                </ul>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600">
                  Ro'yxatdan o'tish <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
        </section>
      )}

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
                className="mt-9 inline-flex items-center justify-center gap-2 rounded-2xl bg-cta-500 px-8 py-[18px] text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_10px_24px_rgba(20,184,152,0.40)]"
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
