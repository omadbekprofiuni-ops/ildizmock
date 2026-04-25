import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

import TeacherLayout from './TeacherLayout'

type QueueItem = {
  id: number
  test_name: string
  student_name: string
  student_phone: string
  status: string
  word_count: number
  submitted_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('uz-UZ', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function TeacherQueuePage() {
  const q = useQuery({
    queryKey: ['teacher-queue'],
    queryFn: async () =>
      (await api.get<QueueItem[]>('/teacher/queue/')).data,
  })

  return (
    <TeacherLayout>
      <header className="border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-bold tracking-tight">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          Studentsingiz tomonidan yuborilgan inshalar
        </p>
      </header>
      <div className="p-8">
        {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {q.isError && <p className="text-destructive">Yuklab bo‘lmadi.</p>}
        {q.data && q.data.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-lg font-medium">No pending submissions ✓</p>
              <p className="text-sm text-muted-foreground">
                Yangi insha kelganida bu yerda ko‘rinadi.
              </p>
            </CardContent>
          </Card>
        )}
        {q.data && q.data.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {q.data.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="rounded-md border bg-slate-50 p-2.5">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold">
                      {s.student_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{s.test_name}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{s.word_count} so‘z</span>
                      <span>·</span>
                      <span>{formatDate(s.submitted_at)}</span>
                      <span>·</span>
                      <span className="font-mono">{s.student_phone}</span>
                    </div>
                  </div>
                  <Link to={`/teacher/grade/${s.id}`}>
                    <Button size="sm">Review</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TeacherLayout>
  )
}
