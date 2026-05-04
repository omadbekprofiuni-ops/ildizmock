import { useEffect, useState } from 'react'

import { api } from '@/lib/api'

import { AudioUploadCard } from './AudioUploadCard'
import type {
  ListeningPart,
  WizardModule,
  WizardPassage,
  WizardTestDetail,
  WritingTask,
} from './types'

interface Props {
  testId: string
  module: WizardModule
  onUpdate?: () => void
}

export function Step3Content({ testId, module, onUpdate }: Props) {
  const [test, setTest] = useState<WizardTestDetail | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    const r = await api.get<WizardTestDetail>(`/super/tests/${testId}/`)
    setTest(r.data)
    onUpdate?.()
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  if (!test)
    return (
      <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">
        Loading…
      </div>
    )

  if (module === 'listening' || module === 'full_mock') {
    return (
      <ListeningContent
        test={test}
        activeIdx={activeIdx}
        setActiveIdx={setActiveIdx}
        saving={saving}
        setSaving={setSaving}
        reload={reload}
      />
    )
  }
  if (module === 'reading') {
    return (
      <ReadingContent
        test={test}
        activeIdx={activeIdx}
        setActiveIdx={setActiveIdx}
        saving={saving}
        setSaving={setSaving}
        reload={reload}
      />
    )
  }
  if (module === 'writing') {
    return (
      <WritingContent
        test={test}
        activeIdx={activeIdx}
        setActiveIdx={setActiveIdx}
        saving={saving}
        setSaving={setSaving}
        reload={reload}
      />
    )
  }
  return null
}

interface SubProps {
  test: WizardTestDetail
  activeIdx: number
  setActiveIdx: (n: number) => void
  saving: boolean
  setSaving: (b: boolean) => void
  reload: () => Promise<void>
}

function ListeningContent({
  test,
  activeIdx,
  setActiveIdx,
  saving,
  setSaving,
  reload,
}: SubProps) {
  const parts = test.listening_parts
  const [draft, setDraft] = useState<Partial<ListeningPart>>({})
  const partNum = activeIdx + 1
  const current = parts.find((p) => p.part_number === partNum)

  useEffect(() => {
    setDraft(current ?? { part_number: partNum, transcript: '', instructions: '' })
  }, [activeIdx, current, partNum])

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/super/tests/${test.id}/add-listening-part/`, {
        part_number: partNum,
        transcript: draft.transcript ?? '',
        instructions: draft.instructions ?? '',
      })
      await reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-8">
      <div className="mb-1 text-xs uppercase tracking-widest text-orange-600">
        Qadam 3
      </div>
      <h2 className="mb-6 text-2xl text-slate-900">Listening kontenti</h2>

      <div className="mb-5 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((n) => {
          const active = partNum === n
          const has = parts.some((p) => p.part_number === n)
          return (
            <button
              key={n}
              type="button"
              onClick={() => setActiveIdx(n - 1)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                active
                  ? 'bg-slate-900 text-white'
                  : has
                    ? 'border border-green-500 text-green-700'
                    : 'border border-slate-300 text-slate-500'
              }`}
            >
              Part {n} {has ? '✓' : ''}
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        <Field label="Section instructions">
          <textarea
            value={draft.instructions ?? ''}
            onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Transkript (audio matni)">
          <textarea
            value={draft.transcript ?? ''}
            onChange={(e) => setDraft({ ...draft, transcript: e.target.value })}
            rows={6}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm outline-none focus:border-slate-900"
          />
        </Field>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : current ? 'Yangilash' : 'Create part'}
        </button>

        {current && (
          <div className="pt-4">
            <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">
              Audio file
            </div>
            <AudioUploadCard
              partId={current.id}
              audioUrl={current.audio_url}
              durationSeconds={current.audio_duration_seconds}
              bitrateKbps={current.audio_bitrate_kbps}
              sizeBytes={current.audio_size_bytes}
              onUpload={() => reload()}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function ReadingContent({
  test,
  activeIdx,
  setActiveIdx,
  saving,
  setSaving,
  reload,
}: SubProps) {
  const passages = test.passages
  const sectionNum = activeIdx + 1
  const current = passages.find((p) => p.section_number === sectionNum)
  const [draft, setDraft] = useState<Partial<WizardPassage>>({})

  useEffect(() => {
    setDraft(
      current ?? {
        section_number: sectionNum,
        title: '',
        subtitle: '',
        body_text: '',
        instructions: '',
      },
    )
  }, [activeIdx, current, sectionNum])

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/super/tests/${test.id}/add-passage/`, {
        section_number: sectionNum,
        title: draft.title ?? '',
        subtitle: draft.subtitle ?? '',
        body_text: draft.body_text ?? '',
        instructions: draft.instructions ?? '',
      })
      await reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-8">
      <div className="mb-1 text-xs uppercase tracking-widest text-orange-600">
        Qadam 3
      </div>
      <h2 className="mb-6 text-2xl text-slate-900">Reading kontenti</h2>

      <div className="mb-5 flex flex-wrap gap-2">
        {[1, 2, 3].map((n) => {
          const active = sectionNum === n
          const has = passages.some((p) => p.section_number === n)
          return (
            <button
              key={n}
              type="button"
              onClick={() => setActiveIdx(n - 1)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                active
                  ? 'bg-slate-900 text-white'
                  : has
                    ? 'border border-green-500 text-green-700'
                    : 'border border-slate-300 text-slate-500'
              }`}
            >
              Section {n} {has ? '✓' : ''}
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        <Field label="Title *">
          <input
            value={draft.title ?? ''}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Subtitle (ixtiyoriy)">
          <input
            value={draft.subtitle ?? ''}
            onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Section instructions">
          <textarea
            value={draft.instructions ?? ''}
            onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Passage matni (paragraflar A, B, C bilan)">
          <textarea
            value={draft.body_text ?? ''}
            onChange={(e) => setDraft({ ...draft, body_text: e.target.value })}
            rows={12}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm outline-none focus:border-slate-900"
          />
        </Field>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : current ? 'Yangilash' : 'Create section'}
        </button>
      </div>
    </div>
  )
}

function WritingContent({
  test,
  activeIdx,
  setActiveIdx,
  saving,
  setSaving,
  reload,
}: SubProps) {
  const tasks = test.writing_tasks
  const taskNum = activeIdx + 1
  const current = tasks.find((t) => t.task_number === taskNum)
  const [draft, setDraft] = useState<Partial<WritingTask>>({})

  useEffect(() => {
    setDraft(
      current ?? {
        task_number: taskNum,
        prompt: '',
        min_words: taskNum === 1 ? 150 : 250,
        suggested_minutes: taskNum === 1 ? 20 : 40,
        requirements: '',
      },
    )
  }, [activeIdx, current, taskNum])

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/super/tests/${test.id}/add-writing-task/`, {
        task_number: taskNum,
        prompt: draft.prompt ?? '',
        min_words: draft.min_words ?? (taskNum === 1 ? 150 : 250),
        suggested_minutes: draft.suggested_minutes ?? (taskNum === 1 ? 20 : 40),
        requirements: draft.requirements ?? '',
      })
      await reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-8">
      <div className="mb-1 text-xs uppercase tracking-widest text-orange-600">
        Qadam 3
      </div>
      <h2 className="mb-6 text-2xl text-slate-900">Writing kontenti</h2>

      <div className="mb-5 flex flex-wrap gap-2">
        {[1, 2].map((n) => {
          const active = taskNum === n
          const has = tasks.some((t) => t.task_number === n)
          return (
            <button
              key={n}
              type="button"
              onClick={() => setActiveIdx(n - 1)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                active
                  ? 'bg-slate-900 text-white'
                  : has
                    ? 'border border-green-500 text-green-700'
                    : 'border border-slate-300 text-slate-500'
              }`}
            >
              Task {n} {has ? '✓' : ''}
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        <Field label="Task text *">
          <textarea
            value={draft.prompt ?? ''}
            onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimal so'zlar">
            <input
              type="number"
              value={draft.min_words ?? 0}
              onChange={(e) =>
                setDraft({ ...draft, min_words: parseInt(e.target.value, 10) || 0 })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Tavsiyaviy minut">
            <input
              type="number"
              value={draft.suggested_minutes ?? 0}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  suggested_minutes: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
            />
          </Field>
        </div>
        <Field label="Additional requirements (optional)">
          <textarea
            value={draft.requirements ?? ''}
            onChange={(e) => setDraft({ ...draft, requirements: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : current ? 'Yangilash' : 'Create task'}
        </button>

        {taskNum === 1 && current && (
          <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
            Chart image upload UI is in the next stage — API is ready:
            <br />
            <code className="text-slate-700">
              POST /super/writing-tasks/{current.id}/upload-chart/
            </code>
          </div>
        )}
      </div>
    </div>
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
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      {children}
    </div>
  )
}
