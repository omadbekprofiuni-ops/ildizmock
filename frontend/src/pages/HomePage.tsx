import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
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
  iconColor: string
  iconBg: string
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
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
  {
    id: 'writing',
    titleKey: 'practice.writing.title',
    descriptionKey: 'practice.writing.description',
    Icon: PenTool,
    href: '/tests/writing',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    authRequired: true,
  },
  {
    id: 'listening',
    titleKey: 'practice.listening.title',
    descriptionKey: 'practice.listening.description',
    Icon: Headphones,
    href: '/tests/listening',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
  },
  {
    id: 'speaking',
    titleKey: 'practice.speaking.title',
    descriptionKey: 'practice.speaking.description',
    Icon: Mic,
    href: '/tests/speaking',
    iconColor: 'text-gray-400',
    iconBg: 'bg-gray-100',
    comingSoon: true,
  },
]

interface FeatureEntry {
  Icon: ComponentType<{ className?: string }>
  titleKey: string
  descriptionKey: string
}

const FEATURES: FeatureEntry[] = [
  {
    Icon: Monitor,
    titleKey: 'home.features.authentic.title',
    descriptionKey: 'home.features.authentic.description',
  },
  {
    Icon: Clock,
    titleKey: 'home.features.timing.title',
    descriptionKey: 'home.features.timing.description',
  },
  {
    Icon: Zap,
    titleKey: 'home.features.scoring.title',
    descriptionKey: 'home.features.scoring.description',
  },
  {
    Icon: BarChart3,
    titleKey: 'home.features.tracking.title',
    descriptionKey: 'home.features.tracking.description',
  },
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
      {/* Hero */}
      <section className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-6xl">
            {t('home.hero.title.start')}
            <br />
            <span className="mt-3 inline-block rounded-xl bg-brand-50 px-4 py-2 text-brand-600 md:mt-4">
              {t('home.hero.title.highlight')}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-600 md:text-xl">
            {t('home.hero.subtitle')}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to={user ? '/practice' : '/tests/reading'}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition-all hover:bg-brand-600 hover:shadow-lg"
            >
              <Play className="h-5 w-5" />
              {t('home.hero.cta')}
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              {t('nav.pricing')}
            </Link>
          </div>

        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              {t('home.features.title')}
            </h2>
            <p className="mt-3 text-lg text-gray-600">{t('home.features.subtitle')}</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ Icon, titleKey, descriptionKey }) => (
              <div key={titleKey} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-100">
                  <Icon className="h-7 w-7 text-brand-600" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">{t(titleKey)}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{t(descriptionKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Practice tests */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              {t('practice.title')}
            </h2>
            <p className="mt-3 text-lg text-gray-600">{t('practice.subtitle')}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((mod) => {
              const count = counts.data?.[mod.id] ?? null
              const writingLocked = mod.authRequired && !user
              const target = mod.comingSoon
                ? '/tests/speaking'
                : writingLocked
                  ? '/login'
                  : mod.href

              const Card = (
                <div
                  className={`group h-full rounded-xl border-2 bg-white p-6 transition-all ${
                    mod.comingSoon
                      ? 'cursor-not-allowed border-gray-200 opacity-70'
                      : 'cursor-pointer border-gray-200 hover:border-brand-500 hover:shadow-lg'
                  }`}
                >
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${mod.iconBg}`}
                  >
                    <mod.Icon className={`h-6 w-6 ${mod.iconColor}`} />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">
                    {t(mod.titleKey)}
                  </h3>
                  <p className="mb-4 text-sm text-gray-600">{t(mod.descriptionKey)}</p>

                  <div className="flex items-center justify-between">
                    {mod.comingSoon ? (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                        {t('common.comingSoon')}
                      </span>
                    ) : writingLocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        <Lock className="h-3 w-3" /> Login
                      </span>
                    ) : counts.isLoading ? (
                      <span className="inline-block h-4 w-20 animate-pulse rounded bg-gray-200" />
                    ) : count !== null ? (
                      <span className="text-xs font-medium text-gray-500">
                        {count} tests
                      </span>
                    ) : (
                      <span />
                    )}

                    {!mod.comingSoon && (
                      <span className="text-sm font-semibold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                        Start →
                      </span>
                    )}
                  </div>
                </div>
              )

              return mod.comingSoon ? (
                <div key={mod.id}>{Card}</div>
              ) : (
                <Link key={mod.id} to={target}>
                  {Card}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Guest attempts */}
      {!user && guestList.length > 0 && (
        <section className="bg-gray-50 px-6 py-12">
          <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Your anonymous attempts</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Saved in your browser. Sign up to link them to your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  guestAttempts.clear()
                  setGuestList([])
                }}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:underline"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
            <ul className="divide-y divide-gray-200">
              {guestList.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {g.test_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {g.module} · {new Date(g.started_at).toLocaleDateString('en-US')} ·{' '}
                      {g.status === 'graded' ? 'Submitted' : 'In progress'}
                    </div>
                  </div>
                  <Link
                    to={g.status === 'in_progress' ? `/take/${g.id}` : `/result/${g.id}`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-brand-500 hover:text-brand-600"
                  >
                    {g.status === 'in_progress' ? 'Continue' : 'Result'}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Pricing teaser */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              {t('pricing.title')}
            </h2>
            <p className="mt-3 text-lg text-gray-600">{t('pricing.subtitle')}</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Pay Per Test — only active plan */}
            <div className="relative rounded-xl border-2 border-brand-500 bg-white p-8 shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-4 py-1 text-xs font-bold text-white">
                Available Now
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {t('pricing.payPerTest.name')}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {t('pricing.payPerTest.description')}
              </p>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-gray-900">
                  {t('pricing.payPerTest.price')}
                </span>
                <span className="text-gray-600">
                  {' '}
                  {t('pricing.payPerTest.currency')} · {t('pricing.payPerTest.priceUnit')}
                </span>
              </div>
              <ul className="mt-6 space-y-3">
                {(t('pricing.payPerTest.features', { returnObjects: true }) as string[]).map(
                  (feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ),
                )}
              </ul>
              <Link
                to="/pricing"
                className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                {t('pricing.payPerTest.cta')}
              </Link>
            </div>

            {/* Center Starter — Coming Soon */}
            <div className="relative rounded-xl border-2 border-gray-200 bg-white p-8 opacity-70">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-400 px-4 py-1 text-xs font-bold text-white">
                {t('pricing.centerStarter.badge')}
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {t('pricing.centerStarter.name')}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {t('pricing.centerStarter.description')}
              </p>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-gray-400 line-through">
                  {t('pricing.centerStarter.price')}
                </span>
                <span className="text-gray-500">
                  {' '}
                  {t('pricing.centerStarter.currency')} ·{' '}
                  {t('pricing.centerStarter.priceUnit')}
                </span>
              </div>
              <ul className="mt-6 space-y-3">
                {(
                  t('pricing.centerStarter.features', { returnObjects: true }) as string[]
                ).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-300" />
                    <span className="text-sm text-gray-500">{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled
                className="mt-8 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-200 px-4 py-3 text-sm font-semibold text-gray-500"
              >
                {t('pricing.centerStarter.cta')}
              </button>
            </div>

            {/* Center Pro — Coming Soon */}
            <div className="relative rounded-xl border-2 border-gray-200 bg-white p-8 opacity-70">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-400 px-4 py-1 text-xs font-bold text-white">
                {t('common.comingSoon')}
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {t('pricing.centerPro.name')}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {t('pricing.centerPro.description')}
              </p>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-gray-400 line-through">
                  {t('pricing.centerPro.price')}
                </span>
                <span className="text-gray-500">
                  {' '}
                  {t('pricing.centerPro.currency')} · {t('pricing.centerPro.priceUnit')}
                </span>
              </div>
              <ul className="mt-6 space-y-3">
                {(t('pricing.centerPro.features', { returnObjects: true }) as string[]).map(
                  (feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-300" />
                      <span className="text-sm text-gray-500">{feature}</span>
                    </li>
                  ),
                )}
              </ul>
              <button
                type="button"
                disabled
                className="mt-8 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-200 px-4 py-3 text-sm font-semibold text-gray-500"
              >
                {t('pricing.centerPro.cta')}
              </button>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-gray-600">{t('pricing.note')}</p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-brand-50 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            {t('home.cta.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            {t('home.cta.subtitle')}
          </p>
          <Link
            to={user ? '/practice' : '/tests/reading'}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition-all hover:bg-brand-600 hover:shadow-lg"
          >
            <Play className="h-5 w-5" />
            {t('home.cta.button')}
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
