import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import SuperAdminLayout from '@/pages/superadmin/SuperAdminLayout'
import { api } from '@/lib/api'

interface SuperTestRow {
  id: string
  name: string
  module: string
  difficulty: string
  status: string
  category: string
  duration_minutes: number
  questions_count: number
  created_at: string
  published_at: string | null
}

const MODULE_LABEL: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  full_mock: 'Full Mock',
}

export default function SuperTestsListPage() {
  const [tests, setTests] = useState<SuperTestRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api
      .get<SuperTestRow[]>('/super/tests/')
      .then((r) => setTests(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const togglePublish = async (id: string, currentStatus: string) => {
    const action = currentStatus === 'published' ? 'unpublish' : 'publish'
    await api.post(`/super/tests/${id}/${action}/`)
    load()
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto max-w-7xl p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">
              SuperAdmin
            </div>
            <h1 className="text-3xl font-light text-slate-900">Global testlar</h1>
          </div>
          <Link
            to="/super/tests/wizard"
            className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            + Yangi test (Wizard)
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
                <th className="p-4">Nomi</th>
                <th className="p-4">Modul</th>
                <th className="p-4">Qiyinlik</th>
                <th className="p-4">Savollar</th>
                <th className="p-4">Holat</th>
                <th className="p-4">Amal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Yuklanmoqda…
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Hali test yo'q. "+ Yangi test" tugmasi bilan boshlang.
                  </td>
                </tr>
              ) : (
                tests.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      {t.category && (
                        <div className="text-xs text-slate-500">{t.category}</div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-slate-700">
                      {MODULE_LABEL[t.module] ?? t.module}
                    </td>
                    <td className="p-4 text-sm text-slate-700">{t.difficulty}</td>
                    <td className="p-4 text-sm text-slate-700">
                      {t.questions_count}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          t.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : t.status === 'archived'
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      <Link
                        to={`/super/tests/wizard/${t.id}`}
                        className="mr-3 text-orange-600 hover:underline"
                      >
                        Tahrirlash
                      </Link>
                      <button
                        type="button"
                        onClick={() => togglePublish(t.id, t.status)}
                        className="text-slate-700 hover:underline"
                      >
                        {t.status === 'published' ? 'Draft' : 'E\'lon qilish'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminLayout>
  )
}
