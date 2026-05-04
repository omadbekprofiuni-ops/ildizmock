import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

import TeacherLayout from '../TeacherLayout'

interface WritingTaskInfo {
  task_number: number
  prompt: string
  min_words: number
  chart_image_url: string | null
}

interface Detail {
  id: number
  full_name: string
  session: { id: number; name: string; date: string; status: string }
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
  overall_band_score: string | null
  writing_status: string
  writing_task1_text: string
  writing_task2_text: string
  writing_feedback: string
  writing_tasks: WritingTaskInfo[]
  criteria: Record<string, string | null>
}

const T1 = ['task_achievement', 'coherence', 'lexical', 'grammar'] as const
const T2 = ['task_response', 'coherence', 'lexical', 'grammar'] as const

const LABELS: Record<string, string> = {
  task_achievement: 'Task Achievement',
  task_response: 'Task Response',
  coherence: 'Coherence & Cohesion',
  lexical: 'Lexical Resource',
  grammar: 'Grammatical Range & Accuracy',
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export default function MockWritingGradePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 8 criteria scores
  const [scores, setScores] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (!id) return
    api
      .get<Detail>(`/teacher/mock/writing/${id}/`)
      .then((r) => {
        setDetail(r.data)
        const init: Record<string, string> = {}
        for (const k of Object.keys(r.data.criteria)) {
          init[k] = r.data.criteria[k] ?? ''
        }
        setScores(init)
        setFeedback(r.data.writing_feedback ?? '')
      })
      .catch(() => setError('Student not found or access denied.'))
  }, [id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await api.post<{ next_id: number | null }>(
        `/teacher/mock/writing/${id}/grade/`,
        { ...scores, feedback },
      )
      if (r.data.next_id) {
        navigate(`/teacher/mock/writing/${r.data.next_id}`, { replace: true })
      } else {
        navigate('/teacher/mock/writing', { replace: true })
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'Save failed')
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
        <div className="p-8 text-slate-500">Loading…</div>
      </TeacherLayout>
    )

  const task1 = detail.writing_tasks.find((t) => t.task_number === 1)
  const task2 = detail.writing_tasks.find((t) => t.task_number === 2)

  // Live computed averages
  const avg = (keys: string[]) => {
    const nums = keys
      .map((k) => parseFloat(scores[k] ?? ''))
      .filter((n) => !isNaN(n))
    if (!nums.length) return null
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)
  }
  const t1Avg = avg(T1.map((k) => `writing_task1_${k}`))
  const t2Avg = avg(T2.map((k) => `writing_task2_${k}`))
  let writingBand: string | null = null
  if (t1Avg && t2Avg) {
    writingBand = (parseFloat(t1Avg) * 0.33 + parseFloat(t2Avg) * 0.67).toFixed(1)
  }

  return (
    <TeacherLayout>
      <header className="border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-bold">{detail.full_name}</h1>
        <p className="text-sm text-slate-500">
          {detail.session.name} · {detail.session.date}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Stat label="Listening" value={detail.listening_score} />
          <Stat label="Reading" value={detail.reading_score} />
          <Stat label="Speaking" value={detail.speaking_score} />
          <Stat
            label="Calculated Writing band"
            value={writingBand}
            highlight
          />
        </div>
      </header>

      <form onSubmit={submit} className="space-y-6 p-8">
        {/* Task 1 */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">Task 1</h2>
          {task1 && (
            <div className="mb-4 rounded-lg bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-600">
                Topshiriq:
              </p>
              {task1.chart_image_url && (
                <img
                  src={task1.chart_image_url}
                  alt="Task 1 chart"
                  className="mb-3 max-h-64 rounded border"
                />
              )}
              <p className="whitespace-pre-wrap text-sm text-slate-800">
                {task1.prompt}
              </p>
            </div>
          )}
          <div className="mb-4 rounded-lg border bg-blue-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-blue-900">
              Student response ({wordCount(detail.writing_task1_text)} words):
            </p>
            <div className="whitespace-pre-wrap rounded bg-white p-3 text-sm">
              {detail.writing_task1_text || (
                <em className="text-slate-400">Bo'sh</em>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {T1.map((k) => {
              const field = `writing_task1_${k}`
              return (
                <ScoreField
                  key={field}
                  label={LABELS[k]}
                  value={scores[field] ?? ''}
                  onChange={(v) =>
                    setScores((prev) => ({ ...prev, [field]: v }))
                  }
                />
              )
            })}
          </div>
          {t1Avg && (
            <p className="mt-2 text-right text-sm text-slate-500">
              Task 1 o'rtacha: <strong>{t1Avg}</strong>
            </p>
          )}
        </section>

        {/* Task 2 */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">Task 2</h2>
          {task2 && (
            <div className="mb-4 rounded-lg bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-600">
                Topshiriq:
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-800">
                {task2.prompt}
              </p>
            </div>
          )}
          <div className="mb-4 rounded-lg border bg-blue-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-blue-900">
              Student response ({wordCount(detail.writing_task2_text)} words):
            </p>
            <div className="whitespace-pre-wrap rounded bg-white p-3 text-sm">
              {detail.writing_task2_text || (
                <em className="text-slate-400">Bo'sh</em>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {T2.map((k) => {
              const field = `writing_task2_${k}`
              return (
                <ScoreField
                  key={field}
                  label={LABELS[k]}
                  value={scores[field] ?? ''}
                  onChange={(v) =>
                    setScores((prev) => ({ ...prev, [field]: v }))
                  }
                />
              )
            })}
          </div>
          {t2Avg && (
            <p className="mt-2 text-right text-sm text-slate-500">
              Task 2 o'rtacha: <strong>{t2Avg}</strong>
            </p>
          )}
        </section>

        {/* Feedback */}
        <section className="rounded-2xl border bg-white p-6">
          <label className="mb-2 block text-sm font-medium">
            Note for student (optional)
          </label>
          <textarea
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Recommendations, points that need attention…"
            className="w-full rounded-lg border border-slate-300 px-4 py-2"
          />
        </section>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/teacher/mock/writing')}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Navbatga qaytish
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-emerald-600 px-8 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save grading'}
          </button>
        </div>
      </form>
    </TeacherLayout>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | null
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        highlight ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100'
      }`}
    >
      <span className="text-xs uppercase tracking-widest text-slate-600">
        {label}
      </span>
      <span className="ml-2 font-mono text-base font-bold">
        {value ?? '—'}
      </span>
    </div>
  )
}

function ScoreField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="number"
        step={0.5}
        min={0}
        max={9}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg"
      />
    </div>
  )
}
