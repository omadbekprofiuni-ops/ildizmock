import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Award, Download, ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
    year: 'numeric', month: 'long', day: '2-digit',
  })
}

export default function StudentCertificatesPage() {
  useEffect(() => { document.title = 'ILDIZmock — My Certificates' }, [])

  const query = useQuery({
    queryKey: ['my-certificates'],
    queryFn: async () =>
      (await api.get<CertificatesResponse>('/student/certificates/')).data,
  })

  const certs = query.data?.certificates ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Sertifikatlarim</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container space-y-6 py-10">
        {query.isLoading && (
          <p className="text-muted-foreground">Yuklanmoqda…</p>
        )}
        {query.isError && (
          <p className="text-destructive">
            Sertifikatlarni yuklab bo'lmadi.
          </p>
        )}

        {!query.isLoading && certs.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Award size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">
                Hali sertifikat yo'q
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Mock test topshiring va ustozingiz baholaganidan keyin
                sertifikatingiz shu yerda paydo bo'ladi.
              </p>
            </CardContent>
          </Card>
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
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-red-50 to-amber-50 p-6 text-center">
        <Award className="mx-auto mb-2 h-10 w-10 text-red-600" />
        <div className="text-3xl font-bold text-slate-900">
          {cert.overall_band_score}
        </div>
        <div className="text-xs uppercase tracking-wider text-slate-600">
          Overall Band Score
        </div>
      </div>

      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Sertifikat raqami
          </p>
          <p className="font-mono text-sm font-semibold text-slate-900">
            {cert.certificate_number}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-3">
          <ScoreCell label="L" value={cert.listening_score} />
          <ScoreCell label="R" value={cert.reading_score} />
          <ScoreCell label="W" value={cert.writing_score} />
          <ScoreCell label="S" value={cert.speaking_score} />
        </div>

        <div className="space-y-0.5 text-xs text-slate-600">
          <p>
            <span className="text-slate-400">Sessiya:</span> {cert.session_name}
          </p>
          <p>
            <span className="text-slate-400">Test sanasi:</span>{' '}
            {formatDate(cert.test_date)}
          </p>
          <p>
            <span className="text-slate-400">Berilgan:</span>{' '}
            {formatDate(cert.issue_date)}
          </p>
          {cert.issued_by && (
            <p>
              <span className="text-slate-400">Ustoz:</span> {cert.issued_by}
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {cert.pdf_url && (
            <a
              href={cert.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Download size={14} /> PDF
            </a>
          )}
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink size={14} /> Tekshirish
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold text-red-700">
        {value}
      </div>
    </div>
  )
}
