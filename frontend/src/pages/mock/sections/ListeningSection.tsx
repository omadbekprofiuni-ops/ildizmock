import { useEffect, useRef, useState } from 'react'

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
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
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

  if (loading) return <div className="p-6 text-slate-500">Yuklanmoqda…</div>

  return (
    <FullscreenGate title="Listening Test">
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Listening Test</h1>
            <p className="text-xs text-slate-500">{name}</p>
          </div>
          <Timer
            initialSeconds={secondsRemaining}
            onExpire={handleAutoSubmit}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {parts.map((part) => (
          <section
            key={part.id}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <h2 className="mb-3 text-xl font-bold">Part {part.part_number}</h2>
            {part.instructions && (
              <p className="mb-3 text-sm text-slate-600">{part.instructions}</p>
            )}
            {part.audio_url && (
              <audio controls className="mb-4 w-full">
                <source src={part.audio_url} />
              </audio>
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
          </section>
        ))}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="rounded-full bg-green-600 px-8 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Yuborilmoqda…' : 'Tugatish va yuborish'}
          </button>
        </div>
      </main>
    </div>
    </FullscreenGate>
  )
}
