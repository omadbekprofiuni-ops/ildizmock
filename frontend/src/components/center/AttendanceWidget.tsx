import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

interface TodaySession {
  id: number
  group_id: number
  group_name: string
  start_time: string | null
  end_time: string | null
  is_finalized: boolean
  rate: number | null
  total: number
}

interface TodayResponse {
  date: string
  sessions: TodaySession[]
}

function rateColor(rate: number | null): string {
  if (rate === null) return 'bg-slate-200'
  if (rate >= 90) return 'bg-emerald-500'
  if (rate >= 75) return 'bg-amber-500'
  return 'bg-rose-500'
}

interface AttendanceWidgetProps {
  slug: string
}

export function AttendanceWidget({ slug }: AttendanceWidgetProps) {
  const query = useQuery({
    queryKey: ['attendance-today', slug],
    queryFn: async () =>
      (await api.get<TodayResponse>(`/center/${slug}/attendance/today/`)).data,
    enabled: !!slug,
    refetchInterval: 60_000,
  })

  const sessions = query.data?.sessions ?? []

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-semibold">Bugungi davomat</h2>
          </div>
          <Link
            to={`/${slug}/admin/attendance`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Hammasi
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {query.isLoading ? (
          <div className="p-6 text-sm text-slate-500">Yuklanmoqda…</div>
        ) : query.isError ? (
          <div className="p-6 text-sm text-rose-600">Davomat yuklanmadi.</div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            Bugun rejalashtirilgan dars yo&apos;q.
          </div>
        ) : (
          <ul className="divide-y">
            {sessions.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {s.group_name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {s.start_time ?? '—'}
                      {s.end_time ? ` – ${s.end_time}` : ''} ·{' '}
                      {s.total > 0
                        ? `${s.total} talaba`
                        : 'Davomat hali olinmagan'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-slate-900">
                      {s.rate !== null ? `${s.rate}%` : '—'}
                    </div>
                    {s.is_finalized && (
                      <div className="text-[10px] uppercase tracking-wide text-emerald-600">
                        Yopilgan
                      </div>
                    )}
                  </div>
                </div>
                {s.rate !== null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all ${rateColor(s.rate)}`}
                      style={{ width: `${s.rate}%` }}
                    />
                  </div>
                )}
                <div className="mt-2 flex justify-end">
                  <Link
                    to={`/${slug}/admin/attendance/${s.id}`}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    {s.is_finalized ? 'Ko‘rish →' : 'Davomatni belgilash →'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
