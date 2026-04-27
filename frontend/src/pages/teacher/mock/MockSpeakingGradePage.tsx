import { useEffect, useState } from 'react'
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
}

export default function MockSpeakingGradePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api
      .get<Detail>(`/teacher/mock/speaking/${id}/`)
      .then((r) => {
        setDetail(r.data)
        setScore(r.data.speaking_score ?? '')
        setFeedback(r.data.speaking_feedback ?? '')
      })
      .catch(() => setError('Talaba topilmadi yoki ruxsat yo‘q.'))
  }, [id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await api.post<{ next_id: number | null }>(
        `/teacher/mock/speaking/${id}/grade/`,
        { score, feedback },
      )
      if (r.data.next_id) {
        navigate(`/teacher/mock/speaking/${r.data.next_id}`, { replace: true })
      } else {
        navigate('/teacher/mock/speaking', { replace: true })
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'Saqlashda xatolik')
    } finally {
      setBusy(false)
    }
  }

  if (error)
    return (
      <TeacherLayout>
        <div className="p-8 text-red-600">{error}</div>
      </TeacherLayout>
    )
  if (!detail)
    return (
      <TeacherLayout>
        <div className="p-8 text-slate-500">Yuklanmoqda…</div>
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
            <label className="mb-2 block text-sm font-medium">
              Speaking Band Score (0–9)
            </label>
            <input
              autoFocus
              type="number"
              step={0.5}
              min={0}
              max={9}
              required
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-center font-mono text-3xl font-bold focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-2 text-center text-xs text-slate-500">
              4 ta criteria o'rtachasi: Fluency, Lexical, Grammar, Pronunciation
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Talaba uchun izoh (ixtiyoriy)
            </label>
            <textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
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
              {busy ? 'Saqlanyapti…' : 'Saqlash'}
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
