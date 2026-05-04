import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useOrgContext } from '@/stores/orgContext'

import SuperAdminLayout from './SuperAdminLayout'

interface Teacher {
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

export default function OrgTeachersPage() {
  const { orgId: paramId } = useParams<{ orgId: string }>()
  const ctxId = useOrgContext((s) => s.orgId)
  const orgId = paramId ? Number(paramId) : ctxId
  const orgName = useOrgContext((s) => s.orgName)

  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: ['super-org-teachers', orgId],
    queryFn: async () =>
      (await api.get<Teacher[]>(`/super/organizations/${orgId}/teachers/`)).data,
    enabled: !!orgId,
  })

  const teachers = query.data ?? []
  const filtered = useMemo(() => {
    if (!search) return teachers
    const q = search.toLowerCase()
    return teachers.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q),
    )
  }, [teachers, search])

  return (
    <SuperAdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">O'qituvchilar</h1>
            <p className="text-sm text-muted-foreground">
              {orgName ? `${orgName} center teachers` : 'No center selected'}
            </p>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-4">
        {!orgId ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              First select a center.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ism, login yoki telefon..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <span className="text-sm text-slate-500">
                Total: <strong>{filtered.length}</strong> / {teachers.length}
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
                      <th className="px-4 py-3 text-left">Qo'shilgan</th>
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
                          Teacher not found.
                        </td>
                      </tr>
                    )}
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {t.full_name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {t.username}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{t.phone || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              t.is_active
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {t.is_active ? 'faol' : 'deleted'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {fmtDate(t.last_login)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {fmtDate(t.created_at)}
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
