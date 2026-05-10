import { useQuery } from '@tanstack/react-query'
import { FileText, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useOrgContext } from '@/stores/orgContext'

import SuperAdminLayout from './SuperAdminLayout'

interface OrgTest {
  id: string
  name: string
  module: 'listening' | 'reading' | 'writing' | 'speaking' | 'full_mock'
  test_type: string
  difficulty: string
  status: 'draft' | 'published' | 'archived'
  is_published: boolean
  is_practice_enabled: boolean
  category: string
  duration_minutes: number
  attempts_count: number
  created_by: string
  created_at: string
}

const MODULE_LABEL: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  full_mock: 'Full Mock',
}

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-cta-100 text-cta-700',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'qoralama',
  published: 'chop etilgan',
  archived: 'arxiv',
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export default function OrgTestsPage() {
  const { orgId: paramId } = useParams<{ orgId: string }>()
  const ctxId = useOrgContext((s) => s.orgId)
  const orgId = paramId ? Number(paramId) : ctxId
  const orgName = useOrgContext((s) => s.orgName)

  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const query = useQuery({
    queryKey: ['super-org-tests', orgId],
    queryFn: async () =>
      (await api.get<OrgTest[]>(`/super/organizations/${orgId}/tests/`)).data,
    enabled: !!orgId,
  })

  const tests = query.data ?? []
  const filtered = useMemo(() => {
    return tests.filter((t) => {
      if (moduleFilter !== 'all' && t.module !== moduleFilter) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    })
  }, [tests, search, moduleFilter, statusFilter])

  return (
    <SuperAdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-slate-700" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Center tests</h1>
              <p className="text-sm text-muted-foreground">
                {orgName ? `${orgName} — tests management` : 'No center selected'}
              </p>
            </div>
          </div>
          <Link
            to="/super/tests/wizard"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New test
          </Link>
        </div>
      </header>

      <div className="space-y-4 p-8">
        {!orgId ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              First select a center.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Test name or category..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All modules</option>
                <option value="listening">Listening</option>
                <option value="reading">Reading</option>
                <option value="writing">Writing</option>
                <option value="speaking">Speaking</option>
                <option value="full_mock">Full Mock</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="draft">Qoralama</option>
                <option value="published">Chop etilgan</option>
                <option value="archived">Arxiv</option>
              </select>
              <span className="text-sm text-slate-500">
                Total: <strong>{filtered.length}</strong> / {tests.length}
              </span>
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Test name</th>
                      <th className="px-4 py-3 text-left">Modul</th>
                      <th className="px-4 py-3 text-left">Kategoriya</th>
                      <th className="px-4 py-3 text-center">Davomiyligi</th>
                      <th className="px-4 py-3 text-center">Urinishlar</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-left">Yaratuvchi</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {query.isLoading && (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                          Yuklanmoqda...
                        </td>
                      </tr>
                    )}
                    {!query.isLoading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                          Test not found.
                        </td>
                      </tr>
                    )}
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {t.name}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {MODULE_LABEL[t.module] ?? t.module}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{t.category || '—'}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs">
                          {t.duration_minutes}m
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {t.attempts_count}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              STATUS_TONE[t.status] ?? 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{t.created_by || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {fmtDate(t.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/super/org/${orgId}/tests/${t.id}/results`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                          >
                            Results →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <p className="text-xs text-slate-500">
              ⓘ Click the "New test" button to create a new test and add questions.
              Use the "Results" link in each row to view test results.
            </p>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}
