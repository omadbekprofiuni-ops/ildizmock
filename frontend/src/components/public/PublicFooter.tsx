import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function PublicFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 px-6 py-12 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500">
                <span className="text-xl font-extrabold text-white">I</span>
              </div>
              <span className="text-2xl font-bold">
                ILDIZ<span className="text-brand-500">mock</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-400">{t('footer.tagline')}</p>
          </div>

          {/* Product */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">
              {t('footer.product')}
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <Link to="/practice" className="transition-colors hover:text-white">
                  {t('nav.practice')}
                </Link>
              </li>
              <li>
                <Link to="/features" className="transition-colors hover:text-white">
                  {t('nav.features')}
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="transition-colors hover:text-white">
                  {t('nav.pricing')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">
              {t('footer.company')}
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <Link to="/about" className="transition-colors hover:text-white">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="transition-colors hover:text-white">
                  {t('nav.contact')}
                </Link>
              </li>
              <li>
                <Link to="/login" className="transition-colors hover:text-white">
                  {t('common.login')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-800 pt-6 text-center text-sm text-gray-400">
          © {year} ILDIZmock. {t('footer.rights')}
        </div>
      </div>
    </footer>
  )
}
