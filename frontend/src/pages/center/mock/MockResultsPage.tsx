import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  PageShell,
  TableCard,
  adminTable,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

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
              <th className={adminTable.th + ' text-center'}>Listening</th>
              <th className={adminTable.th + ' text-center'}>Reading</th>
              <th className={adminTable.th + ' text-center'}>Writing</th>
              <th className={adminTable.th + ' text-center'}>Speaking</th>
              <th className={adminTable.th + ' text-center'}>Overall</th>
            </tr>
          </thead>
          <tbody className={adminTable.tbody}>
            {session.participants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                  Bu sessiyada talaba bo'lmagan.
                </td>
              </tr>
            ) : (
              session.participants.map((p) => (
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
                    <ScoreInput
                      value={p.writing_score}
                      onSave={(v) => updateScore(p.id, 'writing', v)}
                    />
                  </td>
                  <td className={adminTable.td + ' text-center'}>
                    <ScoreInput
                      value={p.speaking_score}
                      onSave={(v) => updateScore(p.id, 'speaking', v)}
                    />
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </PageShell>
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
