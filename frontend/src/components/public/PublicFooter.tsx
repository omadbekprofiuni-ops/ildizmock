import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'

function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        overflow: 'hidden',
      }}
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

const socials = [
  {
    label: 'Telegram',
    href: '#',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: '#',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: '#',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 0H5C2.2 0 0 2.2 0 5v14c0 2.8 2.2 5 5 5h14c2.8 0 5-2.2 5-5V5c0-2.8-2.2-5-5-5zM8 19H5V8h3v11zM6.5 6.7a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zM20 19h-3v-5.6c0-1.4-.5-2.3-1.7-2.3-.9 0-1.5.6-1.7 1.2-.1.2-.1.5-.1.8V19h-3V8h3v1.3c.4-.6 1.1-1.5 2.7-1.5 2 0 3.5 1.3 3.5 4.1V19z" />
      </svg>
    ),
  },
]

export function PublicFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-brand-950 px-8 pb-8 pt-16 text-slate-300">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-16 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="max-w-xs">
            <Link to="/" className="flex items-center gap-3">
              <BrandMark size={40} />
              <span className="text-xl font-extrabold tracking-tight text-white">
                ILDIZ<span className="text-teal-400">mock</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">{t('footer.tagline')}</p>
            <div className="mt-6 flex gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-900 text-slate-300 transition-all hover:bg-brand-800 hover:text-white"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
              {t('footer.product')}
            </h4>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <Link to="/practice" className="text-slate-300 transition-colors hover:text-white">
                  {t('nav.practice')}
                </Link>
              </li>
              <li>
                <Link to="/features" className="text-slate-300 transition-colors hover:text-white">
                  {t('nav.features')}
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-slate-300 transition-colors hover:text-white">
                  {t('nav.pricing')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
              {t('footer.company')}
            </h4>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <Link to="/about" className="text-slate-300 transition-colors hover:text-white">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-300 transition-colors hover:text-white">
                  {t('nav.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
              Support
            </h4>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <Link to="/login" className="text-slate-300 transition-colors hover:text-white">
                  {t('common.login')}
                </Link>
              </li>
              <li>
                <a className="text-slate-300 transition-colors hover:text-white">Privacy</a>
              </li>
              <li>
                <a className="text-slate-300 transition-colors hover:text-white">Terms</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-brand-900 pt-6 text-[13px] text-slate-400 sm:flex-row">
          <span>© {year} ILDIZmock. {t('footer.rights')}</span>
          <span>Made for IELTS aspirants in Uzbekistan 🇺🇿</span>
        </div>
      </div>
    </footer>
  )
}
