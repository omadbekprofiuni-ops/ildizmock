import {
  ArrowLeft,
  BookOpen,
  Headphones,
  PenLine,
  Trophy,
  User as UserIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  PageHeader,
  PageShell,
  StateCard,
  SurfaceCard,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

type Module = 'listening' | 'reading' | 'writing'

type StudentStats = {
  student: {
    id: number
    username: string
    first_name?: string
    last_name?: string
    phone?: string | null
    is_active?: boolean
  }
  per_module: Record<Module, {
    count: number
    best: number | null
    avg: number | null
  }>
  attempts: {
    id: string
    test_name: string
    module: Module
    band_score: number | null
    raw_score: number | null
    total_questions: number | null
    submitted_at: string | null
    status: string
  }[]
  mocks: {
    id: number
    session_id: number
    session_name: string
    date: string | null
    overall_band: number | null
    listening: number | null
    reading: number | null
    writing: number | null
  }[]
}

const MODULE_META: Record<Module, { label: string; Icon: typeof Headphones; tint: string }> = {
  listening: { label: 'Listening', Icon: Headphones, tint: 'text-blue-700 bg-blue-50' },
  reading: { label: 'Reading', Icon: BookOpen, tint: 'text-purple-700 bg-purple-50' },
  writing: { label: 'Writing', Icon: PenLine, tint: 'text-orange-700 bg-orange-50' },
}

export default function StudentDetailPage() {
  const { slug, studentId } = useParams<{ slug: string; studentId: string }>()
  const [data, setData] = useState<StudentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug || !studentId) return
    setLoading(true)
    api
      .get<StudentStats>(`/center/${slug}/students/${studentId}/stats/`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [slug, studentId])

  if (loading) {
    return (
      <PageShell>
        <StateCard Icon={UserIcon} title="Yuklanmoqda…" />
      </PageShell>
    )
  }
  if (!data) {
    return (
      <PageShell>
        <StateCard Icon={UserIcon} title="Talaba topilmadi" />
      </PageShell>
    )
  }

  const fullName =
    `${data.student.first_name ?? ''} ${data.student.last_name ?? ''}`.trim() ||
    data.student.username

  return (
    <PageShell>
      <Link
        to={`/${slug}/admin/students`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
      >
        <ArrowLeft size={14} /> O'quvchilar
      </Link>

      <PageHeader
        title={fullName}
        subtitle={`@${data.student.username}${data.student.phone ? ' · ' + data.student.phone : ''}`}
      />

      {/* Module stats */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(Object.keys(MODULE_META) as Module[]).map((m) => {
          const meta = MODULE_META[m]
          const s = data.per_module[m]
          return (
            <div key={m} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.tint}`}>
                  <meta.Icon size={18} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {meta.label}
                  </div>
                  <div className="text-sm text-slate-700">
                    {s.count} ta urinish
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 px-2 py-2">
                  <div className="text-xs text-slate-500">Eng yaxshi</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {s.best != null ? s.best.toFixed(1) : '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-2">
                  <div className="text-xs text-slate-500">O‘rtacha</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {s.avg != null ? s.avg.toFixed(1) : '—'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Attempts */}
      <SurfaceCard>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">
          Practice / individual urinishlar ({data.attempts.length})
        </h3>
        {data.attempts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Hozircha urinish yo‘q.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Sana</th>
                  <th className="px-3 py-2">Test</th>
                  <th className="px-3 py-2">Modul</th>
                  <th className="px-3 py-2 text-center">Band</th>
                  <th className="px-3 py-2 text-center">Raw</th>
                  <th className="px-3 py-2 text-center">Holati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleDateString('uz-UZ', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/result/${a.id}`}
                        className="font-medium text-slate-900 hover:text-red-700"
                      >
                        {a.test_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${MODULE_META[a.module].tint}`}
                      >
                        {MODULE_META[a.module].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-slate-900">
                      {a.band_score != null ? a.band_score.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600">
                      {a.raw_score != null && a.total_questions != null
                        ? `${a.raw_score}/${a.total_questions}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-slate-500">
                      {a.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Mocks */}
      <SurfaceCard>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">
          Mock sessiyalar ({data.mocks.length})
        </h3>
        {data.mocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Hozircha mock sessiyada qatnashmagan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Sana</th>
                  <th className="px-3 py-2">Sessiya</th>
                  <th className="px-3 py-2 text-center">Listening</th>
                  <th className="px-3 py-2 text-center">Reading</th>
                  <th className="px-3 py-2 text-center">Writing</th>
                  <th className="px-3 py-2 text-center">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.mocks.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {m.date
                        ? new Date(m.date).toLocaleDateString('uz-UZ', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {m.session_name}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.listening != null ? m.listening.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.reading != null ? m.reading.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.writing != null ? m.writing.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-amber-600">
                      <span className="inline-flex items-center gap-1">
                        {m.overall_band != null && (
                          <Trophy size={12} className="text-amber-500" />
                        )}
                        {m.overall_band != null ? m.overall_band.toFixed(1) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </PageShell>
  )
}
