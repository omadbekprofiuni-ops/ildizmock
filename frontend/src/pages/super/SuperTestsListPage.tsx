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
      <PageShell>
        <PageHeader
          title="Global testlar"
          subtitle="SuperAdmin tayyorlagan, hamma markazlar nusxalashi mumkin bo'lgan testlar"
          actions={
            <Link to="/super/tests/wizard" className={btnPrimary}>
              <Plus size={16} /> Yangi test (Wizard)
            </Link>
          }
        />

        <TableCard>
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th className={adminTable.th}>Nomi</th>
                <th className={adminTable.th}>Modul</th>
                <th className={adminTable.th}>Qiyinlik</th>
                <th className={adminTable.th}>Savollar</th>
                <th className={adminTable.th}>Holat</th>
                <th className={adminTable.th + ' text-right'}>Amal</th>
              </tr>
            </thead>
            <tbody className={adminTable.tbody}>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                    Yuklanmoqda…
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                    Hali test yo'q. "+ Yangi test" tugmasi bilan boshlang.
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
                    <td className={adminTable.td + ' text-right'}>
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to={`/super/tests/wizard/${t.id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Tahrirlash
                        </Link>
                        <button
                          type="button"
                          onClick={() => togglePublish(t.id, t.status)}
                          className={
                            t.status === 'published'
                              ? 'inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100'
                              : 'inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100'
                          }
                        >
                          {t.status === 'published' ? 'Draft' : "E'lon qilish"}
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
