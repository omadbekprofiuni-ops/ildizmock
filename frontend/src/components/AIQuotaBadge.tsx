/**
 * ETAP 16.7 — AI provider quota indicator.
 *
 * Bugun PDF parsing uchun nechta so'rov ishlatilgan / kunlik bepul limitdan
 * qancha qolgan. SuperAdmin sidebar va PDF import sahifasida ko'rsatiladi.
 */
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'

import { api } from '@/lib/api'

interface QuotaResponse {
  today_requests: number
  today_tokens: number
  today_cost_usd: number
  daily_free_limit: number
  remaining: number
  provider: {
    name?: string
    model?: string
    daily_quota?: number | null
    free_tier_available?: boolean
    notes?: string
    error?: string
  }
  date: string
}

export function AIQuotaBadge({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const q = useQuery({
    queryKey: ['ai-quota'],
    queryFn: async () =>
      (await api.get<QuotaResponse>('/admin/tests/ai-quota/')).data,
    staleTime: 60_000,
    retry: false,
  })

  if (q.isLoading || q.isError || !q.data) return null

  const limit = q.data.daily_free_limit || 250
  const used = q.data.today_requests
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const overSoftLimit = pct >= 80

  const isDark = variant === 'dark'

  const wrapperCls = isDark
    ? 'rounded-xl bg-white/5 px-3 py-2.5 text-white/80'
    : 'rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-900'
  const subTextCls = isDark ? 'text-white/50' : 'text-blue-700'
  const trackCls = isDark ? 'bg-white/10' : 'bg-blue-200/60'
  const fillCls = overSoftLimit ? 'bg-rose-500' : 'bg-emerald-400'

  return (
    <div className={wrapperCls}>
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles size={12} className={isDark ? 'text-teal-300' : 'text-blue-600'} />
        <p className="text-[11px] font-bold uppercase tracking-wider">AI bugun</p>
        <span className="ml-auto text-[11px] font-extrabold">
          {used} / {limit}
        </span>
      </div>
      <div className={`h-1 overflow-hidden rounded-full ${trackCls}`}>
        <div
          className={`h-full transition-all ${fillCls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {q.data.provider?.name && (
        <p className={`mt-1 truncate text-[10px] ${subTextCls}`}>
          {q.data.provider.name}
          {q.data.provider.model && (
            <span className="font-mono"> · {q.data.provider.model}</span>
          )}
        </p>
      )}
    </div>
  )
}
