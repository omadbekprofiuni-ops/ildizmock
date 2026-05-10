import { useQuery } from '@tanstack/react-query'
import { Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useOrgContext } from '@/stores/orgContext'

import SuperAdminLayout from './SuperAdminLayout'

interface Student {
  id: number
  username: string
  full_name: string
  phone: string
  is_active: boolean
  last_login: string | null
  created_at: string
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export default function OrgStudentsPage() {
  const { orgId: paramId } = useParams<{ orgId: string }>()
  const ctxId = useOrgContext((s) => s.orgId)
  const orgId = paramId ? Number(paramId) : ctxId
  const orgName = useOrgContext((s) => s.orgName)

  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)

  const query = useQuery({
    queryKey: ['super-org-students', orgId],
    queryFn: async () =>
      (await api.get<Student[]>(`/super/organizations/${orgId}/students/`)).data,
    enabled: !!orgId,
  })

  const students = query.data ?? []
  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (activeOnly && !s.is_active) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q)
      )
    })
  }, [students, search, activeOnly])

  return (
    <SuperAdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Students</h1>
            <p className="text-sm text-muted-foreground">
              {orgName ? `${orgName} center students` : 'No center selected'}
            </p>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-4">
        {!orgId ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              First select a center (from the Centers list).
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ism, login yoki telefon bo'yicha qidirish..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Faqat faollar
              </label>
              <span className="text-sm text-slate-500">
                Total: <strong>{filtered.length}</strong> / {students.length}
              </span>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Ism</th>
                      <th className="px-4 py-3 text-left">Login</th>
                      <th className="px-4 py-3 text-left">Telefon</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-left">Oxirgi kirish</th>
                      <th className="px-4 py-3 text-left">Yaratilgan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {query.isLoading && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                          Yuklanmoqda...
                        </td>
                      </tr>
                    )}
                    {!query.isLoading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                          No students found.
                        </td>
                      </tr>
                    )}
                    {filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {s.full_name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {s.username}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{s.phone || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              s.is_active
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-cta-100 text-cta-700'
                            }`}
                          >
                            {s.is_active ? 'faol' : 'deleted'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {fmtDate(s.last_login)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {fmtDate(s.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}
