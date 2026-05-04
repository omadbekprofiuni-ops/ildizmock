import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type MockResultDetail = {
  id: number
  session_id: number
  session_name: string
  session_date: string
  session_status: string
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
  overall_band_score: string | null
  writing_status: 'pending' | 'grading' | 'graded'
  speaking_status: 'pending' | 'graded'
  writing_feedback: string
  speaking_feedback: string
  writing_task1_text: string
  writing_task2_text: string
  session: {
    id: number
    name: string
    date: string
    status: string
  }
}

function fmt(value: string | number | null, digits = 1): string {
  if (value === null || value === undefined) return '—'
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n.toFixed(digits) : '—'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    year: 'numeric', month: 'long', day: '2-digit',
  })
}

export default function MockResultDetailPage() {
  const { id } = useParams<{ id: string }>()

  useEffect(() => { document.title = 'ILDIZmock — Mock Result' }, [])

  const query = useQuery({
    queryKey: ['my-mock-result', id],
    queryFn: async () =>
      (await api.get<MockResultDetail>(`/student/mock/results/${id}/`)).data,
    enabled: !!id,
  })

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get(`/student/mock/results/${id}/certificate/`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = `IELTS_Mock_${(query.data?.session_name || 'session').replace(/\s+/g, '_')}.pdf`
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    onError: () => {
      toast.error('Certificate failed to load', {
        description: 'Iltimos, biroz keyin urinib ko‘ring.',
      })
    },
  })

  const data = query.data
  const overall = data?.overall_band_score
  const completed = !!overall

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/student/mock">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Mock results
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Mock Test Result</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container max-w-4xl space-y-6 py-10">
        {query.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {query.isError && (
          <p className="text-destructive">Failed to load result.</p>
        )}

        {data && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    {formatDate(data.session_date)}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">{data.session_name}</h2>

                  {completed ? (
                    <div className="mt-6">
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Overall Band Score
                      </p>
                      <p className="mt-1 text-6xl font-bold text-slate-900">
                        {fmt(overall)}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Grading in progress — all sections must be completed
                      to see the result.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SectionScore label="Listening" value={fmt(data.listening_score)} color="text-emerald-600" />
              <SectionScore label="Reading" value={fmt(data.reading_score)} color="text-blue-600" />
              <SectionScore
                label="Writing"
                value={fmt(data.writing_score)}
                color="text-orange-600"
                hint={data.writing_status === 'pending' ? 'kutilmoqda' : null}
              />
              <SectionScore
                label="Speaking"
                value={fmt(data.speaking_score)}
                color="text-purple-600"
                hint={data.speaking_status === 'pending' ? 'kutilmoqda' : null}
              />
            </div>

            {data.writing_feedback && (
              <FeedbackCard
                title="Writing feedback"
                feedback={data.writing_feedback}
                color="border-blue-200 bg-blue-50"
              />
            )}
            {data.speaking_feedback && (
              <FeedbackCard
                title="Speaking feedback"
                feedback={data.speaking_feedback}
                color="border-purple-200 bg-purple-50"
              />
            )}

            {(data.writing_task1_text || data.writing_task2_text) && (
              <Card>
                <CardContent className="space-y-4 p-6">
                  <h3 className="text-base font-semibold">Sizning Writing javoblaringiz</h3>
                  {data.writing_task1_text && (
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">
                        Task 1
                      </p>
                      <pre className="whitespace-pre-wrap rounded-md border bg-white p-3 font-sans text-sm">
                        {data.writing_task1_text}
                      </pre>
                    </div>
                  )}
                  {data.writing_task2_text && (
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">
                        Task 2
                      </p>
                      <pre className="whitespace-pre-wrap rounded-md border bg-white p-3 font-sans text-sm">
                        {data.writing_task2_text}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {completed && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                  <p className="text-sm text-slate-600">
                    Mock IELTS sertifikatingiz tayyor.
                  </p>
                  <Button
                    onClick={() => downloadMutation.mutate()}
                    disabled={downloadMutation.isPending}
                    size="lg"
                  >
                    {downloadMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download certificate
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-slate-500">
                    Bu — mashq sertifikati. Rasmiy IELTS natijasi emas.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function SectionScore({
  label, value, color, hint,
}: {
  label: string; value: string; color: string; hint?: string | null
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
        {hint && <p className="mt-1 text-[10px] text-amber-600">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function FeedbackCard({
  title, feedback, color,
}: {
  title: string; feedback: string; color: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-3 text-base font-semibold">{title}</h3>
        <div className={`rounded-md border p-4 ${color}`}>
          <p className="whitespace-pre-wrap text-sm">{feedback}</p>
        </div>
      </CardContent>
    </Card>
  )
}
