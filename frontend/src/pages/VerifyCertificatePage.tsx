import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Award, BadgeCheck, BadgeX, Loader2 } from 'lucide-react'

import { api } from '@/lib/api'

interface VerifyResponse {
  valid: boolean
  revoked?: boolean
  detail?: string
  certificate_number?: string
  full_name?: string
  organization_name?: string
  test_date?: string
  issue_date?: string
  listening_score?: string
  reading_score?: string
  writing_score?: string
  speaking_score?: string
  overall_band_score?: string
  revoked_at?: string | null
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  })
}

export default function VerifyCertificatePage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<VerifyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    document.title = 'ILDIZmock — Verify Certificate'
    if (!code) return
    api
      .get<VerifyResponse>(`/verify/${code}/`)
      .then((r) => setData(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [code])

  return (
    <div
      className="min-h-screen px-6 py-12"
      style={{
        background: 'linear-gradient(135deg, var(--brand-50), white 50%, var(--accent-50))',
      }}
    >
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="mb-4 inline-block text-sm font-semibold text-slate-500 transition-colors hover:text-brand-600"
        >
          ← Home
        </Link>

        <div
          className="overflow-hidden rounded-[24px] border border-slate-100 bg-white"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Verifying…
            </div>
          ) : notFound ? (
            <div className="p-10 text-center">
              <div
                className="icon-tile icon-tile--cta mx-auto"
                style={{ width: 72, height: 72, borderRadius: 22 }}
              >
                <BadgeX size={32} />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
                Certificate not found
              </h1>
              <p className="mt-2 text-slate-600">
                Verification code is invalid or the certificate doesn't exist.
              </p>
              <p
                className="mt-4 text-xs text-slate-400"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {code}
              </p>
            </div>
          ) : data?.valid ? (
            <ValidCertificate data={data} />
          ) : (
            <RevokedCertificate data={data} />
          )}
        </div>

        {data?.valid && (
          <p className="mt-4 text-center text-xs text-slate-400">
            This page is publicly viewable — it confirms certificate authenticity.
          </p>
        )}
      </div>
    </div>
  )
}

function ValidCertificate({ data }: { data: VerifyResponse }) {
  return (
    <>
      <div
        className="px-8 py-6 text-white"
        style={{ background: 'var(--gradient-hero)' }}
      >
        <div className="flex items-center gap-3">
          <BadgeCheck size={32} />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Certificate verified</h1>
            <p className="text-sm text-white/85">
              ILDIZmock Test certificate is authentic
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        <div className="text-center">
          <div
            className="icon-tile icon-tile--brand mx-auto"
            style={{ width: 56, height: 56, borderRadius: 18 }}
          >
            <Award className="h-7 w-7" />
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Overall Band Score
          </p>
          <p
            className="mt-1 text-5xl font-extrabold tracking-tight"
            style={{
              background: 'var(--gradient-brand)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {data.overall_band_score ?? '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <Row label="Certificate number" value={data.certificate_number ?? ''} mono />
          <Row label="Student" value={data.full_name ?? ''} bold />
          <Row label="Center" value={data.organization_name ?? ''} />
          <Row label="Test date" value={formatDate(data.test_date)} />
          <Row label="Issue date" value={formatDate(data.issue_date)} last />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <ScoreBox label="Listening" value={data.listening_score ?? '—'} tone="cta" />
          <ScoreBox label="Reading" value={data.reading_score ?? '—'} tone="brand" />
          <ScoreBox label="Writing" value={data.writing_score ?? '—'} tone="accent" />
          <ScoreBox label="Speaking" value={data.speaking_score ?? '—'} tone="slate" />
        </div>
      </div>
    </>
  )
}

function RevokedCertificate({ data }: { data: VerifyResponse | null }) {
  return (
    <div className="p-10 text-center">
      <div
        className="icon-tile icon-tile--cta mx-auto"
        style={{ width: 72, height: 72, borderRadius: 22 }}
      >
        <BadgeX size={32} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">Revoked</h1>
      <p className="mt-2 text-slate-600">
        This certificate has been revoked — it is no longer valid.
      </p>
      {data?.certificate_number && (
        <p
          className="mt-4 text-xs text-slate-400"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {data.certificate_number}
        </p>
      )}
      {data?.revoked_at && (
        <p className="mt-1 text-xs text-slate-400">
          Revoked: {formatDate(data.revoked_at)}
        </p>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  bold,
  last,
}: {
  label: string
  value: string
  mono?: boolean
  bold?: boolean
  last?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-2.5 ${
        last ? '' : 'border-b border-slate-200'
      }`}
    >
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span
        className={`text-right text-sm ${
          bold ? 'font-extrabold text-slate-900' : 'text-slate-700'
        }`}
        style={mono ? { fontFamily: 'var(--font-mono)' } : undefined}
      >
        {value || '—'}
      </span>
    </div>
  )
}

function ScoreBox({
  label,
  value,
  tone = 'brand',
}: {
  label: string
  value: string
  tone?: 'brand' | 'accent' | 'cta' | 'slate'
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    brand: { bg: 'var(--brand-50)', fg: 'var(--brand-700)' },
    accent: { bg: 'var(--accent-50)', fg: 'var(--accent-700)' },
    cta: { bg: 'var(--cta-50)', fg: 'var(--cta-700)' },
    slate: { bg: 'var(--slate-100)', fg: 'var(--slate-700)' },
  }
  const p = palette[tone]
  return (
    <div className="rounded-2xl p-3 text-center" style={{ background: p.bg }}>
      <div
        className="text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: p.fg, opacity: 0.8 }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-xl font-extrabold tabular-nums"
        style={{ color: p.fg, fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </div>
    </div>
  )
}
