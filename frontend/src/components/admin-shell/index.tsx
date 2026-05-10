import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Page wrapper — slate-50 fon, max-w-6xl markazlashtirilgan, fade-in animatsiya.
 *
 * Barcha admin sahifalari shu wrapper bilan o'ralishi kerak.
 */
export function PageShell({
  children,
  className,
  maxWidth = 'max-w-6xl',
}: {
  children: ReactNode
  className?: string
  maxWidth?: 'max-w-4xl' | 'max-w-5xl' | 'max-w-6xl' | 'max-w-7xl'
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full p-6 lg:p-10 animate-in fade-in duration-300',
        maxWidth,
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Page header — katta sarlavha + subtitle + (ixtiyoriy) o'ng tarafdagi action'lar.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const TONE_CLASSES: Record<
  'indigo' | 'blue' | 'emerald' | 'amber' | 'orange' | 'violet' | 'rose' | 'slate',
  { bg: string; text: string }
> = {
  // 'indigo' was the legacy primary key — now mapped to brand (deep blue)
  indigo: { bg: 'bg-brand-50', text: 'text-brand-600' },
  blue: { bg: 'bg-brand-50', text: 'text-brand-700' },
  emerald: { bg: 'bg-teal-50', text: 'text-teal-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  orange: { bg: 'bg-cta-50', text: 'text-cta-600' },
  violet: { bg: 'bg-cta-50', text: 'text-cta-600' },
  rose: { bg: 'bg-cta-50', text: 'text-cta-600' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
}

/**
 * Stat card — rangli ikonka + label + value + ixtiyoriy ostida hint.
 */
export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone = 'indigo',
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  Icon?: LucideIcon
  tone?: keyof typeof TONE_CLASSES
}) {
  const t = TONE_CLASSES[tone]
  return (
    <div
      className="flex items-center gap-4 rounded-[20px] border border-slate-100 bg-white p-6"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {Icon && (
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
            t.bg,
            t.text,
          )}
        >
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-1 truncate text-2xl font-extrabold tracking-tight text-slate-900">
          {value}
        </p>
        {hint && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

/**
 * Surface card — barcha kontent oromini saqlaydigan oq fon, shu uslubdagi border.
 */
export function SurfaceCard({
  children,
  className,
  padding = 'p-6',
}: {
  children: ReactNode
  className?: string
  padding?: string
}) {
  return (
    <div
      className={cn('rounded-[20px] border border-slate-100 bg-white', padding, className)}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {children}
    </div>
  )
}

/**
 * Data-table card — ichida jadval bo'lgan card. Header ixtiyoriy.
 */
export function TableCard({
  title,
  toolbar,
  children,
  className,
}: {
  title?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('overflow-hidden rounded-[20px] border border-slate-100 bg-white', className)}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {(title || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
          )}
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

/**
 * Standart jadval thead/tbody style.
 */
export const adminTable = {
  table: 'w-full text-left text-sm text-slate-600',
  thead:
    'border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500',
  th: 'px-6 py-3.5',
  tbody: 'divide-y divide-slate-100',
  trHover: 'transition-colors hover:bg-slate-50/60',
  td: 'px-6 py-4',
  badge: 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold',
}

/**
 * Brand primary button — deep-blue gradient.
 */
export const btnPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0'

export const btnOutline =
  'inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed'

export const btnGhost =
  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-700'

/**
 * Soft chip.
 */
export function Chip({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'blue'
  className?: string
}) {
  const tones: Record<typeof tone & string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-brand-50 text-brand-700',
    emerald: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-[#B45309]',
    rose: 'bg-cta-50 text-cta-700',
    violet: 'bg-cta-50 text-cta-700',
    blue: 'bg-brand-50 text-brand-700',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Loading/empty/error states.
 */
export function StateCard({
  title,
  description,
  Icon,
  tone = 'slate',
  action,
}: {
  title: ReactNode
  description?: ReactNode
  Icon?: LucideIcon
  tone?: keyof typeof TONE_CLASSES
  action?: ReactNode
}) {
  const t = TONE_CLASSES[tone]
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-[20px] border border-slate-100 bg-white p-10 text-center"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {Icon && (
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl',
            t.bg,
            t.text,
          )}
        >
          <Icon size={24} />
        </div>
      )}
      <div>
        <p className="text-base font-extrabold text-slate-900">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
