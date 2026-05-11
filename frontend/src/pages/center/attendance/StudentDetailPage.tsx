/**
 * ETAP 20 — Talaba detail sahifa.
 *
 * Route: `/<slug>/admin/attendance/student/:studentId`.
 *
 * Photo (placeholder), KPI cards (umumiy %, status bo'yicha) va
 * oxirgi 50 sessiyaning ro'yxati.
 */
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StateCard,
  SurfaceCard,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

type Status = 'present' | 'late' | 'absent' | 'excused' | 'sick'

interface HistoryResponse {
  student: {
    id: number
    name: string
    username: string
    photo_url: string | null
    group_name: string | null
  }
  overall_percent: number | null
  total_marked: number
  by_status: Record<Status, number>
  records: Array<{
    id: number
    session_id: number
    session_date: string
    group_name: string
    status: Status | null
    note: string
  }>
}

const STATUS_LABEL: Record<Status, string> = {
  present: 'Keldi',
  late: 'Kech qoldi',
  absent: 'Kelmadi',
  excused: 'Sababli',
  sick: 'Kasal',
}

const STATUS_CHIP: Record<Status, 'emerald' | 'amber' | 'rose' | 'slate' | 'violet'> = {
  present: 'emerald',
  late: 'amber',
  absent: 'rose',
  excused: 'slate',
  sick: 'violet',
}

export default function StudentAttendanceDetailPage() {
  const { slug, studentId } = useParams<{ slug: string; studentId: string }>()

  const q = useQuery({
    queryKey: ['attendance-student-history', slug, studentId],
    queryFn: async () => {
      return (
        await api.get<HistoryResponse>(
          `/center/${slug}/attendance/v2/students/${studentId}/history/`,
        )
      ).data
    },
    enabled: !!slug && !!studentId,
  })

  return (
    <PageShell maxWidth="max-w-5xl">
      <Link
        to={`/${slug}/admin/attendance`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-700"
      >
        <ArrowLeft size={14} /> Davomatga qaytish
      </Link>

      {q.isLoading ? (
        <SurfaceCard className="text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" /> Yuklanmoqda...
        </SurfaceCard>
      ) : q.isError || !q.data ? (
        <StateCard
          title="Ma'lumot olinmadi"
          description="Talaba topilmadi yoki sizda ko'rish huquqi yo'q."
        />
      ) : (
        <>
          <PageHeader
            title={q.data.student.name}
            subtitle={
              <>
                @{q.data.student.username}
                {q.data.student.group_name && (
                  <>
                    {' · '}
                    Guruh: <span className="font-bold">{q.data.student.group_name}</span>
                  </>
                )}
              </>
            }
          />

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-[11px] font-bold uppercase text-brand-700">
                Umumiy davomat
              </p>
              <p className="mt-1 text-2xl font-extrabold text-brand-700">
                {q.data.overall_percent != null ? `${q.data.overall_percent}%` : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-[11px] font-bold uppercase text-emerald-700">Keldi</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                {q.data.by_status.present}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-[11px] font-bold uppercase text-amber-700">Kech qoldi</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-700">
                {q.data.by_status.late}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-[11px] font-bold uppercase text-rose-700">Kelmadi</p>
              <p className="mt-1 text-2xl font-extrabold text-rose-700">
                {q.data.by_status.absent}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase text-slate-600">Sababli</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-700">
                {q.data.by_status.excused + q.data.by_status.sick}
              </p>
            </div>
          </div>

          <SurfaceCard>
            <h2 className="mb-3 text-sm font-extrabold text-slate-900">
              So'nggi {q.data.records.length} sessiya
            </h2>
            {q.data.records.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Sessiya tarixi topilmadi
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {q.data.records.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        {new Date(r.session_date).toLocaleDateString('uz-UZ', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="truncate text-xs text-slate-500">{r.group_name}</p>
                    </div>
                    <div className="text-right">
                      {r.status ? (
                        <Chip tone={STATUS_CHIP[r.status]}>
                          {STATUS_LABEL[r.status]}
                        </Chip>
                      ) : (
                        <Chip tone="slate">Belgilanmagan</Chip>
                      )}
                      {r.note && (
                        <p className="mt-0.5 text-[11px] italic text-slate-500">
                          {r.note}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>
        </>
      )}
    </PageShell>
  )
}
