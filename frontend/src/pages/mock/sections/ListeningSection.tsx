import { useEffect, useRef, useState } from 'react'

import { LockedAudio } from '@/components/LockedAudio'
import { api } from '@/lib/api'

import { FullscreenGate } from './FullscreenGate'
import { QuestionRenderer, type Question } from './QuestionRenderer'
import { Timer } from './Timer'

interface ListeningPart {
  id: number
  part_number: number
  audio_url: string | null
  audio_duration_seconds: number
  instructions: string
  questions: Question[]
}

export function ListeningSection({
  bsid,
  name,
  secondsRemaining,
  onSubmit,
}: {
  bsid: string
  name: string
  secondsRemaining: number
  onSubmit: () => void
}) {
  const [parts, setParts] = useState<ListeningPart[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // Foydalanuvchi qaysi part'ning audiosini eshitgan — qayta tashrif buyurganda
  // audio qayta boshlanmasligi uchun.
  const [playedIdx, setPlayedIdx] = useState<Set<number>>(new Set())
  const submittedRef = useRef(false)

  useEffect(() => {
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => setParts(r.data.listening_parts || []))
      .finally(() => setLoading(false))
  }, [bsid])

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      await api.post(`/mock/submit/listening/${bsid}/`, { answers })
      onSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmit = () => {
    if (!submittedRef.current) submit()
  }

  const goToPart = (idx: number) => {
    setActiveIdx(idx)
    setPlayedIdx((prev) => new Set(prev).add(idx))
  }

  // Birinchi part audiosi sahifa ochilganda darhol boshlanadi
  useEffect(() => {
    if (parts.length > 0) {
      setPlayedIdx((prev) => {
        if (prev.has(0)) return prev
        const next = new Set(prev)
        next.add(0)
        return next
      })
    }
  }, [parts.length])

  if (loading) return <div className="p-6 text-slate-500">Yuklanmoqda…</div>
  if (parts.length === 0) {
    return <div className="p-6 text-slate-500">Listening testda part topilmadi.</div>
  }

  const part = parts[activeIdx]
  const audioReady = part.audio_url && playedIdx.has(activeIdx)

  return (
    <FullscreenGate title="Listening Test">
      <div className="flex h-screen flex-col bg-slate-50">
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-lg font-bold">Listening Test</h1>
              <p className="text-xs text-slate-500">{name}</p>
            </div>
            <Timer initialSeconds={secondsRemaining} onExpire={handleAutoSubmit} />
          </div>
          <div className="mx-auto flex max-w-7xl gap-2 px-4 pb-2">
            {parts.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => goToPart(i)}
                className={`rounded-full px-4 py-1 text-sm ${
                  i === activeIdx
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Part {p.part_number}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-bold">Part {part.part_number}</h2>
              {part.instructions && (
                <p className="mb-3 text-sm text-slate-600">{part.instructions}</p>
              )}
              {/* LockedAudio key bilan re-mount bo'lishi - har bir part uchun
                  alohida audio. Boshqa part audio'lari render qilinmaydi. */}
              {audioReady && (
                <LockedAudio key={`audio-${part.id}`} src={part.audio_url as string} />
              )}
              {!audioReady && part.audio_url && (
                <div className="mb-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Audio shu part ochilganda bir marta o&apos;ynaydi.
                </div>
              )}
              <div className="space-y-4">
                {part.questions.map((q, i) => (
                  <QuestionRenderer
                    key={q.id}
                    question={q}
                    index={i}
                    value={answers[String(q.id)]}
                    onChange={(v) =>
                      setAnswers((prev) => ({ ...prev, [String(q.id)]: v }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => goToPart(activeIdx - 1)}
                className="rounded-full bg-slate-200 px-6 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-40"
              >
                ← Oldingi part
              </button>

              {activeIdx < parts.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToPart(activeIdx + 1)}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Keyingi part →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="rounded-full bg-green-600 px-8 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Yuborilmoqda…' : 'Tugatish va yuborish'}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </FullscreenGate>
  )
}
