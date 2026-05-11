import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
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
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  })
}

export default function MockResultDetailPage() {
  const { id } = useParams<{ id: string }>()

  useEffect(() => {
    document.title = 'ILDIZmock — Mock Result'
  }, [])

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
        description: 'Please try again shortly.',
      })
    },
  })

  const data = query.data
  const overall = data?.overall_band_score
  const completed = !!overall

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/student/mock"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Mock results
            </Link>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              Mock Test Result
            </h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-8 py-10">
        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && <p className="text-cta-600">Failed to load result.</p>}

        {data && (
          <>
            {/* Hero */}
            <div
              className="relative overflow-hidden rounded-[28px] p-8 text-center text-white"
              style={{ background: 'var(--gradient-hero)', boxShadow: 'var(--shadow-lg)' }}
            >
              <div
                className="absolute inset-0 opacity-[0.08]"
                style={{
                  backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
                  backgroundSize: '32px 32px',
                }}
              />
              <div className="relative flex flex-col items-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                  {formatDate(data.session_date)}
                </p>
                <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">
                  {data.session_name}
                </h2>

                {completed ? (
                  <div className="mt-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                      Overall Band Score
                    </p>
                    <p className="mt-1 text-7xl font-extrabold leading-none tracking-tight">
                      {fmt(overall)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur">
                    Grading in progress — all sections must be completed to see the
                    result.
                  </div>
                )}
              </div>
            </div>

            {/* Section scores */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SectionScore label="Listening" value={fmt(data.listening_score)} tone="cta" />
              <SectionScore label="Reading" value={fmt(data.reading_score)} tone="brand" />
              <SectionScore
                label="Writing"
                value={fmt(data.writing_score)}
                tone="accent"
                hint={data.writing_status === 'pending' ? 'pending' : null}
              />
              <SectionScore
                label="Speaking"
                value={fmt(data.speaking_score)}
                tone="slate"
                hint={data.speaking_status === 'pending' ? 'pending' : null}
              />
            </div>

            {data.writing_feedback && (
              <FeedbackCard
                title="Writing feedback"
                feedback={data.writing_feedback}
                tone="brand"
              />
            )}
            {data.speaking_feedback && (
              <FeedbackCard
                title="Speaking feedback"
                feedback={data.speaking_feedback}
                tone="accent"
              />
            )}

            {(data.writing_task1_text || data.writing_task2_text) && (
              <div
                className="rounded-[20px] border border-slate-100 bg-white p-7"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <h3 className="mb-4 text-base font-extrabold text-slate-900">
                  Your Writing answers
                </h3>
                <div className="space-y-4">
                  {data.writing_task1_text && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Task 1
                      </p>
                      <pre className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800">
                        {data.writing_task1_text}
                      </pre>
                    </div>
                  )}
                  {data.writing_task2_text && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Task 2
                      </p>
                      <pre className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800">
                        {data.writing_task2_text}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {completed && (
              <div
                className="flex flex-col items-center gap-3 rounded-[20px] border border-slate-100 bg-white p-7 text-center"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <p className="text-sm text-slate-600">
                  Your Mock IELTS certificate is ready.
                </p>
                <button
                  type="button"
                  onClick={() => downloadMutation.mutate()}
                  disabled={downloadMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cta-500 px-7 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.30)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {downloadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" /> Download certificate
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-500">
                  This is a practice certificate, not an official IELTS result.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function SectionScore({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: string
  tone: 'brand' | 'accent' | 'cta' | 'slate'
  hint?: string | null
}) {
  const colorMap: Record<string, string> = {
    brand: 'var(--brand-700)',
    accent: 'var(--accent-700)',
    cta: 'var(--cta-700)',
    slate: 'var(--slate-700)',
  }
  return (
    <div
      className="rounded-[18px] border border-slate-100 bg-white p-5 text-center"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className="mt-1.5 text-3xl font-extrabold tracking-tight"
        style={{ color: colorMap[tone] }}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] font-bold text-amber-600">{hint}</p>}
    </div>
  )
}

function FeedbackCard({
  title,
  feedback,
  tone,
}: {
  title: string
  feedback: string
  tone: 'brand' | 'accent'
}) {
  const palette =
    tone === 'brand'
      ? { border: 'var(--brand-500)', bg: 'var(--brand-50)' }
      : { border: 'var(--accent-500)', bg: 'var(--accent-50)' }
  return (
    <div
      className="rounded-[20px] border border-slate-100 bg-white p-7"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <h3 className="mb-3 text-base font-extrabold text-slate-900">{title}</h3>
      <div
        className="rounded-2xl border-l-4 p-5"
        style={{ borderColor: palette.border, background: palette.bg }}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {feedback}
        </p>
      </div>
    </div>
  )
}
