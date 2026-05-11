import {
  AudioLines,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Feather,
  FileEdit,
  Library,
  MicVocal,
  Play,
  Radio,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PublicLayout } from '@/components/public/PublicLayout'

interface ModuleItem {
  title: string
  description: string
  highlights: string[]
}

interface PlatformItem {
  title: string
  description: string
}

const MODULE_META: Array<{
  Icon: ComponentType<{ className?: string }>
  tone: 'brand' | 'accent' | 'cta' | 'slate'
}> = [
  { Icon: Library, tone: 'brand' },
  { Icon: AudioLines, tone: 'cta' },
  { Icon: Feather, tone: 'accent' },
  { Icon: MicVocal, tone: 'slate' },
]

const PLATFORM_META: Array<{
  Icon: ComponentType<{ className?: string }>
  tone: 'brand' | 'accent' | 'cta'
}> = [
  { Icon: Radio, tone: 'brand' },
  { Icon: Users, tone: 'accent' },
  { Icon: CalendarCheck, tone: 'cta' },
  { Icon: FileEdit, tone: 'brand' },
  { Icon: CreditCard, tone: 'accent' },
  { Icon: ShieldCheck, tone: 'cta' },
]

export default function FeaturesPage() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = 'Features — ILDIZmock'
  }, [])

  const modulesRaw = t('featuresPage.modules.items', { returnObjects: true })
  const platformRaw = t('featuresPage.platform.items', { returnObjects: true })
  const modules: ModuleItem[] = Array.isArray(modulesRaw) ? (modulesRaw as ModuleItem[]) : []
  const platform: PlatformItem[] = Array.isArray(platformRaw) ? (platformRaw as PlatformItem[]) : []

  return (
    <PublicLayout>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-8 pb-16 pt-24 text-center">
        <div className="hero-bg" />
        <div className="relative mx-auto max-w-3xl">
          <div className="eyebrow">
            <span className="eyebrow__dot" />
            Platform Features
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-[56px] md:leading-[1.05]">
            {t('featuresPage.hero.title') || (
              <>
                Everything you need to <span className="gradient-text">walk in calm</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600">
            {t('featuresPage.hero.subtitle')}
          </p>
        </div>
      </section>

      {/* ── MODULES (group 1) ── */}
      <section className="bg-slate-50 px-8 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-xl">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-600">
              Group 1
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              {t('featuresPage.modules.title')}
            </h2>
            <p className="mt-2.5 text-base leading-relaxed text-slate-600">
              {t('featuresPage.modules.subtitle')}
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {modules.map((mod, idx) => {
              const meta = MODULE_META[idx] ?? MODULE_META[0]
              return (
                <div
                  key={mod.title}
                  className="rounded-[20px] border border-slate-100 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-brand-100"
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  <div className={`icon-tile icon-tile--${meta.tone}`}>
                    <meta.Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">{mod.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {mod.description}
                  </p>
                  <ul className="mt-5 space-y-2">
                    {Array.isArray(mod.highlights) &&
                      mod.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-500" />
                          {h}
                        </li>
                      ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PLATFORM (group 2) ── */}
      <section className="px-8 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-xl">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-600">
              Group 2
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              {t('featuresPage.platform.title')}
            </h2>
            <p className="mt-2.5 text-base leading-relaxed text-slate-600">
              {t('featuresPage.platform.subtitle')}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {platform.map((item, idx) => {
              const meta = PLATFORM_META[idx] ?? PLATFORM_META[0]
              return (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-slate-100 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-brand-100"
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  <div className={`icon-tile icon-tile--${meta.tone}`}>
                    <meta.Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── MOBILE-FIRST STRIP ── */}
      <section className="bg-slate-50 px-8 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Built mobile-first, works on every device
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Practise Reading and Listening on your phone during the commute. The
              interface adapts perfectly — and your progress syncs to the desktop
              where you'll do full-length mocks.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {['iOS Safari', 'Android Chrome', 'Desktop', 'Tablet'].map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center rounded-full bg-brand-50 px-3.5 py-2 text-xs font-bold tracking-wide text-brand-700"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="relative h-[360px]">
            <div
              className="absolute left-0 top-0 h-full w-[70%] rounded-[18px] border border-slate-100 p-8"
              style={{ background: 'var(--gradient-brand-soft)' }}
            >
              <span className="inline-flex items-center rounded-full bg-cta-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-cta-700">
                Listening · Section 2
              </span>
              <div className="mt-3 text-base font-bold text-slate-900">
                Q11 — Look at the map. Where is the museum?
              </div>
              <div className="mt-4 rounded-xl bg-white p-3.5 text-[13px]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-slate-500" style={{ fontFamily: 'var(--font-mono)' }}>
                    00:24
                  </span>
                  <span className="font-bold text-cta-500">Plays once</span>
                </div>
                <div className="relative h-1 rounded bg-slate-100">
                  <div className="absolute left-0 top-0 h-1 w-[38%] rounded bg-brand-600" />
                </div>
              </div>
            </div>
            {/* Phone */}
            <div
              className="absolute right-0 top-[30px] h-[320px] w-[180px] rounded-[28px] bg-slate-900 p-2"
              style={{ boxShadow: 'var(--shadow-xl)' }}
            >
              <div className="flex h-full flex-col gap-2.5 rounded-[22px] bg-white p-5">
                <div className="text-[10px] font-bold text-slate-500">Reading · Q14</div>
                <div className="text-xs font-bold leading-snug text-slate-900">
                  True / False / Not Given?
                </div>
                <div className="rounded-[10px] border-2 border-brand-500 bg-brand-50 p-2.5 text-[11px] font-bold text-brand-700">
                  True
                </div>
                <div className="rounded-[10px] bg-slate-50 p-2.5 text-[11px] text-slate-600">
                  False
                </div>
                <div className="rounded-[10px] bg-slate-50 p-2.5 text-[11px] text-slate-600">
                  Not Given
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
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
                {t('featuresPage.cta.title')}
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/85">
                {t('featuresPage.cta.subtitle')}
              </p>
              <Link
                to="/tests/reading"
                className="mt-9 inline-flex items-center justify-center gap-2 rounded-2xl bg-cta-500 px-8 py-[18px] text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.40)]"
              >
                <Play className="h-5 w-5" />
                {t('featuresPage.cta.button')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
