import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

type AttemptHistoryItem = {
  id: string
  test: string
  test_name: string
  module: 'listening' | 'reading' | 'writing' | 'speaking'
  status: 'in_progress' | 'submitted' | 'graded' | 'expired'
  started_at: string
  submitted_at: string | null
  raw_score: number | null
  total_questions: number | null
  band_score: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const MODULE_TITLES = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
} as const

export default function HistoryPage() {
  const query = useQuery({
    queryKey: ['attempts'],
    queryFn: async () =>
      (await api.get<AttemptHistoryItem[]>('/attempts/')).data,
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/home">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Bosh sahifa
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Topshirishlar tarixi</h1>
        </div>
      </header>

      <main className="container py-8">
        {query.isLoading && (
          <p className="text-muted-foreground">Yuklanmoqda…</p>
        )}
        {query.isError && (
          <p className="text-destructive">Tarixni yuklab bo‘lmadi.</p>
        )}
        {query.data && query.data.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Hali bitta ham test topshirmagansiz.
            </CardContent>
          </Card>
        )}
        {query.data && query.data.length > 0 && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3">Modul</th>
                  <th className="px-4 py-3">Sana</th>
                  <th className="px-4 py-3">Natija</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {query.data.map((a) => {
                  const graded = a.status === 'graded'
                  const date = a.submitted_at || a.started_at
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {a.test_name}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {MODULE_TITLES[a.module]}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(date)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {graded
                          ? `${a.raw_score}/${a.total_questions}`
                          : a.status === 'in_progress'
                            ? 'Davom etmoqda'
                            : a.status}
                      </td>
                      <td className="px-4 py-3">
                        {graded ? (
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs tabular-nums text-white">
                            {a.band_score}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {graded ? (
                          <Link to={`/result/${a.id}`}>
                            <Button variant="outline" size="sm">
                              Ko‘rish
                            </Button>
                          </Link>
                        ) : a.status === 'in_progress' ? (
                          <Link to={`/take/${a.id}`}>
                            <Button size="sm">Davom etish</Button>
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  )
}
