import { ArrowLeft, BookOpen, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  PageHeader,
  PageShell,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { useConfirm } from '@/components/ConfirmDialog'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type QType = 'mcq' | 'tfng' | 'fill' | 'short_answer'

type GeneratedQuestion = {
  order: number
  question_type: QType
  text: string
  options: string[] | null
  correct_answer: string
  instruction: string
  points: number
}

type Passage = {
  title: string
  content: string
  questions: GeneratedQuestion[]
  generating: boolean
}

const blankPassage = (): Passage => ({
  title: '',
  content: '',
  questions: [],
  generating: false,
})

const QUESTION_TYPE_LABEL: Record<QType, string> = {
  mcq: 'Multiple Choice',
  tfng: 'True / False / Not Given',
  fill: 'Fill in the Blank',
  short_answer: 'Short Answer',
}

export default function AITestCreatePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'expert'
  >('intermediate')
  const [duration, setDuration] = useState(60)
  const [questionsPerPassage, setQuestionsPerPassage] = useState(13)
  const [passages, setPassages] = useState<Passage[]>([blankPassage()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = 'ILDIZmock — AI Test Generation'
  }, [])

  const updatePassage = (idx: number, patch: Partial<Passage>) => {
    setPassages((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    )
  }

  const addPassage = () => {
    if (passages.length >= 3) {
      toast.info('IELTS Reading is 3 passages — that is the limit.')
      return
    }
    setPassages((prev) => [...prev, blankPassage()])
  }

  const removePassage = async (idx: number) => {
    const ok = await confirm({
      title: 'Remove this passage?',
      description: 'Generated questions for this passage will be lost.',
      confirmText: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setPassages((prev) => prev.filter((_, i) => i !== idx))
  }

  const generateForPassage = async (idx: number) => {
    const p = passages[idx]
    if (!p.content.trim() || p.content.trim().length < 200) {
      toast.error('Paste a longer passage (≥ 200 characters) before generating.')
      return
    }
    updatePassage(idx, { generating: true })
    try {
      const res = await api.post<{ questions: GeneratedQuestion[] }>(
        `/center/${slug}/tests/ai-generate-questions/`,
        {
          module: 'reading',
          passage_text: p.content,
          count: questionsPerPassage,
          difficulty,
        },
      )
      updatePassage(idx, { questions: res.data.questions })
      toast.success(`Generated ${res.data.questions.length} questions.`)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(detail ?? 'AI generation failed. Try again.')
    } finally {
      updatePassage(idx, { generating: false })
    }
  }

  const updateQuestion = (
    pIdx: number,
    qIdx: number,
    patch: Partial<GeneratedQuestion>,
  ) => {
    setPassages((prev) =>
      prev.map((p, i) => {
        if (i !== pIdx) return p
        return {
          ...p,
          questions: p.questions.map((q, qi) =>
            qi === qIdx ? { ...q, ...patch } : q,
          ),
        }
      }),
    )
  }

  const removeQuestion = (pIdx: number, qIdx: number) => {
    setPassages((prev) =>
      prev.map((p, i) => {
        if (i !== pIdx) return p
        return {
          ...p,
          questions: p.questions
            .filter((_, qi) => qi !== qIdx)
            .map((q, qi) => ({ ...q, order: qi + 1 })),
        }
      }),
    )
  }

  const totalQuestions = passages.reduce((s, p) => s + p.questions.length, 0)

  const onSave = async () => {
    if (!name.trim()) {
      toast.error('Enter a test name.')
      return
    }
    if (totalQuestions === 0) {
      toast.error('No questions yet — generate or add some first.')
      return
    }
    for (const p of passages) {
      if (!p.title.trim() || !p.content.trim()) {
        toast.error('Each passage needs a title and content.')
        return
      }
      for (const q of p.questions) {
        if (!q.text.trim() || !q.correct_answer.trim()) {
          toast.error('Every question needs text and a correct answer.')
          return
        }
      }
    }

    setSaving(true)
    try {
      await api.post(`/center/${slug}/tests/easy-create/`, {
        name,
        module: 'reading',
        test_type: 'academic',
        difficulty,
        duration_minutes: duration,
        is_published: true,
        passages: passages.map((p, i) => ({
          part_number: i + 1,
          title: p.title,
          content: p.content,
          instructions: '',
          questions: p.questions,
        })),
      })
      toast.success('Test created successfully')
      navigate(`/${slug}/admin/tests`)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(detail ?? 'Failed to create test')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell maxWidth="max-w-5xl">
      <Link
        to={`/${slug}/admin/tests`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Tests
      </Link>

      <PageHeader
        title="AI-Assisted Reading Test"
        subtitle="Paste a passage and Claude will draft IELTS-style questions. Review and edit before saving."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate(`/${slug}/admin/tests`)}
              className={btnOutline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={btnPrimary + ' disabled:opacity-50'}
            >
              {saving ? 'Saving…' : `Save (${totalQuestions} questions)`}
            </button>
          </>
        }
      />

      {/* Top metadata */}
      <SurfaceCard className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Test name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cambridge 19 — Reading Test 1"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </Field>
          <Field label="Difficulty">
            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as typeof difficulty)
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="beginner">Beginner (4.5 – 5.5)</option>
              <option value="intermediate">Intermediate (5.5 – 6.5)</option>
              <option value="advanced">Advanced (6.5 – 7.5)</option>
              <option value="expert">Expert (7.5+)</option>
            </select>
          </Field>
          <Field label="Duration (minutes)">
            <input
              type="number"
              min={5}
              max={180}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 60)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </Field>
          <Field label="Questions per passage (AI generates this many)">
            <input
              type="number"
              min={3}
              max={20}
              value={questionsPerPassage}
              onChange={(e) =>
                setQuestionsPerPassage(Number(e.target.value) || 13)
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </Field>
        </div>
      </SurfaceCard>

      {/* Passages */}
      <div className="space-y-4">
        {passages.map((p, idx) => (
          <SurfaceCard key={idx}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <BookOpen size={18} className="text-brand-600" />
                Passage {idx + 1}
              </h2>
              {passages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePassage(idx)}
                  className="inline-flex items-center gap-1 rounded-lg border border-cta-100 px-2 py-1 text-xs text-cta-600 hover:bg-cta-50"
                >
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4">
              <Field label="Passage title">
                <input
                  value={p.title}
                  onChange={(e) =>
                    updatePassage(idx, { title: e.target.value })
                  }
                  placeholder="e.g. The Origins of Coffee"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
              <Field
                label={`Passage content (${p.content.length} chars — paste 500–1500 words for best results)`}
              >
                <textarea
                  value={p.content}
                  onChange={(e) =>
                    updatePassage(idx, { content: e.target.value })
                  }
                  rows={10}
                  placeholder="Paste the full passage text here…"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => generateForPassage(idx)}
              disabled={p.generating || p.content.trim().length < 200}
              className={
                btnPrimary +
                ' disabled:cursor-not-allowed disabled:opacity-50'
              }
            >
              {p.generating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {p.questions.length > 0 ? 'Regenerate questions' : 'Generate questions'}
                </>
              )}
            </button>

            {p.questions.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Generated questions ({p.questions.length})
                </h3>
                {p.questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Q{q.order}
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                          {QUESTION_TYPE_LABEL[q.question_type]}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(idx, qIdx)}
                        className="text-cta-500 hover:text-cta-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <textarea
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(idx, qIdx, { text: e.target.value })
                      }
                      rows={2}
                      className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />

                    {q.question_type === 'mcq' && q.options && (
                      <div className="mb-3 space-y-2">
                        {q.options.map((opt, oIdx) => (
                          <input
                            key={oIdx}
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...(q.options ?? [])]
                              newOpts[oIdx] = e.target.value
                              updateQuestion(idx, qIdx, { options: newOpts })
                            }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        ))}
                      </div>
                    )}

                    <Field label="Correct answer">
                      {q.question_type === 'tfng' ? (
                        <select
                          value={q.correct_answer}
                          onChange={(e) =>
                            updateQuestion(idx, qIdx, {
                              correct_answer: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="TRUE">TRUE</option>
                          <option value="FALSE">FALSE</option>
                          <option value="NOT GIVEN">NOT GIVEN</option>
                        </select>
                      ) : (
                        <input
                          value={q.correct_answer}
                          onChange={(e) =>
                            updateQuestion(idx, qIdx, {
                              correct_answer: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      )}
                    </Field>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        ))}

        {passages.length < 3 && (
          <button
            type="button"
            onClick={addPassage}
            className={btnOutline + ' w-full justify-center'}
          >
            + Add passage ({passages.length} / 3)
          </button>
        )}
      </div>
    </PageShell>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}
