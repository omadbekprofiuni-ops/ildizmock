import { Award, ArrowLeft, BadgeCheck, Download, FileSpreadsheet, Mic, PenLine, ShieldCheck, Trash2 } from 'lucide-react'
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
  exam_taker_id: string
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
  overall_band_score: string | null
  writing_status: string
  speaking_status: string
  certificate: Certificate | null
  // ETAP 21 — admin override audit
  writing_override_band: string | null
  writing_override_reason: string
  writing_overridden_by_name: string | null
  writing_overridden_at: string | null
  speaking_override_band: string | null
  speaking_override_reason: string
  speaking_overridden_by_name: string | null
  speaking_overridden_at: string | null
  effective_writing_score: string | null
  effective_speaking_score: string | null
}

interface SessionDetail {
  id: number
  name: string
  date: string
  status: string
  is_official_exam: boolean
  participants: Participant[]
}

type OverrideKind = 'writing' | 'speaking'

interface OverrideTarget {
  participant: Participant
  kind: OverrideKind
}

export default function MockResultsPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null)

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

  if (!session) return <div className="p-6 text-slate-500">Loading…</div>

  const updateScore = async (
    participantId: number,
    field: 'writing' | 'speaking',
    score: string,
  ) => {
    if (score === '') return
    const num = Number(score)
    if (isNaN(num) || num < 0 || num > 9) {
      alert('Enter a number between 0 and 9')
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
      alert('First grade all 4 modules.')
      return
    }
    if (!confirm(`Issue an official certificate for ${p.full_name}?`)) return
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
    const reason = prompt('Cancellation reason (optional):') ?? ''
    if (reason === null) return
    if (!confirm(`Revoke ${p.full_name}'s certificate?`)) return
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to={`/${slug}/admin/mock/${sessionId}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
          >
            <ArrowLeft size={14} /> Control
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {session.name} — Results
          </h1>
          {session.is_official_exam && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              <ShieldCheck size={12} /> Rasmiy mock imtihon — natija talabaga ko'rinmaydi
            </div>
          )}
        </div>
        <a
          href={`${api.defaults.baseURL}/center/${slug}/mock/${sessionId}/export/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <FileSpreadsheet size={16} /> Excel'ga eksport
        </a>
      </div>

      <TableCard>
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th className={adminTable.th}>Exam Taker ID / Student</th>
              <th className={adminTable.th + ' text-center'}>L</th>
              <th className={adminTable.th + ' text-center'}>R</th>
              <th className={adminTable.th + ' text-center'}>W</th>
              <th className={adminTable.th + ' text-center'}>S</th>
              <th className={adminTable.th + ' text-center'}>Overall</th>
              <th className={adminTable.th + ' text-center'}>Certificate</th>
            </tr>
          </thead>
          <tbody className={adminTable.tbody}>
            {session.participants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                  No students in this session.
                </td>
              </tr>
            ) : (
              session.participants.map((p) => {
                const cert = p.certificate
                const isBusy = busyId === p.id
                return (
                  <tr key={p.id} className={adminTable.trHover}>
                    <td className={adminTable.td + ' font-semibold text-slate-900'}>
                      <div>{p.full_name}</div>
                      {p.exam_taker_id && (
                        <div className="mt-0.5 inline-flex items-center rounded bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-rose-700">
                          {p.exam_taker_id}
                        </div>
                      )}
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
                        {p.writing_override_band && (
                          <div
                            className="text-[10px] font-semibold text-amber-700"
                            title={`Override: ${p.writing_override_reason}`}
                          >
                            ↳ override: <span className="font-mono">{p.writing_override_band}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/teacher/mock/writing/${p.id}`}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              p.writing_status === 'graded'
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title="Full grading (criteria + feedback)"
                          >
                            <PenLine size={11} />
                            {p.writing_status === 'graded' ? 'Edit' : 'Baholash'}
                          </Link>
                          {p.writing_score && (
                            <button
                              type="button"
                              onClick={() => setOverrideTarget({ participant: p, kind: 'writing' })}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-200"
                              title="Admin override (teacher bahosini o'zgartirish)"
                            >
                              <ShieldCheck size={10} /> Override
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={adminTable.td + ' text-center'}>
                      <div className="flex flex-col items-center gap-1">
                        <ScoreInput
                          value={p.speaking_score}
                          onSave={(v) => updateScore(p.id, 'speaking', v)}
                        />
                        {p.speaking_override_band && (
                          <div
                            className="text-[10px] font-semibold text-amber-700"
                            title={`Override: ${p.speaking_override_reason}`}
                          >
                            ↳ override: <span className="font-mono">{p.speaking_override_band}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/teacher/mock/speaking/${p.id}`}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              p.speaking_status === 'graded'
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title="Full grading (criteria + audio)"
                          >
                            <Mic size={11} />
                            {p.speaking_status === 'graded' ? 'Edit' : 'Baholash'}
                          </Link>
                          {p.speaking_score && (
                            <button
                              type="button"
                              onClick={() => setOverrideTarget({ participant: p, kind: 'speaking' })}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-200"
                              title="Admin override (teacher bahosini o'zgartirish)"
                            >
                              <ShieldCheck size={10} /> Override
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={adminTable.td + ' text-center'}>
                      {p.overall_band_score ? (
                        <span className="rounded-lg bg-brand-50 px-3 py-1 font-mono text-base font-bold text-brand-700">
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
                          <div className="text-xs text-cta-600">
                            ⊘ revoked
                          </div>
                          <button
                            type="button"
                            disabled={isBusy || !p.overall_band_score}
                            onClick={() => issueCert(p)}
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                          >
                            Qayta berish
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy || !p.overall_band_score}
                          onClick={() => issueCert(p)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            p.overall_band_score
                              ? 'Certificate berish'
                              : 'First grade all modules'
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

      {overrideTarget && (
        <OverrideModal
          slug={slug!}
          sessionId={sessionId!}
          target={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onSaved={() => {
            setOverrideTarget(null)
            load()
          }}
        />
      )}
    </PageShell>
  )
}

function OverrideModal({
  slug,
  sessionId,
  target,
  onClose,
  onSaved,
}: {
  slug: string
  sessionId: string
  target: OverrideTarget
  onClose: () => void
  onSaved: () => void
}) {
  const p = target.participant
  const kind = target.kind
  const originalBand = kind === 'writing' ? p.writing_score : p.speaking_score
  const existingOverride = kind === 'writing' ? p.writing_override_band : p.speaking_override_band
  const existingReason = kind === 'writing' ? p.writing_override_reason : p.speaking_override_reason
  const [band, setBand] = useState(existingOverride ?? '')
  const [reason, setReason] = useState(existingReason ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    const num = Number(band)
    if (isNaN(num) || num < 0 || num > 9 || (num * 2) % 1 !== 0) {
      setError("Band 0–9 oralig'ida, 0.5 qadam bilan bo'lishi kerak.")
      return
    }
    if (!reason.trim()) {
      setError('Override sababini kiriting.')
      return
    }
    setBusy(true)
    try {
      await api.post(
        `/center/${slug}/mock/${sessionId}/participants/${p.id}/override-${kind}/`,
        { band: num, reason: reason.trim() },
      )
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Saqlashda xatolik.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {kind === 'writing' ? 'Writing' : 'Speaking'} override
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {p.exam_taker_id || p.full_name} — teacher bahosi: <span className="font-mono font-semibold">{originalBand}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Yopish"
          >
            ✕
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Yangi band (0–9, 0.5 qadam)
        </label>
        <input
          type="number"
          step="0.5"
          min="0"
          max="9"
          value={band}
          onChange={(e) => setBand(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg font-bold focus:border-rose-500 focus:outline-none"
          placeholder="6.5"
        />

        <div className="mb-4 grid grid-cols-5 gap-1">
          {['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9'].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBand(b)}
              className={`rounded-md py-1.5 text-xs font-bold ${band === b ? 'bg-rose-600 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              {b}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Override sababi <span className="text-rose-600">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
          placeholder="Masalan: Re-checked, teacher's grade was too high"
        />

        {error && (
          <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
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
          className="inline-flex items-center gap-1 rounded border border-cta-100 px-2 py-0.5 text-xs text-cta-600 hover:bg-cta-50 disabled:opacity-50"
          title="Revoke certificate"
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
      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-center font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    />
  )
}
