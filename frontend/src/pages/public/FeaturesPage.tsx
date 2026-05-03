import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  FileEdit,
  Headphones,
  Mic,
  PenTool,
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

const MODULE_ICONS: Array<{
  Icon: ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
}> = [
  { Icon: BookOpen, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { Icon: Headphones, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  { Icon: PenTool, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { Icon: Mic, iconBg: 'bg-gray-100', iconColor: 'text-gray-500' },
]

const PLATFORM_ICONS: Array<ComponentType<{ className?: string }>> = [
  Radio,
  Users,
  CalendarCheck,
  FileEdit,
  CreditCard,
  ShieldCheck,
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
      {/* Hero */}
      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            {t('featuresPage.hero.title')}
          </h1>
          <p className="mt-4 text-lg text-gray-600">{t('featuresPage.hero.subtitle')}</p>
        </div>
      </section>

      {/* Modules */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              {t('featuresPage.modules.title')}
            </h2>
            <p className="mt-3 text-lg text-gray-600">
              {t('featuresPage.modules.subtitle')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {modules.map((mod, idx) => {
              const meta = MODULE_ICONS[idx] ?? MODULE_ICONS[0]
              return (
                <div
                  key={mod.title}
                  className="rounded-xl border border-gray-200 bg-white p-8 shadow-soft"
                >
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${meta.iconBg}`}
                  >
                    <meta.Icon className={`h-6 w-6 ${meta.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{mod.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {mod.description}
                  </p>
                  <ul className="mt-5 space-y-2">
                    {Array.isArray(mod.highlights) && mod.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
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

      {/* Platform */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              {t('featuresPage.platform.title')}
            </h2>
            <p className="mt-3 text-lg text-gray-600">
              {t('featuresPage.platform.subtitle')}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {platform.map((item, idx) => {
              const Icon = PLATFORM_ICONS[idx] ?? ShieldCheck
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-brand-300 hover:shadow-md"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50">
                    <Icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-50 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            {t('featuresPage.cta.title')}
          </h2>
          <p className="mt-3 text-lg text-gray-600">{t('featuresPage.cta.subtitle')}</p>
          <Link
            to="/tests/reading"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition-all hover:bg-brand-600 hover:shadow-lg"
          >
            <Play className="h-5 w-5" />
            {t('featuresPage.cta.button')}
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
