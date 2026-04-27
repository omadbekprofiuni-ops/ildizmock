import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, Plus, Trash2 } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import AdminLayout from './AdminLayout'

type LayoutComponent = ComponentType<{ children: ReactNode }>

type Props = {
  Layout?: LayoutComponent
  basePath?: string
}

type AdminTest = {
  id: string
  name: string
  module: string
  test_type: string
  difficulty: string
  duration_minutes: number
  is_published: boolean
  question_count: number
  attempt_count: number
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB')
}

export default function AdminTestsPage({
  Layout = AdminLayout,
  basePath = '/admin/tests',
}: Props = {}) {
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['admin-tests'],
    queryFn: async () => (await api.get<AdminTest[]>('/admin/tests/')).data,
  })

  const publishMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/admin/tests/${id}/publish/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tests'] })
      toast.success('Status updated')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/tests/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tests'] })
      toast.success('Test deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <Layout>
      <header className="flex items-center justify-between border-b bg-white px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tests</h1>
          <p className="text-sm text-muted-foreground">
            All tests list and management
          </p>
        </div>
        <Link to={`${basePath}/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New test
          </Button>
        </Link>
      </header>
      <div className="p-8">
        {list.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {list.isError && (
          <p className="text-destructive">Failed to load.</p>
        )}
        {list.data && list.data.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              No tests yet.{' '}
              <Link to={`${basePath}/new`} className="underline">
                Create your first test
              </Link>
              .
            </CardContent>
          </Card>
        )}
        {list.data && list.data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Module</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">Questions</th>
                    <th className="px-6 py-3">Attempts</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.data.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {t.name}
                      </td>
                      <td className="px-6 py-3 capitalize text-slate-700">
                        {t.module}
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {t.duration_minutes} min
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {t.question_count}
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {t.attempt_count}
                      </td>
                      <td className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => publishMutation.mutate(t.id)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            t.is_published
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {t.is_published ? 'Published' : 'Draft'}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`${basePath}/${t.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`"${t.name}" Delete this test?`)) {
                                deleteMutation.mutate(t.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}
