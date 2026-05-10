import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

import TeacherLayout from '../TeacherLayout'

interface Detail {
  id: number
  full_name: string
  session: { id: number; name: string; date: string; status: string }
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
  speaking_feedback: string
  overall_band_score: string | null
  speaking_criteria?: {
    speaking_fluency: string | null
    speaking_lexical: string | null
    speaking_grammar: string | null
    speaking_pronunciation: string | null
  }
}

const CRITERIA = [
  { key: 'speaking_fluency', label: 'Fluency and Coherence' },
  { key: 'speaking_lexical', label: 'Lexical Resource' },
  { key: 'speaking_grammar', label: 'Grammatical Range and Accuracy' },
  { key: 'speaking_pronunciation', label: 'Pronunciation' },
] as const

type CriteriaKey = typeof CRITERIA[number]['key']

export default function MockSpeakingGradePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [vals, setVals] = useState<Record<CriteriaKey, string>>({
    speaking_fluency: '',
    speaking_lexical: '',
    speaking_grammar: '',
    speaking_pronunciation: '',
  })
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api
      .get<Detail>(`/teacher/mock/speaking/${id}/`)
      .then((r) => {
        setDetail(r.data)
        const c = r.data.speaking_criteria
        if (c) {
          setVals({
            speaking_fluency: c.speaking_fluency ?? '',
            speaking_lexical: c.speaking_lexical ?? '',
            speaking_grammar: c.speaking_grammar ?? '',
            speaking_pronunciation: c.speaking_pronunciation ?? '',
          })
        }
        setFeedback(r.data.speaking_feedback ?? '')
      })
      .catch(() => setError('Student not found or access denied.'))
  }, [id])

  const avg = useMemo(() => {
    const nums = (Object.values(vals) as string[])
      .map((v) => parseFloat(v))
      .filter((n) => Number.isFinite(n))
    if (nums.length !== 4) return null
    const a = nums.reduce((s, n) => s + n, 0) / 4
    return Math.round(a * 2) / 2 // 0.5 step IELTS rounding (approx)
  }, [vals])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Validate: each 0–9
    for (const c of CRITERIA) {
      const n = parseFloat(vals[c.key])
      if (!Number.isFinite(n) || n < 0 || n > 9) {
        setError(`${c.label} must be between 0 and 9.`)
        return
      }
    }
    setBusy(true)
    try {
      const r = await api.post<{ next_id: number | null }>(
        `/teacher/mock/speaking/${id}/grade/`,
        { ...vals, feedback },
      )
      if (r.data.next_id) {
        navigate(`/teacher/mock/speaking/${r.data.next_id}`, { replace: true })
      } else {
        navigate('/teacher/mock/speaking', { replace: true })
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (error && !detail)
    return (
      <TeacherLayout>
        <div className="p-8 text-brand-600">{error}</div>
      </TeacherLayout>
    )
  if (!detail)
    return (
      <TeacherLayout>
        <div className="p-8 text-slate-500">Loading…</div>
      </TeacherLayout>
    )

  return (
    <TeacherLayout>
      <header className="border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-bold">{detail.full_name}</h1>
        <p className="text-sm text-slate-500">
          {detail.session.name} · {detail.session.date}
        </p>
      </header>

      <div className="mx-auto max-w-2xl p-8">
        <div className="mb-6 grid grid-cols-3 gap-3 rounded-2xl border bg-white p-4">
          <Cell label="Listening" value={detail.listening_score} />
          <Cell label="Reading" value={detail.reading_score} />
          <Cell label="Writing" value={detail.writing_score} />
        </div>

        <form
          onSubmit={submit}
          className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Speaking — 4 kriteriya bo‘yicha baholash
            </h2>
            <div className="space-y-3">
              {CRITERIA.map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <label className="flex-1 text-sm text-slate-700">{c.label}</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={9}
                    required
                    value={vals[c.key]}
                    onChange={(e) =>
                      setVals((v) => ({ ...v, [c.key]: e.target.value }))
                    }
                    className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2 text-center font-mono text-lg font-bold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-center">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                4 kriteriya o‘rtachasi (Speaking band)
              </div>
              <div className="mt-1 font-mono text-3xl font-bold text-slate-900">
                {avg != null ? avg.toFixed(1) : '—'}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Note for student (optional)
            </label>
            <textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/teacher/mock/speaking')}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← Navbatga qaytish
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-emerald-600 px-8 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </TeacherLayout>
  )
}

function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="font-mono text-2xl font-bold">{value ?? '—'}</p>
    </div>
  )
}
