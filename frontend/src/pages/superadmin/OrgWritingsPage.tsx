import { useQuery } from '@tanstack/react-query'
import { FileText, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useOrgContext } from '@/stores/orgContext'

import SuperAdminLayout from './SuperAdminLayout'

interface Writing {
  id: number
  attempt_id: string
  student_name: string
  test_name: string
  word_count: number
  status: 'pending' | 'graded'
  teacher_band: string | null
  graded_by: string | null
  submitted_at: string
  graded_at: string | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export default function OrgWritingsPage() {
  const { orgId: paramId } = useParams<{ orgId: string }>()
  const ctxId = useOrgContext((s) => s.orgId)
  const orgId = paramId ? Number(paramId) : ctxId
  const orgName = useOrgContext((s) => s.orgName)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded'>('all')

  const query = useQuery({
    queryKey: ['super-org-writings', orgId],
    queryFn: async () =>
      (await api.get<Writing[]>(`/super/organizations/${orgId}/writings/`)).data,
    enabled: !!orgId,
  })

  const writings = query.data ?? []
  const filtered = useMemo(() => {
    return writings.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        w.student_name.toLowerCase().includes(q) ||
        w.test_name.toLowerCase().includes(q)
      )
    })
  }, [writings, search, statusFilter])

  return (
    <SuperAdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Writing topshiriqlar</h1>
            <p className="text-sm text-muted-foreground">
              {orgName ? `${orgName} markazi yozma ishlari` : 'Markaz tanlanmagan'}
            </p>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-4">
        {!orgId ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              Avval markazni tanlang.
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
                  placeholder="Talaba yoki test nomi..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'graded')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Barcha holat</option>
                <option value="pending">Kutilmoqda</option>
                <option value="graded">Baholangan</option>
              </select>
              <span className="text-sm text-slate-500">
                Jami: <strong>{filtered.length}</strong>
              </span>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Talaba</th>
                      <th className="px-4 py-3 text-left">Test</th>
                      <th className="px-4 py-3 text-center">So'zlar</th>
                      <th className="px-4 py-3 text-center">Band</th>
                      <th className="px-4 py-3 text-center">Holat</th>
                      <th className="px-4 py-3 text-left">Yuborilgan</th>
                      <th className="px-4 py-3 text-left">Baholagan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {query.isLoading && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                          Yuklanmoqda...
                        </td>
                      </tr>
                    )}
                    {!query.isLoading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                          Writing topshiriq yo'q.
                        </td>
                      </tr>
                    )}
                    {filtered.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {w.student_name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{w.test_name || '—'}</td>
                        <td className="px-4 py-3 text-center font-mono">
                          {w.word_count}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold">
                          {w.teacher_band ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              w.status === 'graded'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {w.status === 'graded' ? 'baholangan' : 'kutilmoqda'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {fmtDate(w.submitted_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {w.graded_by || '—'}
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
