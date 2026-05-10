import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

import TeacherLayout from './TeacherLayout'

type StudentRow = {
  id: number
  username: string
  name: string
  attempts_count: number
  last_attempt: string | null
  avg_band: number | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB')
}

export default function TeacherStudentsPage() {
  const q = useQuery({
    queryKey: ['teacher-students'],
    queryFn: async () =>
      (await api.get<StudentRow[]>('/teacher/students/')).data,
  })

  return (
    <TeacherLayout>
      <header className="border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-bold tracking-tight">My students</h1>
        <p className="text-sm text-muted-foreground">
          Students assigned to you
        </p>
      </header>
      <div className="p-8">
        {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              No students assigned to you yet.
            </CardContent>
          </Card>
        )}
        {q.data && q.data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">First name</th>
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Attempts</th>
                    <th className="px-6 py-3">Last test</th>
                    <th className="px-6 py-3">Average band</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {q.data.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium">
                        <Link
                          to={`/teacher/students/${s.id}`}
                          className="hover:text-brand-700"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs">{s.username}</td>
                      <td className="px-6 py-3">{s.attempts_count}</td>
                      <td className="px-6 py-3">{formatDate(s.last_attempt)}</td>
                      <td className="px-6 py-3 font-mono">
                        {s.avg_band !== null ? s.avg_band.toFixed(1) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </TeacherLayout>
  )
}
