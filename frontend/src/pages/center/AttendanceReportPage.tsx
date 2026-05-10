import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BarChart3, Loader2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StatCard,
  SurfaceCard,
  TableCard,
  adminTable,
  btnOutline,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

type GroupReport = {
  group: { id: number; name: string; student_count: number }
  avg_rate: number
  sessions_count: number
  students: {
    id: number
    name: string
    username: string
    total: number
    present: number
    absent: number
    rate: number
  }[]
  recent_sessions: {
    id: number
    date: string
    is_finalized: boolean
  }[]
}

export default function AttendanceReportPage() {
  const { slug, groupId } = useParams<{ slug: string; groupId: string }>()

  const reportQ = useQuery({
    queryKey: ['attendance-group-report', slug, groupId],
    queryFn: async () =>
      (await api.get<GroupReport>(
        `/center/${slug}/attendance/groups/${groupId}/report/`,
      )).data,
  })

  if (reportQ.isLoading) {
    return (
      <PageShell>
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </PageShell>
    )
  }

  const r = reportQ.data
  if (!r) {
    return (
      <PageShell>
        <SurfaceCard>Couldn't load report.</SurfaceCard>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title={`${r.group.name} — Attendance Report`}
        subtitle={`${r.group.student_count} students · ${r.sessions_count} sessions`}
        actions={
          <>
            <Link to={`/${slug}/admin/groups/${groupId}`} className={btnOutline}>
              <ArrowLeft size={16} /> Group
            </Link>
            <Link
              to={`/${slug}/admin/groups/${groupId}/schedule`}
              className={btnOutline}
            >
              Schedule
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Average attendance"
          value={`${r.avg_rate}%`}
          Icon={BarChart3}
          tone="emerald"
        />
        <StatCard label="Students" value={r.group.student_count} tone="blue" />
        <StatCard label="Sessions" value={r.sessions_count} tone="amber" />
      </div>

      <TableCard title="Student ranking (by attendance)">
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th className={adminTable.th}>#</th>
              <th className={adminTable.th}>Student</th>
              <th className={adminTable.th}>Total</th>
              <th className={adminTable.th}>Keldi</th>
              <th className={adminTable.th}>Kelmadi</th>
              <th className={adminTable.th}>Attendance</th>
            </tr>
          </thead>
          <tbody className={adminTable.tbody}>
            {r.students.map((s, i) => (
              <tr key={s.id} className={adminTable.trHover}>
                <td className={adminTable.td}>{i + 1}</td>
                <td className={adminTable.td}>
                  <Link
                    to={`/${slug}/admin/students/${s.id}`}
                    className="font-medium text-slate-900 hover:text-brand-700"
                  >
                    {s.name}
                  </Link>
                  <p className="text-xs text-slate-500">@{s.username}</p>
                </td>
                <td className={adminTable.td}>{s.total}</td>
                <td className={adminTable.td}>{s.present}</td>
                <td className={adminTable.td}>{s.absent}</td>
                <td className={adminTable.td}>
                  <span className="font-semibold text-slate-900">{s.rate}%</span>
                  {s.rate >= 90 && (
                    <Chip tone="emerald" className="ml-2">A+</Chip>
                  )}
                  {s.rate >= 75 && s.rate < 90 && (
                    <Chip tone="blue" className="ml-2">A</Chip>
                  )}
                  {s.rate < 60 && s.total > 0 && (
                    <Chip tone="rose" className="ml-2">Low</Chip>
                  )}
                </td>
              </tr>
            ))}
            {r.students.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  There are no students in this group or sessions haven't been created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableCard>
    </PageShell>
  )
}
