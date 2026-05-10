import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  Lock,
  RotateCw,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StatCard,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Status = 'present' | 'absent' | 'late' | 'excused' | 'sick'

type AttRecord = {
  id: number
  student: number
  student_name: string
  student_username: string
  status: Status
  status_label: string
  notes: string
  marked_at: string
  marked_by_name: string | null
}

type SessionDetail = {
  id: number
  group: number
  group_name: string
  date: string
  start_time: string | null
  end_time: string | null
  is_finalized: boolean
  notes: string
  attendance_rate: number
  present_count: number
  absent_count: number
  total_count: number
  records: AttRecord[]
}

const STATUS_META: globalThis.Record<Status, {
  label: string
  chip: 'emerald' | 'rose' | 'amber' | 'blue' | 'violet'
  activeBg: string  // explicit class so Tailwind JIT can find it
  Icon: typeof CheckCircle2
}> = {
  present:  { label: 'Keldi',     chip: 'emerald', activeBg: 'bg-emerald-600 hover:bg-emerald-700 text-white', Icon: CheckCircle2 },
  absent:   { label: 'Kelmadi',   chip: 'rose',    activeBg: 'bg-cta-600 hover:bg-rose-700 text-white',       Icon: X },
  late:     { label: 'Kechikdi',  chip: 'amber',   activeBg: 'bg-amber-600 hover:bg-amber-700 text-white',     Icon: Clock },
  excused:  { label: 'Sababli',   chip: 'blue',    activeBg: 'bg-blue-600 hover:bg-blue-700 text-white',       Icon: ShieldCheck },
  sick:     { label: 'Kasal',     chip: 'violet',  activeBg: 'bg-violet-600 hover:bg-violet-700 text-white',   Icon: Heart },
}

export default function AttendanceMarkPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>()
  const qc = useQueryClient()

  const sessionQ = useQuery({
    queryKey: ['attendance-session', slug, sessionId],
    queryFn: async () =>
      (await api.get<SessionDetail>(
        `/center/${slug}/attendance/sessions/${sessionId}/`,
      )).data,
  })

  // Mahalliy o'zgarishlarni saqlash uchun draft state
  const [drafts, setDrafts] = useState<Map<number, { status: Status; notes: string }>>(new Map())
  const [search, setSearch] = useState('')

  useEffect(() => {
    setDrafts(new Map())
  }, [sessionId])

  const updateDraft = (recId: number, patch: Partial<{ status: Status; notes: string }>) => {
    setDrafts((prev) => {
      const next = new Map(prev)
      const current = next.get(recId) ?? {
        status: sessionQ.data?.records.find((r) => r.id === recId)?.status ?? 'present',
        notes: sessionQ.data?.records.find((r) => r.id === recId)?.notes ?? '',
      }
      next.set(recId, { ...current, ...patch })
      return next
    })
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const records = Array.from(drafts.entries()).map(([record_id, v]) => ({
        record_id, status: v.status, notes: v.notes,
      }))
      return (await api.post(
        `/center/${slug}/attendance/sessions/${sessionId}/bulk-mark/`,
        { records },
      )).data
    },
    onSuccess: (data: { updated: number; attendance_rate: number }) => {
      toast.success(`${data.updated} ta yangilandi · ${data.attendance_rate}%`)
      setDrafts(new Map())
      qc.invalidateQueries({ queryKey: ['attendance-session', slug, sessionId] })
      qc.invalidateQueries({ queryKey: ['attendance-sessions', slug] })
    },
    onError: (e) => {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      toast.error(msg || "Saqlab bo'lmadi")
    },
  })

  const finalizeMut = useMutation({
    mutationFn: async () =>
      (await api.post(`/center/${slug}/attendance/sessions/${sessionId}/finalize/`)).data,
    onSuccess: () => {
      toast.success('Session ended')
      qc.invalidateQueries({ queryKey: ['attendance-session', slug, sessionId] })
      qc.invalidateQueries({ queryKey: ['attendance-sessions', slug] })
    },
  })

  const reopenMut = useMutation({
    mutationFn: async () =>
      (await api.post(`/center/${slug}/attendance/sessions/${sessionId}/reopen/`)).data,
    onSuccess: () => {
      toast.success('Session reopened')
      qc.invalidateQueries({ queryKey: ['attendance-session', slug, sessionId] })
    },
  })

  if (sessionQ.isLoading) {
    return (
      <PageShell>
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </PageShell>
    )
  }

  const session = sessionQ.data
  if (!session) {
    return (
      <PageShell>
        <SurfaceCard>Session not found.</SurfaceCard>
      </PageShell>
    )
  }

  const records = session.records.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.student_name.toLowerCase().includes(q)
      || r.student_username.toLowerCase().includes(q)
  })

  const dirtyCount = drafts.size
  const locked = session.is_finalized

  return (
    <PageShell>
      <PageHeader
        title={`${session.group_name} — ${new Date(session.date).toLocaleDateString('uz-UZ', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`}
        subtitle={
          session.start_time && session.end_time
            ? `${session.start_time.slice(0, 5)}–${session.end_time.slice(0, 5)}`
            : 'Vaqt kiritilmagan'
        }
        actions={
          <Link to={`/${slug}/admin/attendance`} className={btnOutline}>
            <ArrowLeft size={16} /> Attendance
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={session.total_count} tone="slate" />
        <StatCard label="Keldi" value={session.present_count} tone="emerald" />
        <StatCard label="Kelmadi" value={session.absent_count} tone="rose" />
        <StatCard
          label="Attendance"
          value={`${session.attendance_rate}%`}
          tone="blue"
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          {locked ? (
            <>
              <Chip tone="emerald">
                <Lock size={12} className="mr-1" /> Yakunlangan
              </Chip>
              <button
                onClick={() => reopenMut.mutate()}
                className={btnOutline}
                disabled={reopenMut.isPending}
              >
                <RotateCw size={14} /> Qayta ochish
              </button>
            </>
          ) : (
            <>
              {dirtyCount > 0 && (
                <span className="text-xs text-slate-500">
                  {dirtyCount} ta o'zgarish
                </span>
              )}
              <button
                onClick={() => saveMut.mutate()}
                className={btnPrimary}
                disabled={dirtyCount === 0 || saveMut.isPending}
              >
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  if (confirm("Sessiyani yakunlaysizmi? Keyin o'zgartirib bo'lmaydi.")) {
                    finalizeMut.mutate()
                  }
                }}
                className={btnOutline}
                disabled={finalizeMut.isPending}
              >
                <Lock size={14} /> Yakunlash
              </button>
            </>
          )}
        </div>
      </div>

      <SurfaceCard padding="p-0">
        <div className="divide-y divide-slate-100">
          {records.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {search ? 'Student not found' : 'No students in this group'}
            </div>
          ) : records.map((rec) => {
            const draft = drafts.get(rec.id)
            const status: Status = draft?.status ?? rec.status
            const notes = draft?.notes ?? rec.notes
            const meta = STATUS_META[status]
            return (
              <div key={rec.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">
                    {rec.student_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {rec.student_name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      @{rec.student_username}
                    </p>
                  </div>
                  <Chip tone={meta.chip}>
                    <meta.Icon size={12} className="mr-1" />
                    {meta.label}
                  </Chip>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(['present', 'absent', 'late', 'excused', 'sick'] as Status[]).map((s) => {
                    const m = STATUS_META[s]
                    const active = status === s
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={locked}
                        onClick={() => updateDraft(rec.id, { status: s })}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          active
                            ? m.activeBg
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title={m.label}
                      >
                        <m.Icon size={12} />
                        <span className="hidden sm:inline">{m.label}</span>
                      </button>
                    )
                  })}
                  {(status === 'late' || status === 'excused' || status === 'sick' || notes) && (
                    <Input
                      placeholder="izoh"
                      value={notes}
                      disabled={locked}
                      onChange={(e) => updateDraft(rec.id, { notes: e.target.value })}
                      className="h-8 w-40 text-xs"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SurfaceCard>
    </PageShell>
  )
}
