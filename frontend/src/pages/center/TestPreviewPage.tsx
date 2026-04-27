import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

interface Question {
  id: number
  question_number: number
  question_type: string
  prompt: string
  options: string[]
  correct_answer: unknown
  alt_answers: string[]
  points: number
  image_url: string | null
}

interface ListeningPart {
  id: number
  part_number: number
  audio_url: string | null
  audio_duration_seconds: number
  image_url: string | null
  transcript: string
  instructions: string
  questions: Question[]
}

interface Passage {
  id: number
  section_number: number
  title: string
  subtitle: string
  body_text: string
  instructions: string
  image_url: string | null
  questions: Question[]
}

interface WritingTask {
  id: number
  task_number: number
  prompt: string
  chart_image_url: string | null
  min_words: number
  suggested_minutes: number
  requirements: string
}

interface TestDetail {
  id: string
  name: string
  module: string
  difficulty: string
  description: string
  duration_minutes: number
  status: string
  category: string
  listening_parts: ListeningPart[]
  passages: Passage[]
  writing_tasks: WritingTask[]
  questions_count: number
}

const formatAnswer = (a: unknown): string => {
  if (a == null) return '—'
  if (typeof a === 'string' || typeof a === 'number') return String(a)
  if (Array.isArray(a)) return a.map(formatAnswer).join(', ')
  return JSON.stringify(a)
}

export default function TestPreviewPage() {
  const { slug, testId } = useParams<{ slug: string; testId: string }>()
  const [test, setTest] = useState<TestDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug || !testId) return
    api
      .get<TestDetail>(`/center/${slug}/tests/${testId}/preview/`)
      .then((r) => setTest(r.data))
      .catch(() => setError('Test topilmadi yoki sizga ruxsat yo‘q.'))
  }, [slug, testId])

  if (error)
    return <div className="p-8 text-red-600">{error}</div>
  if (!test)
    return <div className="p-8 text-slate-500">Yuklanmoqda…</div>

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-amber-100 px-4 py-3 text-center text-sm text-amber-900">
        📋 PREVIEW MODE — bu admin uchun ko'rinish, javoblar yashil rangda ko'rinadi
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <Link
            to={`/${slug}/admin/tests`}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Testlar
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-widest">
            {test.module} · {test.difficulty}
          </span>
        </div>

        <header>
          <h1 className="text-3xl font-bold text-slate-900">{test.name}</h1>
          {test.category && (
            <p className="mt-1 text-slate-500">{test.category}</p>
          )}
          <p className="mt-2 text-sm text-slate-600">
            Davomiyligi: {test.duration_minutes} daqiqa · Savollar:{' '}
            {test.questions_count}
          </p>
          {test.description && (
            <p className="mt-3 whitespace-pre-wrap text-slate-700">
              {test.description}
            </p>
          )}
        </header>

        {test.listening_parts.map((p) => (
          <section
            key={p.id}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <h2 className="mb-2 text-2xl font-bold">Part {p.part_number}</h2>
            {p.instructions && (
              <p className="mb-3 rounded bg-blue-50 p-3 text-sm text-blue-900">
                {p.instructions}
              </p>
            )}
            {p.audio_url && (
              <audio controls className="mb-4 w-full">
                <source src={p.audio_url} />
              </audio>
            )}
            {p.image_url && (
              <img
                src={p.image_url}
                alt="Section"
                className="mb-4 max-h-96 rounded border"
              />
            )}
            {p.transcript && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-slate-600">
                  Transcript ko‘rish
                </summary>
                <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">
                  {p.transcript}
                </p>
              </details>
            )}
            <QuestionList questions={p.questions} />
          </section>
        ))}

        {test.passages.map((p) => (
          <section
            key={p.id}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <h2 className="mb-1 text-2xl font-bold">{p.title}</h2>
            {p.subtitle && (
              <p className="mb-3 text-sm text-slate-500">{p.subtitle}</p>
            )}
            {p.image_url && (
              <img
                src={p.image_url}
                alt="Passage"
                className="mb-4 max-h-96 rounded border"
              />
            )}
            <div className="mb-6 whitespace-pre-wrap rounded bg-slate-50 p-4 text-base leading-relaxed text-slate-800">
              {p.body_text}
            </div>
            {p.instructions && (
              <p className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
                {p.instructions}
              </p>
            )}
            <QuestionList questions={p.questions} />
          </section>
        ))}

        {test.writing_tasks.map((t) => (
          <section
            key={t.id}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <h2 className="mb-2 text-2xl font-bold">Task {t.task_number}</h2>
            <p className="mb-3 text-sm text-slate-500">
              Tavsiya: {t.suggested_minutes} daqiqa · Min: {t.min_words} so'z
            </p>
            {t.chart_image_url && (
              <img
                src={t.chart_image_url}
                alt="Task chart"
                className="mb-4 max-h-96 rounded border"
              />
            )}
            <p className="whitespace-pre-wrap text-slate-800">{t.prompt}</p>
            {t.requirements && (
              <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
                {t.requirements}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

function QuestionList({ questions }: { questions: Question[] }) {
  if (!questions.length) {
    return (
      <p className="italic text-slate-400">Hali savol qo'shilmagan</p>
    )
  }
  return (
    <ol className="space-y-4">
      {questions.map((q, i) => (
        <li key={q.id} className="rounded-lg border border-slate-200 p-4">
          <div className="mb-2 flex items-start gap-3">
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold">
              {q.question_number || i + 1}
            </span>
            <p className="flex-1 font-medium text-slate-900">{q.prompt}</p>
            <span className="text-xs uppercase tracking-widest text-slate-500">
              {q.question_type}
            </span>
          </div>

          {q.image_url && (
            <img
              src={q.image_url}
              alt="Question"
              className="mb-3 max-h-72 rounded border"
            />
          )}

          {q.options && q.options.length > 0 && (
            <ul className="ml-8 list-disc space-y-1 text-sm text-slate-700">
              {q.options.map((opt, oi) => (
                <li key={oi}>{opt}</li>
              ))}
            </ul>
          )}

          <p className="mt-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
            ✓ To'g'ri javob: <strong>{formatAnswer(q.correct_answer)}</strong>
            {q.alt_answers && q.alt_answers.length > 0 && (
              <span className="ml-2 text-xs text-green-600">
                (muqobil: {q.alt_answers.join(', ')})
              </span>
            )}
          </p>
        </li>
      ))}
    </ol>
  )
}
