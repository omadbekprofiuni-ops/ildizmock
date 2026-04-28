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
    <div className={cn('mx-auto w-full p-6 lg:p-10 animate-in fade-in duration-300', maxWidth, className)}>
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const TONE_CLASSES: Record<
  'indigo' | 'blue' | 'emerald' | 'amber' | 'orange' | 'violet' | 'rose' | 'slate',
  { bg: string; text: string }
> = {
  indigo:  { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  blue:    { bg: 'bg-blue-100', text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  amber:   { bg: 'bg-amber-100', text: 'text-amber-600' },
  orange:  { bg: 'bg-orange-100', text: 'text-orange-600' },
  violet:  { bg: 'bg-violet-100', text: 'text-violet-600' },
  rose:    { bg: 'bg-rose-100', text: 'text-rose-600' },
  slate:   { bg: 'bg-slate-100', text: 'text-slate-600' },
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
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {Icon && (
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', t.bg, t.text)}>
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900 truncate">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500 truncate">{hint}</p>}
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
    <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', padding, className)}>
      {children}
    </div>
  )
}

/**
 * Data-table card — ichida jadval bo'lgan card. Header ixtiyoriy.
 *
 * Foydalanish:
 *   <TableCard title="O'quvchilar" toolbar={<input ... />}>
 *     <table>...</table>
 *   </TableCard>
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
    <div className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

/**
 * Standart jadval thead/tbody style. <thead> va <tbody> classlarini berish uchun.
 */
export const adminTable = {
  table: 'w-full text-left text-sm text-slate-600',
  thead: 'border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500',
  th: 'px-6 py-3',
  tbody: 'divide-y divide-slate-100',
  trHover: 'transition-colors hover:bg-slate-50/50',
  td: 'px-6 py-4',
  badge: 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
}

/**
 * Indigo primary button class — `<button className={btnPrimary}>...</button>`.
 */
export const btnPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'

export const btnOutline =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'

export const btnGhost =
  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'

/**
 * Soft chip — `bg-indigo-50 text-indigo-700` etc.
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
    slate:    'bg-slate-100 text-slate-700',
    indigo:   'bg-indigo-50 text-indigo-700',
    emerald:  'bg-emerald-100 text-emerald-700',
    amber:    'bg-amber-100 text-amber-700',
    rose:     'bg-rose-100 text-rose-700',
    violet:   'bg-violet-100 text-violet-700',
    blue:     'bg-blue-100 text-blue-700',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

/**
 * Loading/empty/error states (barcha admin sahifalari uchun bir xil ko'rinish).
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      {Icon && (
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', t.bg, t.text)}>
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
