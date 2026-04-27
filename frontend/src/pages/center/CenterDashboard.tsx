import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

interface Stats {
  students: number
  teachers: number
  tests: number
}

export default function CenterDashboard() {
  const { slug } = useParams<{ slug: string }>()
  const [stats, setStats] = useState<Stats>({ students: 0, teachers: 0, tests: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([
      api.get(`/center/${slug}/students/`),
      api.get(`/center/${slug}/teachers/`),
      api.get(`/center/${slug}/tests/`),
    ])
      .then(([s, t, te]) => {
        setStats({
          students: Array.isArray(s.data) ? s.data.length : (s.data.count ?? 0),
          teachers: Array.isArray(t.data) ? t.data.length : (t.data.count ?? 0),
          tests: Array.isArray(te.data) ? te.data.length : (te.data.count ?? 0),
        })
      })
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <div>
      <h1 className="mb-6 text-3xl font-light text-slate-900">Bosh sahifa</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Talabalar" value={stats.students} loading={loading} />
        <StatCard label="Ustozlar" value={stats.teachers} loading={loading} />
        <StatCard label="Testlar" value={stats.tests} loading={loading} />
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Tezkor amallar</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/${slug}/admin/students`}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Talaba qo'shish
          </Link>
          <Link
            to={`/${slug}/admin/teachers`}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Ustoz qo'shish
          </Link>
          <Link
            to={`/${slug}/admin/tests`}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Global katalogni ko'rish
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string
  value: number
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-5xl font-light text-slate-900">
        {loading ? '…' : value}
      </div>
    </div>
  )
}
