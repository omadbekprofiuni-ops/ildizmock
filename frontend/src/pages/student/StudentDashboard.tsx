import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Award,
  Dumbbell,
  FilePen,
  FileText,
  GraduationCap,
  History,
  Play,
  Target,
  TrendingUp,
  User,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'
import { UserMenu } from '@/components/UserMenu'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

type DashboardData = {
  attempts_total: number
  attempts_graded: number
  best_band: number | null
  avg_band: number | null
  by_module: Record<
    string,
    {
      attempts: number
      graded: number
      best_band: number | null
      avg_band: number | null
    }
  >
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
    month: '2-digit',
    day: '2-digit',
  })
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        overflow: 'hidden',
      }}
    >
      <img
        src={brandLogo}
        alt="Mock Exam"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  )
}

export default function StudentDashboard() {
  const user = useAuth((s) => s.user)
  useEffect(() => {
    document.title = 'ILDIZmock — My Dashboard'
  }, [])

  const q = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/me/dashboard/')).data,
  })

  const target = user?.target_band ? Number(user.target_band) : null
  const avg = q.data?.avg_band ?? null
  const targetGap = target && avg ? Math.max(0, target - avg) : null
  const lastDate =
    q.data?.recent_attempts[0]?.submitted_at || q.data?.recent_attempts[0]?.started_at

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <Link to="/home" className="flex items-center gap-3">
            <BrandMark size={36} />
            <span className="text-lg font-extrabold tracking-tight">
              <span className="text-brand-900">ILDIZ</span>
              <span className="text-teal-600">mock</span>
            </span>
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-10">
        {/* Greeting */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Salom, {user?.first_name} 👋
            </h1>
            <p className="mt-1.5 text-slate-600">
              {target
                ? targetGap !== null
                  ? `You're ${targetGap.toFixed(1)} bands away from your target of ${target}. Keep going!`
                  : `Target: ${target} band.`
                : 'Set your target on the Profile page.'}{' '}
              {q.data?.teacher && (
                <>
                  Teacher: <strong>{q.data.teacher.name}</strong>
                </>
              )}
            </p>
          </div>
          <Link
            to="/home"
            className="inline-flex items-center gap-2 rounded-xl bg-cta-500 px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(239,68,68,0.25)]"
          >
            <Play className="h-4 w-4" />
            Continue practising
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Tests submitted"
            value={String(q.data?.attempts_graded ?? 0)}
            delta={`${q.data?.attempts_total ?? 0} attempts total`}
            tone="brand"
          />
          <StatCard
            label="Avg. band"
            value={avg !== null ? avg.toFixed(1) : '—'}
            delta={q.data?.best_band ? `Best: ${q.data.best_band.toFixed(1)}` : ''}
            tone="accent"
          />
          <StatCard
            label="Last test"
            value={lastDate ? formatDate(lastDate) : '—'}
            delta={q.data?.recent_attempts[0]?.test_name?.slice(0, 30) ?? ''}
          />
          <StatCard
            label="To target"
            value={targetGap !== null ? `+${targetGap.toFixed(1)}` : '—'}
            delta={target ? `${target} → now ${avg?.toFixed(1) ?? '—'}` : 'No target set'}
            tone="cta"
          />
        </div>

        {/* Two-column grid: recent + recommendation */}
        <div className="mb-7 grid gap-5 lg:grid-cols-[2fr_1fr]">
          {/* Recent attempts */}
          <div
            className="rounded-[20px] border border-slate-100 bg-white p-7"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="mb-5 flex items-baseline justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">Recent attempts</h3>
              <Link
                to="/history"
                className="text-xs font-bold text-brand-600 transition-colors hover:text-brand-700"
              >
                View all →
              </Link>
            </div>

            {!q.data || q.data.recent_attempts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                You haven't submitted any tests yet.
              </p>
            ) : (
              <ul>
                {q.data.recent_attempts.slice(0, 5).map((a, i) => {
                  const band = a.band_score ? parseFloat(a.band_score) : null
                  const tone =
                    band !== null && band >= 7
                      ? 'accent'
                      : band !== null && band >= 6
                        ? 'amber'
                        : 'slate'
                  const bg =
                    tone === 'accent'
                      ? 'var(--accent-50)'
                      : tone === 'amber'
                        ? 'var(--amber-50)'
                        : 'var(--slate-100)'
                  const fg =
                    tone === 'accent'
                      ? 'var(--accent-700)'
                      : tone === 'amber'
                        ? '#B45309'
                        : 'var(--slate-600)'
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3.5 py-3.5"
                      style={{ borderTop: i ? '1px solid var(--slate-100)' : undefined }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-slate-900">
                          {a.test_name}
                        </div>
                        <div className="mt-1 text-xs capitalize text-slate-500">
                          {a.module} · {formatDate(a.submitted_at || a.started_at)}{' '}
                          {a.status !== 'graded' && (
                            <span className="text-cta-600">· {a.status}</span>
                          )}
                        </div>
                      </div>
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold"
                        style={{ background: bg, color: fg }}
                      >
                        {a.band_score ?? '—'}
                      </div>
                      <Link
                        to={`/result/${a.id}`}
                        className="rounded-xl border-2 border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                      >
                        Review →
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Recommendation card (gradient soft) */}
          <div
            className="rounded-[20px] p-7"
            style={{ background: 'var(--gradient-brand-soft)' }}
          >
            <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-brand-700">
              Suggested next
            </span>
            <h3 className="mt-3 text-lg font-extrabold text-slate-900">
              Try a Reading mock
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-700">
              A focused 60-min Cambridge-style Reading mock will sharpen your timing and
              question-spotting before your next attempt.
            </p>
            <Link
              to="/tests/reading"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Start Reading mock
            </Link>
            <div
              className="mt-5 flex items-center gap-2.5 border-t pt-4 text-xs font-semibold text-brand-700"
              style={{ borderColor: 'rgba(37, 99, 235, 0.15)' }}
            >
              <Target className="h-4 w-4" />
              Targets your weakest skill
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <section>
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <ActionCard to="/home" label="New test" Icon={ArrowRight} tone="brand" />
            <ActionCard to="/practice" label="Practice" Icon={Dumbbell} hint="Mustaqil mashq" tone="accent" />
            <ActionCard to="/pdf-tests" label="PDF tests" Icon={FileText} hint="Cambridge-style" tone="cta" />
            <ActionCard
              to="/student/mock"
              label="Mock results"
              Icon={GraduationCap}
              hint="Mock results"
              tone="brand"
            />
            <ActionCard
              to="/student/certificates"
              label="Certificates"
              Icon={Award}
              hint="Issued certificates"
              tone="accent"
            />
            <ActionCard
              to="/my-writings"
              label="My Writings"
              Icon={FilePen}
              hint={
                q.data
                  ? `${q.data.writing_pending} pending · ${q.data.writing_graded} graded`
                  : ''
              }
              tone="cta"
            />
            <ActionCard to="/history" label="History" Icon={History} tone="brand" />
            <ActionCard to="/profile" label="Profile" Icon={User} tone="accent" />
          </div>
        </section>

        {/* Optional avg trend */}
        {avg !== null && (
          <div
            className="mt-7 flex items-center gap-3 rounded-[16px] border border-slate-100 bg-white p-5 text-sm text-slate-600"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <span className="icon-tile icon-tile--accent" style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 0 }}>
              <TrendingUp className="h-5 w-5" />
            </span>
            Your average band is{' '}
            <strong className="text-slate-900">{avg.toFixed(1)}</strong>. Keep up the
            consistent practice!
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  delta,
  tone = 'slate',
}: {
  label: string
  value: string
  delta?: string
  tone?: 'brand' | 'accent' | 'cta' | 'slate'
}) {
  const accentColor: Record<string, string> = {
    brand: 'var(--brand-600)',
    accent: 'var(--accent-600)',
    cta: 'var(--cta-600)',
    slate: 'var(--slate-500)',
  }
  return (
    <div
      className="rounded-[18px] border border-slate-100 bg-white p-6"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-[32px] font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      {delta && (
        <div className="mt-1 text-[13px] font-semibold" style={{ color: accentColor[tone] }}>
          {delta}
        </div>
      )}
    </div>
  )
}

function ActionCard({
  to,
  label,
  Icon,
  hint,
  tone = 'brand',
}: {
  to: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  hint?: string
  tone?: 'brand' | 'accent' | 'cta'
}) {
  return (
    <Link
      to={to}
      className="group rounded-[18px] border border-slate-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-100"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className={`icon-tile icon-tile--${tone}`} style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 14 }}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm font-extrabold text-slate-900">{label}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Link>
  )
}
