import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Lock,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StatCard,
  SurfaceCard,
  TableCard,
  adminTable,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type WhenFilter = 'today' | 'upcoming' | 'past' | 'all'

interface Group {
  id: number
  name: string
  student_count: number
  is_active: boolean
}

interface AttendanceSession {
  id: number
  group: number
  group_name: string
  date: string
  start_time: string | null
  end_time: string | null
  is_finalized: boolean
  attendance_rate: number
  present_count: number
  absent_count: number
  total_count: number
}

interface TodaySession {
  id: number
  group_id: number
  group_name: string
  start_time: string | null
  end_time: string | null
  is_finalized: boolean
  rate: number
  total: number
}

interface TodayResponse {
  date: string
  sessions: TodaySession[]
}

const WHEN_TABS: Array<{ key: WhenFilter; label: string }> = [
  { key: 'today', label: 'Bugun' },
  { key: 'upcoming', label: 'Kelajak' },
  { key: 'past', label: "O'tgan" },
  { key: 'all', label: 'Hammasi' },
]

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function NewSessionModal({
  slug,
  groups,
  onClose,
  onCreated,
}: {
  slug: string
  groups: Group[]
  onClose: () => void
  onCreated: () => void
}) {
  const [groupId, setGroupId] = useState<string>(
    groups[0] ? String(groups[0].id) : '',
  )
  const [date, setDate] = useState<string>(todayIso())
  const [startTime, setStartTime] = useState('14:00')
  const [endTime, setEndTime] = useState('16:00')
  const [notes, setNotes] = useState('')

  const createMut = useMutation({
    mutationFn: async () => {
      return (
        await api.post(`/center/${slug}/attendance/sessions/`, {
          group: Number(groupId),
          date,
          start_time: startTime || null,
          end_time: endTime || null,
          notes,
        })
      ).data
    },
    onSuccess: () => {
      toast.success('Sessiya yaratildi')
      onCreated()
      onClose()
    },
    onError: (e) => {
      const data = (e as {
        response?: { data?: Record<string, unknown> | { detail?: string } }
      }).response?.data
      let msg = 'Sessiya yaratilmadi'
      if (data && typeof data === 'object') {
        const detail = (data as { detail?: string }).detail
        if (detail) msg = detail
        else {
          const first = Object.entries(data)[0]
          if (first) msg = `${first[0]}: ${String(first[1])}`
        }
      }
      toast.error(msg)
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Yangi sessiya</h2>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Guruh
            </label>
            {groups.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Hech qanday faol guruh topilmadi. Avval guruh yarating.
              </p>
            ) : (
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.student_count} talaba)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Sana
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Boshlanishi
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Tugashi
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Izoh (ixtiyoriy)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={btnOutline}
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={!groupId || createMut.isPending}
            onClick={() => createMut.mutate()}
            className={btnPrimary}
          >
            {createMut.isPending ? 'Yaratilmoqda…' : 'Yaratish'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AttendancePage() {
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()

  const [when, setWhen] = useState<WhenFilter>('today')
  const [groupFilter, setGroupFilter] = useState<string>('')
  const [showNewModal, setShowNewModal] = useState(false)

  const groupsQ = useQuery({
    queryKey: ['attendance-groups', slug],
    queryFn: async () =>
      (await api.get<Group[]>(`/center/${slug}/groups/`)).data,
    enabled: !!slug,
  })

  const sessionsQ = useQuery({
    queryKey: ['attendance-sessions', slug, when, groupFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (when !== 'all') params.when = when
      if (groupFilter) params.group = groupFilter
      return (
        await api.get<AttendanceSession[]>(
          `/center/${slug}/attendance/sessions/`,
          { params },
        )
      ).data
    },
    enabled: !!slug,
  })

  const todayQ = useQuery({
    queryKey: ['attendance-today', slug],
    queryFn: async () =>
      (await api.get<TodayResponse>(`/center/${slug}/attendance/today/`)).data,
    enabled: !!slug,
  })

  const groups = useMemo(
    () => (groupsQ.data ?? []).filter((g) => g.is_active),
    [groupsQ.data],
  )

  const todaySessions = todayQ.data?.sessions ?? []
  const todayPlanned = todaySessions.length
  const todayDone = todaySessions.filter((s) => s.is_finalized).length

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['attendance-sessions', slug] })
    qc.invalidateQueries({ queryKey: ['attendance-today', slug] })
  }

  return (
    <PageShell>
      <PageHeader
        title="Davomat"
        subtitle="Guruhlar bo'yicha dars sessiyalari va talaba davomati"
        actions={
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className={btnPrimary}
            disabled={groups.length === 0}
          >
            <CalendarPlus size={16} /> Yangi sessiya
          </button>
        }
      />

      {/* Today summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Bugungi sessiyalar"
          value={todayPlanned}
          Icon={ClipboardList}
          tone="blue"
        />
        <StatCard
          label="Yakunlangan"
          value={todayDone}
          Icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Faol guruhlar"
          value={groups.length}
          Icon={BarChart3}
          tone="amber"
        />
      </div>

      {/* Today's sessions widget */}
      {todaySessions.length > 0 && (
        <SurfaceCard className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Clock size={14} className="text-brand-600" />
            Bugun ({todayQ.data?.date})
          </h3>
          <div className="space-y-2">
            {todaySessions.map((s) => (
              <Link
                key={s.id}
                to={`/${slug}/admin/attendance/sessions/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
              >
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold text-slate-900">
                    {s.group_name}
                  </div>
                  {s.start_time && (
                    <span className="text-xs text-slate-500">
                      {s.start_time}
                      {s.end_time ? `–${s.end_time}` : ''}
                    </span>
                  )}
                  {s.is_finalized && (
                    <Chip tone="emerald">
                      <Lock size={10} className="mr-1" /> Yakunlangan
                    </Chip>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-brand-700">
                    {s.rate}%
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {s.total} ta talaba
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {WHEN_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setWhen(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                when === tab.key
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Barcha guruhlar</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sessions table */}
      <TableCard>
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th className={adminTable.th}>Sana</th>
              <th className={adminTable.th}>Guruh</th>
              <th className={adminTable.th}>Vaqt</th>
              <th className={adminTable.th}>Talabalar</th>
              <th className={adminTable.th}>Davomat</th>
              <th className={adminTable.th}>Holat</th>
              <th className={adminTable.th + ' text-right'}>Amal</th>
            </tr>
          </thead>
          <tbody className={adminTable.tbody}>
            {sessionsQ.isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                  <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" />
                  Loading…
                </td>
              </tr>
            ) : (sessionsQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                  Bu yerda hali sessiyalar yo'q. "+ Yangi sessiya" tugmasi bilan boshlang.
                </td>
              </tr>
            ) : (
              sessionsQ.data!.map((s) => (
                <tr key={s.id} className={adminTable.trHover}>
                  <td className={adminTable.td + ' font-medium text-slate-900'}>
                    {new Date(s.date).toLocaleDateString('uz-UZ', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className={adminTable.td}>
                    <Link
                      to={`/${slug}/admin/groups/${s.group}`}
                      className="text-slate-900 hover:text-brand-700"
                    >
                      {s.group_name}
                    </Link>
                  </td>
                  <td className={adminTable.td + ' text-slate-600'}>
                    {s.start_time ? (
                      <>
                        {s.start_time.slice(0, 5)}
                        {s.end_time && `–${s.end_time.slice(0, 5)}`}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={adminTable.td + ' text-slate-700'}>
                    {s.total_count}
                  </td>
                  <td className={adminTable.td}>
                    <span className="font-bold text-slate-900">
                      {s.attendance_rate}%
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      ({s.present_count}/{s.total_count})
                    </span>
                  </td>
                  <td className={adminTable.td}>
                    {s.is_finalized ? (
                      <Chip tone="emerald">
                        <Lock size={10} className="mr-1" /> Yakun
                      </Chip>
                    ) : (
                      <Chip tone="amber">Ochiq</Chip>
                    )}
                  </td>
                  <td className={adminTable.td + ' text-right'}>
                    <div className="inline-flex items-center gap-1">
                      <Link
                        to={`/${slug}/admin/attendance/sessions/${s.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Belgilash
                      </Link>
                      <Link
                        to={`/${slug}/admin/attendance/groups/${s.group}/report`}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <BarChart3 size={12} /> Hisobot
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>

      {showNewModal && slug && (
        <NewSessionModal
          slug={slug}
          groups={groups}
          onClose={() => setShowNewModal(false)}
          onCreated={refreshAll}
        />
      )}
    </PageShell>
  )
}
