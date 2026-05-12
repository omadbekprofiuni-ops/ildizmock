import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '@/lib/api'

import TeacherLayout from '../TeacherLayout'

interface Row {
  id: number
  exam_taker_id: string
  full_name: string
  session: string
  session_date: string
  anonymous_grading?: boolean
}

export default function MockSpeakingQueuePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Row[]>('/teacher/mock/speaking/queue/')
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <TeacherLayout>
      <header className="border-b bg-white px-8 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Speaking baholash navbati</h1>
            <p className="text-sm text-slate-500">
              Yuzma-yuz Speaking testdan keyin yakuniy ballni kiriting.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            🔒 Anonim baholash
          </div>
        </div>
      </header>

      <div className="p-8">
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-12 text-center">
            <div className="mb-2 text-3xl">✓</div>
            <p className="text-lg font-medium text-emerald-800">
              Speaking baholash kutmaydi
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-white">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
                  <th className="p-4">Exam Taker ID</th>
                  <th className="p-4">Session</th>
                  <th className="p-4 text-center">Date</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold tracking-wider text-rose-700">
                      {r.exam_taker_id || r.full_name}
                    </td>
                    <td className="p-4 text-sm text-slate-700">{r.session}</td>
                    <td className="p-4 text-center text-sm">{r.session_date}</td>
                    <td className="p-4 text-right">
                      <Link
                        to={`/teacher/mock/speaking/${r.id}`}
                        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Baholash →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TeacherLayout>
  )
}
