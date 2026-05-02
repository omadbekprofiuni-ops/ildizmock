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

  const features = t('pricing.card.features', { returnObjects: true }) as PricingFeature[]
  const faqItems = t('pricing.faq.items', { returnObjects: true }) as FaqItem[]

  return (
    <PublicLayout>
      {/* Header */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            {t('pricing.title')}
          </h1>
          <p className="mt-4 text-lg text-gray-600">{t('pricing.subtitle')}</p>
        </div>
      </section>

      {/* Single Pricing Card */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-2xl">
          <div className="overflow-hidden rounded-2xl border-2 border-brand-500 bg-white shadow-xl">
            {/* Card header */}
            <div className="bg-brand-500 px-8 py-8 text-center text-white">
              <h2 className="text-3xl font-bold">{t('pricing.card.name')}</h2>
              <p className="mt-2 text-brand-50">{t('pricing.card.description')}</p>
            </div>

            {/* Card body */}
            <div className="bg-gradient-to-br from-white to-gray-50 px-8 py-10">
              {/* Primary price */}
              <div className="mb-8 text-center">
                <div className="mb-3">
                  <span className="text-5xl font-extrabold text-gray-900">
                    {t('pricing.card.price')}
                  </span>
                  <span className="ml-2 text-2xl text-gray-600">
                    {t('pricing.card.currency')}
                  </span>
                </div>
                <p className="text-gray-600">{t('pricing.card.priceNote')}</p>
              </div>

              {/* Tier-after note */}
              <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">
                    {t('pricing.card.tierAfterLabel')}
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    {t('pricing.card.tierAfterPrice')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {t('pricing.card.tierAfterNote')}
                </p>
              </div>

              {/* Features */}
              <ul className="mb-8 space-y-4">
                {features.map((feature) => (
                  <li key={feature.title} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-500" />
                    <div>
                      <p className="font-semibold text-gray-900">{feature.title}</p>
                      <p className="mt-0.5 text-sm text-gray-600">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-4 text-base font-bold text-white shadow-lg transition-all hover:bg-brand-600 hover:shadow-xl"
              >
                {t('pricing.card.cta')}
              </Link>
            </div>
          </div>

          {/* Contact link */}
          <div className="mt-10 text-center">
            <p className="text-gray-600">{t('pricing.questions')}</p>
            <Link
              to="/login"
              className="mt-2 inline-block font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('pricing.contact')} →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">
            {t('pricing.faq.title')}
          </h2>

          <div className="space-y-4">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-gray-200 bg-white p-6 shadow-soft open:border-brand-300"
              >
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900">
                  {item.q}
                  <span className="ml-4 text-brand-500 transition-transform group-open:rotate-180">
                    ⌄
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
