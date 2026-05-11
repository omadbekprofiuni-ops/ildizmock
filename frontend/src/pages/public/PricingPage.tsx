import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PublicLayout } from '@/components/public/PublicLayout'

interface FaqItem {
  q: string
  a: string
}

interface PricingPlan {
  key: string
  name: string
  badge?: string
  description: string
  price: string
  old_price?: string
  currency: string
  period: string
  features: string[]
  cta: string
  highlight: boolean
}

export default function PricingPage() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = 'Pricing — ILDIZmock'
  }, [])

  const plansRaw = t('pricing.plans', { returnObjects: true })
  const faqRaw = t('pricing.faq.items', { returnObjects: true })
  const plans: PricingPlan[] = Array.isArray(plansRaw) ? (plansRaw as PricingPlan[]) : []
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
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold text-cta-600">
            {t('pricing.early_access')}
          </p>
        </div>
      </section>

      {/* ── PRICING CARDS ── */}
      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isHighlight = plan.highlight
            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-[20px] border bg-white p-7 transition-all ${
                  isHighlight
                    ? 'border-cta-500 shadow-[0_12px_32px_rgba(20,184,152,0.18)] md:-translate-y-2'
                    : 'border-slate-200'
                }`}
              >
                {/* Plan header */}
                <div className="mb-4">
                  <div className="mb-2 flex items-baseline gap-2">
                    <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
                      {plan.name}
                    </h3>
                    {plan.badge && (
                      <span
                        className={`text-[12px] font-bold ${
                          isHighlight ? 'text-cta-600' : 'text-slate-500'
                        }`}
                      >
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="min-h-[42px] text-[13.5px] leading-relaxed text-slate-600">
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900">
                      {plan.price}
                    </span>
                    <span className="text-base font-bold text-slate-700">
                      {plan.currency}
                    </span>
                    {plan.old_price && (
                      <span className="text-[15px] text-slate-400 line-through">
                        {plan.old_price} {plan.currency}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-slate-500">{plan.period}</p>
                </div>

                <hr className="mb-5 border-slate-100" />

                {/* Features */}
                <ul className="mb-7 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-[14px] text-slate-700"
                    >
                      <Check
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          isHighlight ? 'text-cta-600' : 'text-brand-600'
                        }`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  to="/b2c/signup"
                  className={`mt-auto inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-[14px] font-bold transition-all ${
                    isHighlight
                      ? 'bg-cta-500 text-white hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.30)]'
                      : 'border-2 border-slate-200 bg-white text-slate-800 hover:border-brand-300 hover:text-brand-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Guarantee line */}
        <p className="mt-8 text-center text-sm text-slate-500">
          {t('pricing.guarantee')}
        </p>

        {/* Contact link */}
        <div className="mt-2 text-center">
          <p className="text-sm text-slate-600">{t('pricing.questions')}</p>
          <Link
            to="/b2c/signup"
            className="mt-1 inline-block text-sm font-bold text-brand-600 hover:text-brand-700"
          >
            {t('pricing.contact')} →
          </Link>
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
