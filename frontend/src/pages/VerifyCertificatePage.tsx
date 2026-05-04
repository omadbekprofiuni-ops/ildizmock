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
    year: 'numeric', month: 'long', day: '2-digit',
  })
}

export default function VerifyCertificatePage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<VerifyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    document.title = 'ILDIZmock — Sertifikatni tekshirish'
    if (!code) return
    api
      .get<VerifyResponse>(`/verify/${code}/`)
      .then((r) => setData(r.data))
      .catch((e) => {
        if (e?.response?.status === 404) {
          setNotFound(true)
        } else {
          setNotFound(true)
        }
      })
      .finally(() => setLoading(false))
  }, [code])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600"
        >
          ← Home
        </Link>

        <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Tekshirilmoqda…
            </div>
          ) : notFound ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <BadgeX size={36} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                Certificate not found
              </h1>
              <p className="mt-2 text-slate-600">
                Verification code is invalid or the certificate doesn't exist.
              </p>
              <p className="mt-4 font-mono text-xs text-slate-400">{code}</p>
            </div>
          ) : data?.valid ? (
            <ValidCertificate data={data} />
          ) : (
            <RevokedCertificate data={data} />
          )}
        </div>

        {data?.valid && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Bu sahifa har kim tomonidan ko'rilishi mumkin — sertifikatning
            haqiqiyligini tasdiqlaydi.
          </p>
        )}
      </div>
    </div>
  )
}

function ValidCertificate({ data }: { data: VerifyResponse }) {
  return (
    <>
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-6 text-white">
        <div className="flex items-center gap-3">
          <BadgeCheck size={32} />
          <div>
            <h1 className="text-xl font-bold">Certificate haqiqiy</h1>
            <p className="text-sm text-emerald-50">
              ILDIZmock Test sertifikati tasdiqlandi
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        <div className="text-center">
          <Award className="mx-auto mb-3 h-12 w-12 text-red-600" />
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Overall Band Score
          </p>
          <p className="mt-1 text-5xl font-bold text-slate-900">
            {data.overall_band_score ?? '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <Row label="Certificate raqami" value={data.certificate_number ?? ''} mono />
          <Row label="Student" value={data.full_name ?? ''} bold />
          <Row label="Center" value={data.organization_name ?? ''} />
          <Row label="Test sanasi" value={formatDate(data.test_date)} />
          <Row label="Berilgan sanasi" value={formatDate(data.issue_date)} last />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <ScoreBox label="Listening" value={data.listening_score ?? '—'} />
          <ScoreBox label="Reading" value={data.reading_score ?? '—'} />
          <ScoreBox label="Writing" value={data.writing_score ?? '—'} />
          <ScoreBox label="Speaking" value={data.speaking_score ?? '—'} />
        </div>
      </div>
    </>
  )
}

function RevokedCertificate({ data }: { data: VerifyResponse | null }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <BadgeX size={36} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Revoked</h1>
      <p className="mt-2 text-slate-600">
        This certificate has been revoked — it is no longer valid.
      </p>
      {data?.certificate_number && (
        <p className="mt-4 font-mono text-xs text-slate-400">
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
        last ? '' : 'border-b border-slate-100'
      }`}
    >
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`text-right ${mono ? 'font-mono text-sm' : 'text-sm'} ${
          bold ? 'font-semibold text-slate-900' : 'text-slate-700'
        }`}
      >
        {value || '—'}
      </span>
    </div>
  )
}

function ScoreBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-red-50 p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-red-700/70">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-bold text-red-700">
        {value}
      </div>
    </div>
  )
}
