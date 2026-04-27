import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

interface Participant {
  id: number
  full_name: string
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
}

interface SessionDetail {
  id: number
  name: string
  date: string
  status: string
  participants: Participant[]
}

const numeric = (v: string | null) => (v == null ? null : Number(v))

const overall = (p: Participant): string => {
  const parts = [
    numeric(p.listening_score),
    numeric(p.reading_score),
    numeric(p.writing_score),
    numeric(p.speaking_score),
  ].filter((v): v is number => v != null)
  if (!parts.length) return '—'
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length
  // Round to nearest 0.5
  return (Math.round(avg * 2) / 2).toFixed(1)
}

export default function MockResultsPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)

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

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to={`/${slug}/admin/mock/${sessionId}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Boshqaruv
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-light text-slate-900">
          {session.name} — Natijalar
        </h1>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="p-4">Talaba</th>
              <th className="p-4 text-center">Listening</th>
              <th className="p-4 text-center">Reading</th>
              <th className="p-4 text-center">Writing</th>
              <th className="p-4 text-center">Speaking</th>
              <th className="p-4 text-center">Overall</th>
            </tr>
          </thead>
          <tbody>
            {session.participants.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Bu sessiyada talaba bo'lmagan.
                </td>
              </tr>
            ) : (
              session.participants.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-4 font-medium text-slate-900">{p.full_name}</td>
                  <td className="p-4 text-center font-mono">
                    {p.listening_score ?? '—'}
                  </td>
                  <td className="p-4 text-center font-mono">
                    {p.reading_score ?? '—'}
                  </td>
                  <td className="p-4 text-center">
                    <ScoreInput
                      value={p.writing_score}
                      onSave={(v) => updateScore(p.id, 'writing', v)}
                    />
                  </td>
                  <td className="p-4 text-center">
                    <ScoreInput
                      value={p.speaking_score}
                      onSave={(v) => updateScore(p.id, 'speaking', v)}
                    />
                  </td>
                  <td className="p-4 text-center font-mono font-bold text-slate-900">
                    {overall(p)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
      className="w-20 rounded border border-slate-300 px-2 py-1 text-center font-mono"
    />
  )
}
