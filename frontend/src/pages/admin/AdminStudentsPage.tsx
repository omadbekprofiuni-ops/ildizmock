import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import AdminLayout from './AdminLayout'

type Student = {
  id: number
  username: string
  name: string
  created_at: string
  teacher_id: number | null
  teacher_name: string | null
}

type Teacher = {
  id: number
  first_name: string
  last_name: string
  username: string
}

export default function AdminStudentsPage() {
  const qc = useQueryClient()

  const students = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => (await api.get<Student[]>('/admin/students/')).data,
  })

  const teachers = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: async () => (await api.get<Teacher[]>('/admin/teachers/')).data,
  })

  const assign = useMutation({
    mutationFn: async (vars: { studentId: number; teacherId: number | null }) =>
      api.post(`/admin/students/${vars.studentId}/assign-teacher/`, {
        teacher_id: vars.teacherId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-students'] })
      toast.success('Saved')
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <AdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-sm text-muted-foreground">
          Assign teachers to students
        </p>
      </header>
      <div className="p-8">
        {students.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {students.data && students.data.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              No students yet.
            </CardContent>
          </Card>
        )}
        {students.data && students.data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">First name</th>
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.data.map((s) => (
                    <tr key={s.id}>
                      <td className="px-6 py-3 font-medium">{s.name}</td>
                      <td className="px-6 py-3 font-mono text-xs">{s.username}</td>
                      <td className="px-6 py-3">
                        <select
                          value={s.teacher_id ?? ''}
                          onChange={(e) =>
                            assign.mutate({
                              studentId: s.id,
                              teacherId: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="h-9 rounded-md border bg-white px-2 text-sm"
                          disabled={assign.isPending}
                        >
                          <option value="">— unassigned —</option>
                          {teachers.data?.map((t) => (
                            <option key={t.id} value={t.id}>
                              {`${t.first_name} ${t.last_name}`.trim() || t.username}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
