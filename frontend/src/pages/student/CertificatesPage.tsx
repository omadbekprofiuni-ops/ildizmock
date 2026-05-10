import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Award, Download, ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { api } from '@/lib/api'

interface CertificateRow {
  id: number
  certificate_number: string
  verification_code: string
  full_name: string
  organization_name: string
  test_date: string
  issue_date: string
  listening_score: string
  reading_score: string
  writing_score: string
  speaking_score: string
  overall_band_score: string
  issued_by: string
  pdf_url: string | null
  session_name: string
}

interface CertificatesResponse {
  certificates: CertificateRow[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  })
}

export default function StudentCertificatesPage() {
  useEffect(() => {
    document.title = 'ILDIZmock — My Certificates'
  }, [])

  const query = useQuery({
    queryKey: ['my-certificates'],
    queryFn: async () =>
      (await api.get<CertificatesResponse>('/student/certificates/')).data,
  })

  const certs = query.data?.certificates ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              My Certificates
            </h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-8 py-10">
        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && (
          <p className="text-cta-600">Couldn't load certificates.</p>
        )}

        {!query.isLoading && certs.length === 0 && (
          <div
            className="rounded-[20px] border border-slate-100 bg-white py-16 text-center"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <div
              className="icon-tile icon-tile--brand mx-auto"
              style={{ width: 64, height: 64, borderRadius: 20 }}
            >
              <Award size={28} />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-slate-900">
              No certificates yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-md px-6 text-sm text-slate-500">
              Take a mock test and once your teacher grades it, your certificate will
              appear here.
            </p>
          </div>
        )}

        {certs.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {certs.map((c) => (
              <CertificateCard key={c.id} cert={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function CertificateCard({ cert }: { cert: CertificateRow }) {
  const verifyUrl = `${window.location.origin}/verify/${cert.verification_code}`
  return (
    <article
      className="overflow-hidden rounded-[20px] border border-slate-100 bg-white"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div
        className="relative overflow-hidden p-6 text-center text-white"
        style={{ background: 'var(--gradient-hero)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative">
          <Award className="mx-auto mb-2 h-10 w-10" />
          <div className="text-3xl font-extrabold tracking-tight">
            {cert.overall_band_score}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-90">
            Overall Band Score
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Certificate number
          </p>
          <p
            className="mt-0.5 text-sm font-extrabold text-slate-900"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {cert.certificate_number}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-3">
          <ScoreCell label="L" value={cert.listening_score} tone="cta" />
          <ScoreCell label="R" value={cert.reading_score} tone="brand" />
          <ScoreCell label="W" value={cert.writing_score} tone="accent" />
          <ScoreCell label="S" value={cert.speaking_score} tone="slate" />
        </div>

        <div className="space-y-1 text-xs text-slate-600">
          <p>
            <span className="text-slate-400">Session:</span> {cert.session_name}
          </p>
          <p>
            <span className="text-slate-400">Test date:</span>{' '}
            {formatDate(cert.test_date)}
          </p>
          <p>
            <span className="text-slate-400">Issued:</span>{' '}
            {formatDate(cert.issue_date)}
          </p>
          {cert.issued_by && (
            <p>
              <span className="text-slate-400">Teacher:</span> {cert.issued_by}
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {cert.pdf_url && (
            <a
              href={cert.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700"
            >
              <Download size={14} /> PDF
            </a>
          )}
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            <ExternalLink size={14} /> Verify
          </a>
        </div>
      </div>
    </article>
  )
}

function ScoreCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'brand' | 'accent' | 'cta' | 'slate'
}) {
  const colorMap: Record<string, string> = {
    brand: 'var(--brand-700)',
    accent: 'var(--accent-700)',
    cta: 'var(--cta-700)',
    slate: 'var(--slate-700)',
  }
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </div>
      <div
        className="mt-0.5 text-sm font-extrabold"
        style={{ color: colorMap[tone], fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </div>
    </div>
  )
}
