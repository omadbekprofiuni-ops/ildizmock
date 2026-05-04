import { useEffect, useMemo, useState } from 'react'

import { api } from '@/lib/api'

import { GapFillEditor } from './editors/GapFillEditor'
import { McqEditor } from './editors/McqEditor'
import { TfngEditor, YnngEditor } from './editors/TfngEditor'
import type {
  ListeningPart,
  WizardModule,
  WizardPassage,
  WizardQuestion,
  WizardTestDetail,
} from './types'

const QUESTION_TYPES: { id: string; label: string }[] = [
  { id: 'mcq', label: 'Multiple Choice' },
  { id: 'tfng', label: 'True / False / NG' },
  { id: 'ynng', label: 'Yes / No / NG' },
  { id: 'gap_fill', label: 'Gap Fill' },
  { id: 'matching', label: 'Matching' },
  { id: 'short_answer', label: 'Short Answer' },
  { id: 'form_completion', label: 'Form Completion' },
  { id: 'map_labeling', label: 'Map Labeling' },
  { id: 'summary_completion', label: 'Summary Completion' },
]

function emptyQuestion(type: string, number: number): WizardQuestion {
  return {
    question_number: number,
    question_type: type,
    prompt: '',
    options: {},
    correct_answer: {},
    alt_answers: [],
    points: 1,
  }
}

export function Step4Questions({
  testId,
  module,
}: {
  testId: string
  module: WizardModule
}) {
  const [test, setTest] = useState<WizardTestDetail | null>(null)
  const [activePartId, setActivePartId] = useState<number | null>(null)
  const [editing, setEditing] = useState<WizardQuestion | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    const r = await api.get<WizardTestDetail>(`/super/tests/${testId}/`)
    setTest(r.data)
    if (!activePartId) {
      const first =
        module === 'listening'
          ? r.data.listening_parts[0]?.id
          : module === 'reading'
            ? r.data.passages[0]?.id
            : null
      if (first) setActivePartId(first)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  const parts = useMemo(() => {
    if (!test) return [] as Array<ListeningPart | WizardPassage>
    if (module === 'listening' || module === 'full_mock')
      return test.listening_parts
    if (module === 'reading') return test.passages
    return []
  }, [test, module])

  const activePart = parts.find((p) => p.id === activePartId)
  const questions = activePart?.questions ?? []

  const saveQuestion = async () => {
    if (!editing || !activePartId) return
    setSaving(true)
    try {
      const url =
        module === 'listening' || module === 'full_mock'
          ? `/super/listening-parts/${activePartId}/add-question/`
          : `/super/passages/${activePartId}/add-question/`
      await api.post(url, editing)
      setEditing(null)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  if (!test)
    return (
      <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">
        Loading…
      </div>
    )

  if (module === 'writing') {
    return (
      <div className="rounded-2xl border bg-white p-8 text-sm text-slate-600">
        No questions for Writing tests. The student writes an essay and is graded manually
        baholanadi (ETAP 5 da). Keyingi qadamga o'ting.
      </div>
    )
  }

  if (parts.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-sm text-slate-600">
        Avval Qadam 3 da {module === 'listening' ? 'Listening Part' : 'Reading Section'}{' '}
        yarating.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-8">
      <div className="mb-1 text-xs uppercase tracking-widest text-orange-600">
        Qadam 4
      </div>
      <h2 className="mb-1 text-2xl text-slate-900">Savollar va javob kaliti</h2>
      <p className="mb-6 text-sm text-slate-500">
        Total: {questions.length} savol qo'shildi
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {parts.map((p) => {
          const num =
            'part_number' in p
              ? `Part ${p.part_number}`
              : `Section ${p.section_number}`
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePartId(p.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                activePartId === p.id
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-600'
              }`}
            >
              {num} ({p.questions.length})
            </button>
          )
        })}
      </div>

      <div className="mb-6">
        <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">
          New question type
        </div>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                setEditing(emptyQuestion(t.id, questions.length + 1))
              }
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs hover:border-slate-900"
            >
              + {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border bg-slate-50 p-4">
            <div className="mb-2 flex justify-between text-xs text-slate-500">
              <span>
                Savol #{q.question_number} · {q.question_type}
              </span>
              <span>{q.points} ball</span>
            </div>
            <div className="font-medium text-slate-900">{q.prompt}</div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">
              Savol #{editing.question_number} · {editing.question_type}
            </h3>

            <textarea
              placeholder="Savol matni…"
              value={editing.prompt}
              onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
              className="mb-4 w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-slate-900"
              rows={3}
            />

            {editing.question_type === 'mcq' && (
              <McqEditor q={editing} setQ={setEditing} />
            )}
            {editing.question_type === 'tfng' && (
              <TfngEditor q={editing} setQ={setEditing} />
            )}
            {editing.question_type === 'ynng' && (
              <YnngEditor q={editing} setQ={setEditing} />
            )}
            {(editing.question_type === 'gap_fill' ||
              editing.question_type === 'short_answer') && (
              <GapFillEditor q={editing} setQ={setEditing} />
            )}
            {[
              'matching',
              'form_completion',
              'map_labeling',
              'summary_completion',
            ].includes(editing.question_type) && (
              <div className="rounded-lg border-2 border-dashed border-slate-300 p-4 text-sm text-slate-500">
                A dedicated editor for this question type will be added in the next stage.
                Hozircha JSON sifatida `correct_answer` qo'lda kiriting.
                <textarea
                  placeholder='{"pairs": {"a": "1"}}'
                  value={JSON.stringify(editing.correct_answer)}
                  onChange={(e) => {
                    try {
                      setEditing({
                        ...editing,
                        correct_answer: JSON.parse(e.target.value || '{}'),
                      })
                    } catch {
                      // ignore parse errors
                    }
                  }}
                  className="mt-2 w-full rounded border p-2 font-mono text-xs"
                  rows={3}
                />
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 rounded-full border border-slate-300 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveQuestion}
                disabled={saving || !editing.prompt}
                className="flex-1 rounded-full bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
