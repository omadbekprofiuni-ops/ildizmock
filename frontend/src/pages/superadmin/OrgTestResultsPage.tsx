import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useOrgContext } from '@/stores/orgContext'

import SuperAdminLayout from './SuperAdminLayout'

interface AttemptRow {
  id: string
  user_id: number | null
  username: string | null
  full_name: string | null
  status: 'in_progress' | 'submitted' | 'graded' | 'expired'
  raw_score: number | null
  total_questions: number | null
  band_score: string | null
  started_at: string
  submitted_at: string | null
}

interface TestSummary {
  id: string
  name: string
  module: string
  attempts: AttemptRow[]
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'jarayonda',
  submitted: 'yuborildi',
  graded: 'baholandi',
  expired: 'tugagan',
}

const STATUS_TONE: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  graded: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-rose-100 text-rose-700',
}

export default function OrgTestResultsPage() {
  const { orgId, testId } = useParams<{ orgId: string; testId: string }>()
  const orgName = useOrgContext((s) => s.orgName)

  const query = useQuery({
    queryKey: ['super-org-test-results', orgId, testId],
    queryFn: async () =>
      (await api.get<TestSummary>(
        `/super/organizations/${orgId}/tests/${testId}/results/`,
      )).data,
    enabled: !!orgId && !!testId,
  })

  const data = query.data

  return (
    <SuperAdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <Link
          to={orgId ? `/super/org/${orgId}/tests` : '/super/organizations'}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
        >
          <ArrowLeft size={14} /> Testlar
        </Link>
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {data?.name ?? 'Test results'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {orgName ? `${orgName} — ${data?.module ?? ''}` : data?.module ?? ''}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-8">
        {query.isLoading && (
          <Card>
            <CardContent className="p-10 text-center text-slate-400">
              Yuklanmoqda...
            </CardContent>
          </Card>
        )}
        {query.isError && (
          <Card>
            <CardContent className="p-10 text-center text-rose-600">
              Couldn't fetch data.
            </CardContent>
          </Card>
        )}
        {data && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-center">Correct/Total</th>
                    <th className="px-4 py-3 text-center">Band</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-left">Boshlangan</th>
                    <th className="px-4 py-3 text-left">Topshirgan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.attempts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Bu testda urinishlar yo'q.
                      </td>
                    </tr>
                  )}
                  {data.attempts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {a.full_name || a.username || 'Guest'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {a.raw_score ?? '—'}/{a.total_questions ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold">
                        {a.band_score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            STATUS_TONE[a.status]
                          }`}
                        >
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {fmtDate(a.started_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {fmtDate(a.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </SuperAdminLayout>
  )
}
