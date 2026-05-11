/**
 * ETAP 20 — Attendance Redesign.
 *
 * 3-tab container:
 *   Tab 1 — Bugungi davomat (o'qituvchi tezda belgilaydi)
 *   Tab 2 — Oylik jadval    (admin Division Register-style grid)
 *   Tab 3 — Tahlil          (trend chart + at-risk talabalar)
 *
 * Rol bo'yicha default tab:
 *   teacher → today
 *   org_admin/superadmin → monthly
 */
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, ClipboardList, LineChart } from 'lucide-react'
import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { PageHeader, PageShell } from '@/components/admin-shell'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

import AttendanceAnalyticsTab from './attendance/AnalyticsTab'
import AttendanceMonthlyTab from './attendance/MonthlyTab'
import AttendanceTodayTab from './attendance/TodayTab'

export interface AttendanceGroup {
  id: number
  name: string
  is_active: boolean
  student_count: number
}

type TabKey = 'today' | 'monthly' | 'analytics'

const TABS: Array<{ key: TabKey; label: string; Icon: typeof CalendarCheck }> = [
  { key: 'today', label: 'Bugungi davomat', Icon: ClipboardList },
  { key: 'monthly', label: 'Oylik jadval', Icon: CalendarCheck },
  { key: 'analytics', label: 'Tahlil', Icon: LineChart },
]

export default function AttendancePage() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuth((s) => s.user)
  const [params, setParams] = useSearchParams()

  const isTeacher = user?.role === 'teacher'
  const defaultTab: TabKey = isTeacher ? 'today' : 'monthly'
  const activeTab = (params.get('tab') as TabKey) || defaultTab

  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(params)
    next.set('tab', key)
    setParams(next, { replace: true })
  }

  // Sahifa ilk ochilganda URL'da tab bo'lmasa rol bo'yicha default'ni qo'yamiz.
  useEffect(() => {
    if (!params.get('tab')) {
      const next = new URLSearchParams(params)
      next.set('tab', defaultTab)
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab])

  const groupsQ = useQuery({
    queryKey: ['attendance-groups', slug],
    queryFn: async () =>
      (await api.get<AttendanceGroup[]>(`/center/${slug}/groups/`)).data,
    enabled: !!slug,
  })

  const groups = (groupsQ.data ?? []).filter((g) => g.is_active)

  return (
    <PageShell maxWidth="max-w-7xl">
      <PageHeader
        title="Davomat"
        subtitle="Guruhlar bo'yicha talaba davomati va hisobotlar"
      />

      <div className="mb-6 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 print:hidden">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          )
        })}
      </div>

      {slug && activeTab === 'today' && (
        <AttendanceTodayTab slug={slug} groups={groups} loadingGroups={groupsQ.isLoading} />
      )}
      {slug && activeTab === 'monthly' && (
        <AttendanceMonthlyTab slug={slug} groups={groups} loadingGroups={groupsQ.isLoading} />
      )}
      {slug && activeTab === 'analytics' && (
        <AttendanceAnalyticsTab slug={slug} groups={groups} />
      )}
    </PageShell>
  )
}
