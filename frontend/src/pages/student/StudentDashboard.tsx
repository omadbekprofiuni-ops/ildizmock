import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FilePen, History, Target, TrendingUp, User } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

type DashboardData = {
  attempts_total: number
  attempts_graded: number
  best_band: number | null
  avg_band: number | null
  by_module: Record<string, {
    attempts: number; graded: number;
    best_band: number | null; avg_band: number | null
  }>
  recent_attempts: {
    id: string
    test_name: string
    module: string
    status: string
    started_at: string
    submitted_at: string | null
    band_score: string | null
    raw_score: number | null
    total_questions: number | null
  }[]
  writing_pending: number
  writing_graded: number
  teacher: { name: string; phone: string } | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    month: '2-digit', day: '2-digit',
  })
}

export default function StudentDashboard() {
  const user = useAuth((s) => s.user)
  useEffect(() => { document.title = 'ILDIZmock — Mening kabinetim' }, [])

  const q = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/me/dashboard/')).data,
  })

  const target = user?.target_band ? Number(user.target_band) : null
  const avg = q.data?.avg_band ?? null
  const targetGap = target && avg ? Math.max(0, target - avg) : null
  const lastDate = q.data?.recent_attempts[0]?.submitted_at || q.data?.recent_attempts[0]?.started_at

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/home" className="text-xl font-bold tracking-tight">
            ILDIZmock
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="container space-y-8 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Salom, {user?.first_name}!
          </h1>
          <p className="mt-1 text-[var(--muted)]">
            {target ? `Maqsad: ${target} band.` : 'Profil sahifasida maqsadingizni belgilang.'}{' '}
            {q.data?.teacher && (
              <>Ustozingiz: <strong>{q.data.teacher.name}</strong></>
            )}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Topshirilgan" value={q.data?.attempts_graded ?? 0} hint={`${q.data?.attempts_total ?? 0} ta urinish`} />
          <Stat label="O‘rtacha band" value={avg !== null ? avg.toFixed(1) : '—'} hint={q.data?.best_band ? `Eng yuqori: ${q.data.best_band.toFixed(1)}` : ''} Icon={TrendingUp} />
          <Stat label="So‘nggi test" value={lastDate ? formatDate(lastDate) : '—'} hint={q.data?.recent_attempts[0]?.test_name?.slice(0, 30) ?? ''} />
          <Stat
            label="Maqsadgacha"
            value={targetGap !== null ? `+${targetGap.toFixed(1)}` : '—'}
            hint={target ? `${target} → hozir ${avg?.toFixed(1) ?? '—'}` : 'Maqsad belgilanmagan'}
            Icon={Target}
          />
        </div>

        {/* Recent results */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">So‘nggi natijalar</h2>
          <Card>
            <CardContent className="p-0">
              {!q.data || q.data.recent_attempts.length === 0 ? (
                <p className="p-8 text-center text-sm text-[var(--muted)]">
                  Hali test topshirmagansiz.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Test</th>
                      <th className="px-6 py-3">Modul</th>
                      <th className="px-6 py-3">Sana</th>
                      <th className="px-6 py-3">Natija</th>
                      <th className="px-6 py-3">Band</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {q.data.recent_attempts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium">{a.test_name}</td>
                        <td className="px-6 py-3 capitalize">{a.module}</td>
                        <td className="px-6 py-3">{formatDate(a.submitted_at || a.started_at)}</td>
                        <td className="px-6 py-3">
                          {a.status === 'graded' ? (
                            `${a.raw_score}/${a.total_questions}`
                          ) : (
                            <span className="text-amber-600">{a.status}</span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-mono">{a.band_score ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Tezkor harakatlar</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ActionCard to="/home" label="Yangi test" Icon={ArrowRight} />
            <ActionCard
              to="/my-writings"
              label="Yozma ishlarim"
              Icon={FilePen}
              hint={
                q.data
                  ? `${q.data.writing_pending} kutilmoqda · ${q.data.writing_graded} baholangan`
                  : ''
              }
            />
            <ActionCard to="/history" label="Tarix" Icon={History} />
            <ActionCard to="/profile" label="Profil" Icon={User} />
          </div>
        </section>
      </main>
    </div>
  )
}

function Stat({
  label, value, hint, Icon,
}: {
  label: string; value: string | number; hint?: string
  Icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-[var(--muted)]">{label}</div>
            {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
          </div>
          {Icon && <Icon className="h-5 w-5 text-[var(--muted)]" />}
        </div>
      </CardContent>
    </Card>
  )
}

function ActionCard({
  to, label, Icon, hint,
}: {
  to: string; label: string;
  Icon: React.ComponentType<{ className?: string }>
  hint?: string
}) {
  return (
    <Link to={to}>
      <Card className="transition-colors hover:border-slate-900">
        <CardContent className="p-5">
          <Icon className="mb-2 h-5 w-5" />
          <div className="text-sm font-semibold">{label}</div>
          {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
        </CardContent>
      </Card>
    </Link>
  )
}

// Re-use Button to avoid TS unused import warning
void Button
