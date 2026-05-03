import { useEffect, useRef, useState } from 'react'

import { api } from '@/lib/api'

import { FullscreenGate } from './FullscreenGate'
import { QuestionRenderer, type Question } from './QuestionRenderer'
import { Timer } from './Timer'

interface Passage {
  id: number
  part_number: number
  title: string
  subtitle: string
  content: string
  instructions: string
  questions: Question[]
}

export function ReadingSection({
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
  const [passages, setPassages] = useState<Passage[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const submittedRef = useRef(false)

  useEffect(() => {
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => setPassages(r.data.passages || []))
      .finally(() => setLoading(false))
  }, [bsid])

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      await api.post(`/mock/submit/reading/${bsid}/`, { answers })
      onSubmit()
    } catch (err) {
      submittedRef.current = false
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Reading yuborishda xatolik. Internetni tekshiring va qayta urining.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Yuklanmoqda…</div>
  if (passages.length === 0) {
    return <div className="p-6 text-slate-500">Reading testda passage topilmadi.</div>
  }

  const passage = passages[activeIdx]

  return (
    <FullscreenGate title="Reading Test">
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Reading Test</h1>
            <p className="text-xs text-slate-500">{name}</p>
          </div>
          <Timer initialSeconds={secondsRemaining} onExpire={submit} />
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 px-4 pb-2">
          {passages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`rounded-full px-4 py-1 text-sm ${
                i === activeIdx
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Passage {p.part_number}
            </button>
          ))}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        {/* Passage left */}
        <div className="overflow-y-auto border-r bg-white p-6">
          <h2 className="mb-1 text-xl font-bold">{passage.title}</h2>
          {passage.subtitle && (
            <p className="mb-3 text-sm text-slate-600">{passage.subtitle}</p>
          )}
          <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
            {passage.content}
          </div>
        </div>

        {/* Questions right */}
        <div className="overflow-y-auto bg-slate-50 p-6">
          {passage.instructions && (
            <p className="mb-4 rounded bg-amber-50 p-3 text-sm font-medium text-amber-900">
              {passage.instructions}
            </p>
          )}
          <div className="space-y-4">
            {passage.questions.map((q, i) => (
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
      </div>

      <footer className="border-t bg-white p-3">
        <div className="mx-auto flex max-w-7xl justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="rounded-full bg-green-600 px-8 py-2 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Yuborilmoqda…' : 'Tugatish va yuborish'}
          </button>
        </div>
      </footer>
    </div>
    </FullscreenGate>
  )
}
