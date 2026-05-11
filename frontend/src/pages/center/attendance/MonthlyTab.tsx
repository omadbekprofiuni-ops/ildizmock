/**
 * ETAP 20 Tab 2 — Oylik jadval.
 *
 * Division Register-style: talabalar qator, sessiyalar (kunlar) ustun,
 * hujayralarda ✓/⏱/✗/E. Sticky chap ustunlar (№, F.I.O).
 *
 * Action'lar: Print (A4 landscape), Excel eksport, hujayrani bossa edit modal.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, Download, Loader2, Printer, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  StateCard,
  StatCard,
  SurfaceCard,
  btnOutline,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

import type { AttendanceGroup } from '../AttendancePage'

import CellEditModal, { type CellEditContext } from './CellEditModal'

type Status = 'present' | 'late' | 'absent' | 'excused' | 'sick'

interface StudentRow {
  id: number
  name: string
  username: string
  photo_url: string | null
}

interface SessionCol {
  id: number
  date: string
  day: number
  weekday: string
  is_locked: boolean
}

interface Cell {
  student_id: number
  session_id: number
  record_id: number
  status: Status | null
  note: string
}

interface Summary {
  present: number
  late: number
  absent: number
  excused: number
  sick: number
  unmarked: number
  marked: number
  total_sessions: number
  percent: number | null
}

interface MonthlyGridResponse {
  group: { id: number; name: string }
  year: number
  month: number
  students: StudentRow[]
  sessions: SessionCol[]
  cells: Cell[]
  summary: Record<string, Summary>
  group_stats: {
    avg_percent: number | null
    today_percent: number | null
    at_risk_count: number
    total_students: number
    total_sessions: number
  }
}

const STATUS_VISUAL: Record<Status, { icon: string; bg: string }> = {
  present: { icon: '✓', bg: 'bg-emerald-100 text-emerald-700' },
  late: { icon: '⏱', bg: 'bg-amber-100 text-amber-700' },
  absent: { icon: '✗', bg: 'bg-rose-100 text-rose-700' },
  excused: { icon: 'E', bg: 'bg-slate-200 text-slate-700' },
  sick: { icon: 'E', bg: 'bg-slate-200 text-slate-700' },
}

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]

export default function AttendanceMonthlyTab({
  slug,
  groups,
  loadingGroups,
}: {
  slug: string
  groups: AttendanceGroup[]
  loadingGroups: boolean
}) {
  const qc = useQueryClient()
  const today = new Date()
  const [groupId, setGroupId] = useState<number | null>(
    groups[0]?.id ?? null,
  )
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [editing, setEditing] = useState<CellEditContext | null>(null)

  // Birinchi guruhni avtomatik tanlash (groups async kelganda)
  if (groupId === null && groups.length > 0) {
    setGroupId(groups[0].id)
  }

  const gridQ = useQuery({
    queryKey: ['attendance-monthly-grid', slug, groupId, year, month],
    queryFn: async () => {
      const { data } = await api.get<MonthlyGridResponse>(
        `/center/${slug}/attendance/v2/monthly-grid/`,
        { params: { group: groupId, year, month } },
      )
      return data
    },
    enabled: !!groupId,
  })

  const cellMap = useMemo(() => {
    const m = new Map<string, Cell>()
    for (const c of gridQ.data?.cells ?? []) {
      m.set(`${c.student_id}-${c.session_id}`, c)
    }
    return m
  }, [gridQ.data])

  const baseUrl = api.defaults.baseURL ?? ''
  const exportUrl = `${baseUrl}/center/${slug}/attendance/v2/export.xlsx?group=${groupId}&year=${year}&month=${month}`

  const handlePrint = () => window.print()

  if (loadingGroups) {
    return (
      <SurfaceCard className="text-center text-sm text-slate-500">
        <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" /> Yuklanmoqda...
      </SurfaceCard>
    )
  }
  if (groups.length === 0) {
    return (
      <StateCard
        title="Faol guruh yo'q"
        description="Avval guruh yarating, so'ngra sessiya yarating."
      />
    )
  }

  const data = gridQ.data

  return (
    <div className="space-y-4 attendance-monthly">
      {/* Controls — non-print */}
      <SurfaceCard className="flex flex-col gap-3 md:flex-row md:items-end print:hidden">
        <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Guruh
            </span>
            <select
              value={groupId ?? ''}
              onChange={(e) => setGroupId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Oy
            </span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {MONTH_NAMES.map((label, idx) => (
                <option key={idx} value={idx + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Yil
            </span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2 md:ml-auto">
          <button type="button" onClick={handlePrint} className={btnOutline}>
            <Printer size={14} /> Print
          </button>
          <a href={exportUrl} className={btnOutline} download>
            <Download size={14} /> Excel
          </a>
        </div>
      </SurfaceCard>

      {/* KPI cards — non-print */}
      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
          <StatCard
            label="O'rtacha davomat"
            value={data.group_stats.avg_percent != null ? `${data.group_stats.avg_percent}%` : '—'}
            Icon={BarChart3}
            tone="indigo"
            hint={`${data.group_stats.total_students} ta talaba`}
          />
          <StatCard
            label="Bugungi davomat"
            value={
              data.group_stats.today_percent != null
                ? `${data.group_stats.today_percent}%`
                : '—'
            }
            Icon={Users}
            tone="emerald"
            hint="bugungi sessiya"
          />
          <StatCard
            label="Xavfli talabalar"
            value={data.group_stats.at_risk_count}
            Icon={AlertTriangle}
            tone="rose"
            hint="< 70% davomat"
          />
        </div>
      )}

      {/* Print header */}
      <div className="hidden text-center print:block">
        <h1 className="text-xl font-extrabold text-slate-900">Davomat jadvali</h1>
        <p className="text-sm text-slate-700">
          {data?.group.name} — {MONTH_NAMES[month - 1]} {year}
        </p>
      </div>

      {/* Grid */}
      {gridQ.isLoading ? (
        <SurfaceCard className="text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" /> Yuklanmoqda...
        </SurfaceCard>
      ) : !data ? (
        <StateCard title="Ma'lumot yo'q" />
      ) : data.sessions.length === 0 ? (
        <StateCard
          title="Bu oyda sessiya yo'q"
          description={`${MONTH_NAMES[month - 1]} ${year} oyida ${data.group.name} guruhi uchun sessiyalar mavjud emas.`}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm attendance-grid">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3 text-left">№</th>
                  <th className="sticky left-10 z-10 min-w-[200px] bg-slate-50 px-3 py-3 text-left">
                    F.I.O
                  </th>
                  {data.sessions.map((s) => (
                    <th key={s.id} className="px-1.5 py-2 text-center font-bold">
                      <div className="text-sm text-slate-900">{s.day}</div>
                      <div className="text-[10px] font-medium text-slate-400">
                        {s.weekday}
                      </div>
                    </th>
                  ))}
                  <th className="bg-brand-50 px-3 py-2 text-center text-brand-700">%</th>
                  <th className="bg-emerald-50 px-2 py-2 text-center text-emerald-700">✓</th>
                  <th className="bg-amber-50 px-2 py-2 text-center text-amber-700">⏱</th>
                  <th className="bg-rose-50 px-2 py-2 text-center text-rose-700">✗</th>
                  <th className="bg-slate-100 px-2 py-2 text-center text-slate-700">E</th>
                  <th className="px-2 py-2 text-center">Jami</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.students.map((s, idx) => {
                  const summary = data.summary[s.id] ?? {
                    present: 0,
                    late: 0,
                    absent: 0,
                    excused: 0,
                    sick: 0,
                    unmarked: data.sessions.length,
                    marked: 0,
                    total_sessions: data.sessions.length,
                    percent: null,
                  }
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="sticky left-10 z-10 bg-white px-3 py-2 font-medium">
                        <Link
                          to={`/${slug}/admin/attendance/student/${s.id}`}
                          className="text-slate-900 hover:text-brand-700 hover:underline"
                        >
                          {s.name}
                        </Link>
                      </td>
                      {data.sessions.map((sess) => {
                        const cell = cellMap.get(`${s.id}-${sess.id}`)
                        const visual = cell?.status
                          ? STATUS_VISUAL[cell.status]
                          : null
                        return (
                          <td key={sess.id} className="p-0.5 text-center">
                            <button
                              type="button"
                              title={cell?.note || ''}
                              disabled={!cell || sess.is_locked}
                              onClick={() => {
                                if (!cell) return
                                setEditing({
                                  slug,
                                  recordId: cell.record_id,
                                  studentName: s.name,
                                  sessionDate: sess.date,
                                  currentStatus:
                                    cell.status === 'sick'
                                      ? 'excused'
                                      : (cell.status as
                                          | 'present'
                                          | 'late'
                                          | 'absent'
                                          | 'excused'
                                          | null),
                                  currentNote: cell.note ?? '',
                                })
                              }}
                              className={`h-8 w-8 rounded text-xs font-extrabold transition-colors ${
                                visual?.bg ??
                                'border border-slate-200 bg-white text-slate-300 hover:bg-slate-100'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {visual?.icon ?? ''}
                            </button>
                          </td>
                        )
                      })}
                      <td
                        className={`px-3 py-2 text-center font-extrabold ${
                          summary.percent != null && summary.percent < 70
                            ? 'text-rose-600'
                            : 'text-brand-700'
                        }`}
                      >
                        {summary.percent != null ? `${summary.percent}%` : '—'}
                      </td>
                      <td className="px-2 py-2 text-center text-emerald-700">
                        {summary.present}
                      </td>
                      <td className="px-2 py-2 text-center text-amber-700">
                        {summary.late}
                      </td>
                      <td className="px-2 py-2 text-center text-rose-700">
                        {summary.absent}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600">
                        {summary.excused + summary.sick}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-500">
                        {summary.total_sessions}
                      </td>
                    </tr>
                  )
                })}
                {data.students.length === 0 && (
                  <tr>
                    <td
                      colSpan={data.sessions.length + 7}
                      className="px-3 py-10 text-center text-sm text-slate-400"
                    >
                      Guruhda talabalar topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 px-1 print:px-0">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-100 font-bold text-emerald-700">
            ✓
          </span>
          Keldi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-100 font-bold text-amber-700">
            ⏱
          </span>
          Kech qoldi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-rose-100 font-bold text-rose-700">
            ✗
          </span>
          Kelmadi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-slate-200 font-bold text-slate-700">
            E
          </span>
          Sababli
        </span>
      </div>

      {editing && (
        <CellEditModal
          ctx={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            qc.invalidateQueries({ queryKey: ['attendance-monthly-grid', slug] })
          }}
        />
      )}
    </div>
  )
}
