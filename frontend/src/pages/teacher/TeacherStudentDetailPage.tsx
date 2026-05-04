import {
  ArrowLeft,
  BookOpen,
  Headphones,
  Loader2,
  PenLine,
  Trophy,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

import TeacherLayout from './TeacherLayout'

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
  per_module: Record<Module, { count: number; best: number | null; avg: number | null }>
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

export default function TeacherStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [data, setData] = useState<StudentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    api
      .get<StudentStats>(`/teacher/students/${studentId}/stats/`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [studentId])

  return (
    <TeacherLayout>
      <div className="container space-y-6 py-8">
        <Link to="/teacher/students" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600">
          <ArrowLeft size={14} /> Students
        </Link>

        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        )}

        {!loading && !data && <p className="text-slate-500">Student not found.</p>}

        {data && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {`${data.student.first_name ?? ''} ${data.student.last_name ?? ''}`.trim() || data.student.username}
              </h1>
              <p className="text-sm text-slate-500">@{data.student.username}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(Object.keys(MODULE_META) as Module[]).map((m) => {
                const meta = MODULE_META[m]
                const s = data.per_module[m]
                return (
                  <Card key={m}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.tint}`}>
                          <meta.Icon size={18} />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">{meta.label}</div>
                          <div className="text-sm text-slate-700">{s.count} ta urinish</div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg bg-slate-50 px-2 py-2">
                          <div className="text-xs text-slate-500">Best</div>
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
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Card>
              <CardContent className="p-4">
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
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Test</th>
                          <th className="px-3 py-2">Modul</th>
                          <th className="px-3 py-2 text-center">Band</th>
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
                            <td className="px-3 py-2 font-medium text-slate-900">{a.test_name}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${MODULE_META[a.module].tint}`}>
                                {MODULE_META[a.module].label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold">
                              {a.band_score != null ? a.band_score.toFixed(1) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">
                  Mock sessions ({data.mocks.length})
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
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Session</th>
                          <th className="px-3 py-2 text-center">L</th>
                          <th className="px-3 py-2 text-center">R</th>
                          <th className="px-3 py-2 text-center">W</th>
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
                                  })
                                : '—'}
                            </td>
                            <td className="px-3 py-2 font-medium">{m.session_name}</td>
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
                                {m.overall_band != null && <Trophy size={12} />}
                                {m.overall_band != null ? m.overall_band.toFixed(1) : '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TeacherLayout>
  )
}
