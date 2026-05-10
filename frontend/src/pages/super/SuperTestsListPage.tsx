import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  TableCard,
  adminTable,
  btnPrimary,
} from '@/components/admin-shell'
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
  is_practice_enabled: boolean
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

  const togglePractice = async (id: string) => {
    await api.patch(`/super/tests/${id}/toggle-practice/`)
    load()
  }

  return (
    <SuperAdminLayout>
      <PageShell>
        <PageHeader
          title="Global testlar"
          subtitle="Tests prepared by SuperAdmin that any center can clone"
          actions={
            <Link to="/super/tests/wizard" className={btnPrimary}>
              <Plus size={16} /> New test (Wizard)
            </Link>
          }
        />

        <TableCard>
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th className={adminTable.th}>Name</th>
                <th className={adminTable.th}>Modul</th>
                <th className={adminTable.th}>Difficulty</th>
                <th className={adminTable.th}>Savollar</th>
                <th className={adminTable.th}>Status</th>
                <th className={adminTable.th}>Practice</th>
                <th className={adminTable.th + ' text-right'}>Amal</th>
              </tr>
            </thead>
            <tbody className={adminTable.tbody}>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                    No tests yet. "+ New test" tugmasi bilan boshlang.
                  </td>
                </tr>
              ) : (
                tests.map((t) => (
                  <tr key={t.id} className={adminTable.trHover}>
                    <td className={adminTable.td}>
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      {t.category && (
                        <div className="text-xs text-slate-500">{t.category}</div>
                      )}
                    </td>
                    <td className={adminTable.td}>
                      <Chip tone="indigo">{MODULE_LABEL[t.module] ?? t.module}</Chip>
                    </td>
                    <td className={adminTable.td + ' text-slate-700'}>{t.difficulty}</td>
                    <td className={adminTable.td + ' text-slate-700'}>{t.questions_count}</td>
                    <td className={adminTable.td}>
                      {t.status === 'published' ? (
                        <Chip tone="emerald">published</Chip>
                      ) : t.status === 'archived' ? (
                        <Chip>archived</Chip>
                      ) : (
                        <Chip tone="amber">draft</Chip>
                      )}
                    </td>
                    <td className={adminTable.td}>
                      <button
                        type="button"
                        onClick={() => togglePractice(t.id)}
                        className={
                          t.is_practice_enabled
                            ? 'inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200'
                            : 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200'
                        }
                        title="Practice mode"
                      >
                        {t.is_practice_enabled ? '✓ Yoqilgan' : 'O\'chiq'}
                      </button>
                    </td>
                    <td className={adminTable.td + ' text-right'}>
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to={`/super/tests/wizard/${t.id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => togglePublish(t.id, t.status)}
                          className={
                            t.status === 'published'
                              ? 'inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100'
                              : 'inline-flex items-center gap-1 rounded-xl bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100'
                          }
                        >
                          {t.status === 'published' ? 'Draft' : "Publish"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableCard>
      </PageShell>
    </SuperAdminLayout>
  )
}
