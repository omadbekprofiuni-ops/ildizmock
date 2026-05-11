/**
 * ETAP 20 Tab 1 — Bugungi davomat.
 *
 * O'qituvchi bir sessiyaning barcha talabalariga 4 statusdan birini belgilaydi:
 * Keldi / Kech qoldi / Kelmadi / Sababli. "Sababli" tanlansa note majburiy.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Loader2, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { StateCard, SurfaceCard, btnOutline, btnPrimary } from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import type { AttendanceGroup } from '../AttendancePage'

type Status = 'present' | 'late' | 'absent' | 'excused'

interface RecordRow {
  id: number | null
  student_id: number
  student_name: string
  username: string
  photo_url: string | null
  status: Status | null
  note: string
}

interface TodayResponse {
  date: string
  group: { id: number; name: string }
  session: {
    id: number
    date: string
    start_time: string | null
    end_time: string | null
    is_finalized: boolean
    is_locked: boolean
    notes: string
  } | null
  students?: Array<{ id: number; name: string; username: string; photo_url: string | null }>
  records: Array<{
    id: number
    student_id: number
    student_name: string
    username: string
    photo_url: string | null
    status: Status | 'sick' | null
    note: string
  }>
}

const STATUS_META: Record<Status, {
  label: string
  short: string
  Icon: typeof CheckCircle2
  /** Faol (tanlangan) tugma uchun */
  active: string
  /** Faol bo'lmagan tugma uchun (outlined) */
  outline: string
}> = {
  present: {
    label: 'Keldi',
    short: '✓',
    Icon: CheckCircle2,
    active: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
    outline: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  },
  late: {
    label: 'Kech',
    short: '⏱',
    Icon: Clock,
    active: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
    outline: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  absent: {
    label: 'Kelmadi',
    short: '✗',
    Icon: X,
    active: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600',
    outline: 'border-rose-300 text-rose-700 hover:bg-rose-50',
  },
  excused: {
    label: 'Sababli',
    short: 'E',
    Icon: ShieldCheck,
    active: 'bg-slate-600 hover:bg-slate-700 text-white border-slate-600',
    outline: 'border-slate-300 text-slate-700 hover:bg-slate-50',
  },
}

const STATUSES: Status[] = ['present', 'late', 'absent', 'excused']

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AttendanceTodayTab({
  slug,
  groups,
  loadingGroups,
}: {
  slug: string
  groups: AttendanceGroup[]
  loadingGroups: boolean
}) {
  const qc = useQueryClient()
  const [groupId, setGroupId] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(todayIso())
  const [rows, setRows] = useState<RecordRow[]>([])

  // Birinchi guruhni avtomatik tanlash
  useEffect(() => {
    if (groups.length > 0 && groupId === null) {
      setGroupId(groups[0].id)
    }
  }, [groups, groupId])

  const todayQ = useQuery({
    queryKey: ['attendance-today-v2', slug, groupId, selectedDate],
    queryFn: async () => {
      const { data } = await api.get<TodayResponse>(
        `/center/${slug}/attendance/v2/today-session/`,
        { params: { group: groupId, date: selectedDate } },
      )
      return data
    },
    enabled: !!groupId,
  })

  // Server javobi kelganda local rows'ni yangilaymiz
  useEffect(() => {
    if (!todayQ.data) return
    if (todayQ.data.session) {
      setRows(
        todayQ.data.records.map((r) => ({
          id: r.id,
          student_id: r.student_id,
          student_name: r.student_name,
          username: r.username,
          photo_url: r.photo_url,
          status:
            r.status === 'sick' ? 'excused' : (r.status as Status | null),
          note: r.note ?? '',
        })),
      )
    } else {
      // Sessiya yo'q — talabalar ro'yxati ko'rsatamiz (read-only)
      setRows(
        (todayQ.data.students ?? []).map((s) => ({
          id: null,
          student_id: s.id,
          student_name: s.name,
          username: s.username,
          photo_url: s.photo_url,
          status: null,
          note: '',
        })),
      )
    }
  }, [todayQ.data])

  const updateRow = (studentId: number, patch: Partial<RecordRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)),
    )
  }

  const markAllPresent = () => {
    setRows((prev) => prev.map((r) => ({ ...r, status: 'present', note: '' })))
  }

  const reset = () => {
    if (todayQ.data?.records) {
      setRows(
        todayQ.data.records.map((r) => ({
          id: r.id,
          student_id: r.student_id,
          student_name: r.student_name,
          username: r.username,
          photo_url: r.photo_url,
          status: r.status === 'sick' ? 'excused' : (r.status as Status | null),
          note: r.note ?? '',
        })),
      )
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const session = todayQ.data?.session
      if (!session) throw new Error('no_session')
      const payload = {
        records: rows
          .filter((r) => r.status && r.id)
          .map((r) => ({
            record_id: r.id,
            student_id: r.student_id,
            status: r.status,
            note: r.note,
          })),
      }
      return (await api.post(
        `/center/${slug}/attendance/v2/sessions/${session.id}/bulk-mark/`,
        payload,
      )).data
    },
    onSuccess: (data) => {
      toast.success(`Davomat saqlandi (${data?.saved ?? 0} ta)`)
      qc.invalidateQueries({ queryKey: ['attendance-today-v2', slug] })
    },
    onError: () => toast.error('Saqlashda xatolik'),
  })

  const handleSave = () => {
    const missingNote = rows.find(
      (r) => r.status === 'excused' && !r.note.trim(),
    )
    if (missingNote) {
      toast.error(
        `${missingNote.student_name}: Sababli kelmagan uchun izoh majburiy`,
      )
      return
    }
    const unmarked = rows.filter((r) => !r.status).length
    if (unmarked > 0) {
      const ok = window.confirm(
        `${unmarked} ta talaba markirovkasiz. Saqlashni davom etamizmi?`,
      )
      if (!ok) return
    }
    saveMut.mutate()
  }

  const markedCount = useMemo(() => rows.filter((r) => r.status).length, [rows])
  const session = todayQ.data?.session

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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <SurfaceCard className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1 grid grid-cols-1 gap-3 md:grid-cols-2">
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
              Sana
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <button
            type="button"
            onClick={markAllPresent}
            disabled={!session || session.is_locked}
            className={btnOutline}
          >
            <CheckCircle2 size={14} /> Hammasi keldi
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!session}
            className={btnOutline}
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!session || session.is_locked || saveMut.isPending}
            className={btnPrimary}
          >
            {saveMut.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </SurfaceCard>

      {/* Session info OR empty state */}
      {todayQ.isLoading ? (
        <SurfaceCard className="text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" /> Yuklanmoqda...
        </SurfaceCard>
      ) : !session ? (
        <StateCard
          title="Bu sanada sessiya yo'q"
          description="Sessiya yaratish uchun ro'yxat sahifasidan boshlang yoki boshqa sanani tanlang."
        />
      ) : (
        <>
          <SurfaceCard padding="p-4" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Sana</p>
              <p className="font-extrabold text-slate-900">{session.date}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Vaqt</p>
              <p className="font-extrabold text-slate-900">
                {session.start_time ?? '—'}
                {session.end_time ? `–${session.end_time}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Holat</p>
              <p className="font-extrabold text-slate-900">
                {session.is_locked
                  ? 'Yopilgan (read-only)'
                  : session.is_finalized
                  ? 'Yakunlangan'
                  : 'Ochiq'}
              </p>
            </div>
            <div className="ml-auto">
              <p className="text-[11px] font-bold uppercase text-slate-500">Markirovka</p>
              <p className="font-extrabold text-brand-700">
                {markedCount} / {rows.length}
              </p>
            </div>
          </SurfaceCard>

          {/* Students list */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => {
                const meta = row.status ? STATUS_META[row.status] : null
                return (
                  <li
                    key={row.student_id}
                    className="flex flex-col gap-3 p-4 md:flex-row md:items-center"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">
                        {row.student_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {row.student_name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          @{row.username}
                        </p>
                        {row.status === 'excused' && (
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) =>
                              updateRow(row.student_id, { note: e.target.value })
                            }
                            placeholder="Sabab (majburiy)"
                            className="mt-2 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 md:shrink-0">
                      {STATUSES.map((s) => {
                        const isActive = row.status === s
                        const sm = STATUS_META[s]
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={session.is_locked}
                            onClick={() => updateRow(row.student_id, { status: s })}
                            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                              isActive ? sm.active : sm.outline
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            <span aria-hidden>{sm.short}</span>
                            <span>{sm.label}</span>
                          </button>
                        )
                      })}
                      {meta && row.status !== 'excused' && row.note && (
                        <span className="ml-1 text-[11px] italic text-slate-500">
                          {row.note}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
              {rows.length === 0 && (
                <li className="p-10 text-center text-sm text-slate-400">
                  Guruhda talabalar topilmadi
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
