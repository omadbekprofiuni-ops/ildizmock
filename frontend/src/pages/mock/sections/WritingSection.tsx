import { useEffect, useRef, useState } from 'react'

import { api } from '@/lib/api'

import { FullscreenGate } from './FullscreenGate'
import { Timer } from './Timer'

interface WritingTask {
  id: number
  task_number: number
  prompt: string
  chart_image_url: string | null
  min_words: number
  suggested_minutes: number
  requirements: string
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export function WritingSection({
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
  const [tasks, setTasks] = useState<WritingTask[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [task1, setTask1] = useState('')
  const [task2, setTask2] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const submittedRef = useRef(false)

  useEffect(() => {
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => setTasks(r.data.writing_tasks || []))
      .finally(() => setLoading(false))
  }, [bsid])

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      await api.post(`/mock/submit/writing/${bsid}/`, {
        task1,
        task2,
      })
      onSubmit()
    } catch (err) {
      submittedRef.current = false
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Error submitting Writing. Check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Loading…</div>
  if (tasks.length === 0) {
    return <div className="p-6 text-slate-500">No tasks found in the Writing test.</div>
  }

  const tasksByNumber = [...tasks].sort((a, b) => a.task_number - b.task_number)
  const active = tasksByNumber[activeIdx]
  const text = active.task_number === 1 ? task1 : task2
  const setText = active.task_number === 1 ? setTask1 : setTask2
  const wc = wordCount(text)
  const enough = wc >= active.min_words

  return (
    <FullscreenGate title="Writing Test">
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Writing Test</h1>
            <p className="text-xs text-slate-500">{name}</p>
          </div>
          <Timer initialSeconds={secondsRemaining} onExpire={submit} />
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 px-4 pb-2">
          {tasksByNumber.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`rounded-full px-4 py-1 text-sm ${
                i === activeIdx
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Task {t.task_number}
            </button>
          ))}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        {/* Prompt left */}
        <div className="overflow-y-auto border-r bg-white p-6">
          <h2 className="mb-1 text-xl font-bold">Task {active.task_number}</h2>
          <p className="mb-3 text-sm text-slate-500">
            Suggested: {active.suggested_minutes} min · Min: {active.min_words} words
          </p>
          {active.chart_image_url && (
            <img
              src={active.chart_image_url}
              alt="Task chart"
              className="mb-4 max-w-full rounded-lg border"
            />
          )}
          <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
            {active.prompt}
          </div>
          {active.requirements && (
            <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
              {active.requirements}
            </p>
          )}
        </div>

        {/* Editor right */}
        <div className="flex flex-col bg-slate-50 p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type here…"
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white p-4 text-base leading-relaxed focus:border-slate-900 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span
              className={
                enough ? 'font-semibold text-green-700' : 'text-slate-600'
              }
            >
              {wc} / {active.min_words} words
            </span>
            <span className="text-slate-400">Auto-save (not in browser memory)</span>
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
            {submitting ? 'Submitting…' : 'Submit both tasks'}
          </button>
        </div>
      </footer>
    </div>
    </FullscreenGate>
  )
}
