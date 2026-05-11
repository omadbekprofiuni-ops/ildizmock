import { CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PublicLayout } from '@/components/public/PublicLayout'

interface FaqItem {
  q: string
  a: string
}

interface PricingFeature {
  title: string
  description: string
}

export default function PricingPage() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = 'Pricing — ILDIZmock'
  }, [])

  const featuresRaw = t('pricing.card.features', { returnObjects: true })
  const faqRaw = t('pricing.faq.items', { returnObjects: true })
  const features: PricingFeature[] = Array.isArray(featuresRaw) ? (featuresRaw as PricingFeature[]) : []
  const faqItems: FaqItem[] = Array.isArray(faqRaw) ? (faqRaw as FaqItem[]) : []

  return (
    <PublicLayout>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-8 pb-12 pt-24 text-center">
        <div className="hero-bg" />
        <div className="relative mx-auto max-w-3xl">
          <div className="eyebrow">
            <span className="eyebrow__dot" />
            Simple, transparent pricing
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            {t('pricing.title')}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-slate-600">
            {t('pricing.subtitle')}
          </p>
        </div>
      </section>

      {/* ── PRICING CARD ── */}
      <section className="px-6 pb-20 pt-6">
        <div className="mx-auto max-w-md">
          <div
            className="relative overflow-hidden rounded-[24px] text-white"
            style={{ background: 'var(--gradient-hero)', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* Background pattern */}
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
                backgroundSize: '28px 28px',
              }}
            />

            {/* Card body */}
            <div className="relative px-7 py-9">
              <div className="text-center">
                <span className="mb-4 inline-block rounded-full bg-cta-500 px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-white">
                  Individual
                </span>
                <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-white/80">
                  {t('pricing.card.name')}
                </div>
                <p className="mt-2 text-[14px] text-white/85">{t('pricing.card.description')}</p>
                <div className="mt-5 flex items-baseline justify-center gap-1.5">
                  <span className="text-[40px] font-extrabold leading-none tracking-tight text-white">
                    {t('pricing.card.price')}
                  </span>
                  <span className="text-base text-white/80">{t('pricing.card.currency')}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-white/75">{t('pricing.card.priceNote')}</p>
              </div>

              {/* Tier-after callout */}
              <div className="mt-6 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-bold text-white/95">
                    {t('pricing.card.tierAfterLabel')}
                  </span>
                  <span className="text-lg font-extrabold text-white">
                    {t('pricing.card.tierAfterPrice')}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] text-white/80">
                  {t('pricing.card.tierAfterNote')}
                </p>
              </div>

              {/* Features */}
              <ul className="mt-6 space-y-3">
                {features.map((feature) => (
                  <li key={feature.title} className="flex items-start gap-2.5 text-white/95">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-white/20">
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    </span>
                    <div>
                      <p className="text-[14px] font-bold">{feature.title}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/80">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                to="/b2c/signup"
                className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-cta-500 px-5 py-3.5 text-[14px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.40)]"
              >
                {t('pricing.card.cta')}
              </Link>
            </div>
          </div>

          {/* Contact link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-600">{t('pricing.questions')}</p>
            <Link
              to="/b2c/signup"
              className="mt-1 inline-block text-sm font-bold text-brand-600 hover:text-brand-700"
            >
              {t('pricing.contact')} →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-slate-50 px-8 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            {t('pricing.faq.title')}
          </h2>

          <div className="space-y-3">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="group rounded-[18px] border border-slate-100 bg-white p-6 transition-all open:border-brand-200"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold text-slate-900">
                  {item.q}
                  <span className="text-2xl font-extrabold text-brand-600 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
