import { Award, ArrowLeft, BadgeCheck, Download, Mic, PenLine, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  PageShell,
  TableCard,
  adminTable,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

interface Certificate {
  id: number
  certificate_number: string
  is_revoked: boolean
  issue_date: string
  verification_code: string
}

interface Participant {
  id: number
  full_name: string
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
  overall_band_score: string | null
  writing_status: string
  speaking_status: string
  certificate: Certificate | null
}

interface SessionDetail {
  id: number
  name: string
  date: string
  status: string
  participants: Participant[]
}

export default function MockResultsPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = () => {
    if (!slug || !sessionId) return
    api
      .get<SessionDetail>(`/center/${slug}/mock/${sessionId}/`)
      .then((r) => setSession(r.data))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sessionId])

  if (!session) return <div className="p-6 text-slate-500">Yuklanmoqda…</div>

  const updateScore = async (
    participantId: number,
    field: 'writing' | 'speaking',
    score: string,
  ) => {
    if (score === '') return
    const num = Number(score)
    if (isNaN(num) || num < 0 || num > 9) {
      alert('0–9 oralig‘ida son kiriting')
      return
    }
    await api.post(
      `/center/${slug}/mock/${sessionId}/participants/${participantId}/score-${field}/`,
      { score: num },
    )
    load()
  }

  const issueCert = async (p: Participant) => {
    if (!p.overall_band_score) {
      alert('Avval barcha 4 modulni baholang.')
      return
    }
    if (!confirm(`${p.full_name} uchun rasmiy sertifikat berasizmi?`)) return
    setBusyId(p.id)
    try {
      const r = await api.post<{ pdf_url: string; certificate_number: string }>(
        `/center/${slug}/mock/${sessionId}/participants/${p.id}/issue-certificate/`,
      )
      load()
      // PDF ni avtomatik ochish
      if (r.data.pdf_url) window.open(r.data.pdf_url, '_blank')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      alert(err.response?.data?.detail ?? 'Xatolik yuz berdi')
    } finally {
      setBusyId(null)
    }
  }

  const revokeCert = async (p: Participant) => {
    const reason = prompt('Bekor qilish sababi (ixtiyoriy):') ?? ''
    if (reason === null) return
    if (!confirm(`${p.full_name} sertifikatini bekor qilasizmi?`)) return
    setBusyId(p.id)
    try {
      await api.post(
        `/center/${slug}/mock/${sessionId}/participants/${p.id}/revoke-certificate/`,
        { reason },
      )
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      alert(err.response?.data?.detail ?? 'Xatolik yuz berdi')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          to={`/${slug}/admin/mock/${sessionId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
        >
          <ArrowLeft size={14} /> Boshqaruv
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {session.name} — Natijalar
        </h1>
      </div>

      <TableCard>
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th className={adminTable.th}>Talaba</th>
              <th className={adminTable.th + ' text-center'}>L</th>
              <th className={adminTable.th + ' text-center'}>R</th>
              <th className={adminTable.th + ' text-center'}>W</th>
              <th className={adminTable.th + ' text-center'}>S</th>
              <th className={adminTable.th + ' text-center'}>Overall</th>
              <th className={adminTable.th + ' text-center'}>Sertifikat</th>
            </tr>
          </thead>
          <tbody className={adminTable.tbody}>
            {session.participants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                  Bu sessiyada talaba bo'lmagan.
                </td>
              </tr>
            ) : (
              session.participants.map((p) => {
                const cert = p.certificate
                const isBusy = busyId === p.id
                return (
                  <tr key={p.id} className={adminTable.trHover}>
                    <td className={adminTable.td + ' font-semibold text-slate-900'}>
                      {p.full_name}
                    </td>
                    <td className={adminTable.td + ' text-center font-mono'}>
                      {p.listening_score ?? '—'}
                    </td>
                    <td className={adminTable.td + ' text-center font-mono'}>
                      {p.reading_score ?? '—'}
                    </td>
                    <td className={adminTable.td + ' text-center'}>
                      <div className="flex flex-col items-center gap-1">
                        <ScoreInput
                          value={p.writing_score}
                          onSave={(v) => updateScore(p.id, 'writing', v)}
                        />
                        <Link
                          to={`/teacher/mock/writing/${p.id}`}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            p.writing_status === 'graded'
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                          title="To'liq baholash (kriteriyalar + feedback)"
                        >
                          <PenLine size={11} />
                          {p.writing_status === 'graded' ? 'Tahrirlash' : 'Baholash'}
                        </Link>
                      </div>
                    </td>
                    <td className={adminTable.td + ' text-center'}>
                      <div className="flex flex-col items-center gap-1">
                        <ScoreInput
                          value={p.speaking_score}
                          onSave={(v) => updateScore(p.id, 'speaking', v)}
                        />
                        <Link
                          to={`/teacher/mock/speaking/${p.id}`}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            p.speaking_status === 'graded'
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                          title="To'liq baholash (kriteriyalar + audio)"
                        >
                          <Mic size={11} />
                          {p.speaking_status === 'graded' ? 'Tahrirlash' : 'Baholash'}
                        </Link>
                      </div>
                    </td>
                    <td className={adminTable.td + ' text-center'}>
                      {p.overall_band_score ? (
                        <span className="rounded-lg bg-red-50 px-3 py-1 font-mono text-base font-bold text-red-700">
                          {p.overall_band_score}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={adminTable.td + ' text-center'}>
                      {cert && !cert.is_revoked ? (
                        <CertActions
                          cert={cert}
                          onRevoke={() => revokeCert(p)}
                          disabled={isBusy}
                          slug={slug!}
                        />
                      ) : cert && cert.is_revoked ? (
                        <div className="space-y-1">
                          <div className="text-xs text-rose-600">
                            ⊘ bekor qilingan
                          </div>
                          <button
                            type="button"
                            disabled={isBusy || !p.overall_band_score}
                            onClick={() => issueCert(p)}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            Qayta berish
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy || !p.overall_band_score}
                          onClick={() => issueCert(p)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            p.overall_band_score
                              ? 'Sertifikat berish'
                              : 'Avval barcha modullarni baholang'
                          }
                        >
                          <Award size={12} /> Berish
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </TableCard>
    </PageShell>
  )
}

function CertActions({
  cert,
  onRevoke,
  disabled,
  slug,
}: {
  cert: Certificate
  onRevoke: () => void
  disabled: boolean
  slug: string
}) {
  void slug
  return (
    <div className="space-y-1">
      <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <BadgeCheck size={12} />
        {cert.certificate_number}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <a
          href={`/verify/${cert.verification_code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          <Download size={11} /> Ko'rish
        </a>
        <button
          type="button"
          onClick={onRevoke}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          title="Sertifikatni bekor qilish"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function ScoreInput({
  value,
  onSave,
}: {
  value: string | null
  onSave: (v: string) => void
}) {
  const [v, setV] = useState(value ?? '')
  return (
    <input
      type="number"
      step="0.5"
      min={0}
      max={9}
      placeholder="—"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (value ?? '') && onSave(v)}
      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-center font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
    />
  )
}
