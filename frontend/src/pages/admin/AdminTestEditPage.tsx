import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import AdminLayout from './AdminLayout'

type LayoutComponent = ComponentType<{ children: ReactNode }>

type Props = {
  Layout?: LayoutComponent
  basePath?: string
}

type QType = 'mcq' | 'tfng' | 'fill' | 'matching'

type QDraft = {
  order: number
  question_type: QType
  text: string
  options: string[]
  correct_answer: string
  acceptable_answers: string[]
  group_id: number
  instruction: string
  points: number
}

type PDraft = {
  part_number: number
  title: string
  content: string
  order: number
  questions: QDraft[]
  min_words?: number | null
  audio_file_path?: string | null
  audio_file?: string | null  // read-only preview URL
}

type TestDraft = {
  name: string
  module: 'reading' | 'listening' | 'writing' | 'speaking'
  test_type: 'academic' | 'general'
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  duration_minutes: number
  description: string
  is_published: boolean
  access_level: 'free' | 'standard' | 'premium'
  passages: PDraft[]
}

const blankQuestion = (order: number): QDraft => ({
  order,
  question_type: 'mcq',
  text: '',
  options: ['', '', '', ''],
  correct_answer: '',
  acceptable_answers: [],
  group_id: 1,
  instruction: '',
  points: 1,
})

const blankPassage = (partNumber: number): PDraft => ({
  part_number: partNumber,
  title: '',
  content: '',
  order: partNumber,
  questions: [blankQuestion(1)],
  min_words: null,
  audio_file_path: null,
  audio_file: null,
})

const blankTest = (): TestDraft => ({
  name: '',
  module: 'reading',
  test_type: 'academic',
  difficulty: 'intermediate',
  duration_minutes: 60,
  description: '',
  is_published: false,
  access_level: 'free',
  passages: [blankPassage(1)],
})

function deriveAudioPath(value: string | null | undefined): string | null {
  if (!value) return null
  let s = String(value).trim()
  // http(s)://host/path → /path
  const proto = s.indexOf('://')
  if (proto !== -1) {
    const after = s.slice(proto + 3)
    const slash = after.indexOf('/')
    s = slash === -1 ? '' : after.slice(slash)
  }
  // Strip /media/ or media/
  s = s.replace(/^\/?media\//, '')
  return s || null
}

function normaliseOnChangeType(q: QDraft, newType: QType): QDraft {
  if (newType === 'mcq') return { ...q, question_type: 'mcq', options: ['', '', '', ''], correct_answer: '' }
  if (newType === 'tfng') return { ...q, question_type: 'tfng', options: ['True', 'False', 'Not Given'], correct_answer: '' }
  if (newType === 'fill') return { ...q, question_type: 'fill', options: [], correct_answer: '' }
  return { ...q, question_type: 'matching', options: q.options.length ? q.options : ['', ''], correct_answer: '' }
}

function draftFromServer(data: {
  name: string
  module: TestDraft['module']
  test_type: TestDraft['test_type']
  difficulty: TestDraft['difficulty']
  duration_minutes: number
  description: string
  is_published: boolean
  access_level: TestDraft['access_level']
  passages: Array<{
    part_number: number
    title: string
    content: string
    order: number
    questions: Array<QDraft>
  }>
}): TestDraft {
  return {
    name: data.name,
    module: data.module,
    test_type: data.test_type,
    difficulty: data.difficulty,
    duration_minutes: data.duration_minutes,
    description: data.description,
    is_published: data.is_published,
    access_level: data.access_level,
    passages: data.passages.map((p) => ({
      part_number: p.part_number,
      title: p.title,
      content: p.content,
      order: p.order,
      min_words: (p as { min_words?: number | null }).min_words ?? null,
      audio_file: (p as { audio_file?: string | null }).audio_file ?? null,
      // Backend now exposes audio_file_path (relative storage path) explicitly.
      // Fall back to deriving it from audio_file URL only if missing.
      audio_file_path:
        (p as { audio_file_path?: string | null }).audio_file_path
        ?? deriveAudioPath(
          (p as { audio_file?: string | null }).audio_file ?? null,
        ),
      questions: p.questions.map((q, i) => ({
        order: q.order ?? i + 1,
        question_type: q.question_type,
        text: q.text,
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer:
          typeof q.correct_answer === 'string'
            ? q.correct_answer
            : JSON.stringify(q.correct_answer ?? ''),
        acceptable_answers: Array.isArray(q.acceptable_answers) ? q.acceptable_answers : [],
        group_id: q.group_id ?? 0,
        instruction: q.instruction ?? '',
        points: q.points ?? 1,
      })),
    })),
  }
}

export default function AdminTestEditPage({
  Layout = AdminLayout,
  basePath = '/admin/tests',
}: Props = {}) {
  const { testId } = useParams<{ testId?: string }>()
  const isNew = !testId || testId === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [draft, setDraft] = useState<TestDraft>(blankTest)

  const query = useQuery({
    queryKey: ['admin-test', testId],
    queryFn: async () =>
      (await api.get(`/admin/tests/${testId}/`)).data as Parameters<typeof draftFromServer>[0],
    enabled: !isNew,
  })

  useEffect(() => {
    if (!isNew && query.data) setDraft(draftFromServer(query.data))
  }, [isNew, query.data])

  const saveMutation = useMutation({
    mutationFn: async (payload: TestDraft) => {
      const { passages: _ignored, ...body } = payload
      void _ignored
      const withInput = { ...body, passages_input: payload.passages }
      if (isNew) return (await api.post('/admin/tests/', withInput)).data
      return (await api.patch(`/admin/tests/${testId}/`, withInput)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tests'] })
      toast.success(isNew ? 'Test created' : 'Changes saved')
      navigate(basePath)
    },
    onError: (err) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      toast.error('Failed to save: ' + JSON.stringify(data).slice(0, 200))
    },
  })

  if (!isNew && query.isLoading) {
    return (
      <Layout>
        <div className="p-8 text-muted-foreground">Loading…</div>
      </Layout>
    )
  }
  if (!isNew && query.isError) {
    return <Navigate to={basePath} replace />
  }

  const updatePassage = (pi: number, patch: Partial<PDraft>) => {
    setDraft((d) => ({
      ...d,
      passages: d.passages.map((p, i) => (i === pi ? { ...p, ...patch } : p)),
    }))
  }

  const addPassage = () => {
    setDraft((d) => ({
      ...d,
      passages: [...d.passages, blankPassage(d.passages.length + 1)],
    }))
  }

  const removePassage = (pi: number) => {
    setDraft((d) => ({
      ...d,
      passages: d.passages
        .filter((_, i) => i !== pi)
        .map((p, i) => ({ ...p, part_number: i + 1, order: i + 1 })),
    }))
  }

  const updateQuestion = (pi: number, qi: number, patch: Partial<QDraft>) => {
    setDraft((d) => ({
      ...d,
      passages: d.passages.map((p, i) =>
        i !== pi
          ? p
          : {
              ...p,
              questions: p.questions.map((q, j) =>
                j === qi ? { ...q, ...patch } : q,
              ),
            },
      ),
    }))
  }

  const addQuestion = (pi: number) => {
    setDraft((d) => ({
      ...d,
      passages: d.passages.map((p, i) =>
        i !== pi
          ? p
          : { ...p, questions: [...p.questions, blankQuestion(p.questions.length + 1)] },
      ),
    }))
  }

  const removeQuestion = (pi: number, qi: number) => {
    setDraft((d) => ({
      ...d,
      passages: d.passages.map((p, i) =>
        i !== pi
          ? p
          : {
              ...p,
              questions: p.questions
                .filter((_, j) => j !== qi)
                .map((q, j) => ({ ...q, order: j + 1 })),
            },
      ),
    }))
  }

  const changeQuestionType = (pi: number, qi: number, newType: QType) => {
    setDraft((d) => ({
      ...d,
      passages: d.passages.map((p, i) =>
        i !== pi
          ? p
          : {
              ...p,
              questions: p.questions.map((q, j) =>
                j === qi ? normaliseOnChangeType(q, newType) : q,
              ),
            },
      ),
    }))
  }

  const updateMCQOption = (pi: number, qi: number, oi: number, val: string) => {
    setDraft((d) => ({
      ...d,
      passages: d.passages.map((p, i) =>
        i !== pi
          ? p
          : {
              ...p,
              questions: p.questions.map((q, j) =>
                j !== qi
                  ? q
                  : {
                      ...q,
                      options: q.options.map((o, k) => (k === oi ? val : o)),
                    },
              ),
            },
      ),
    }))
  }

  const onSave = () => {
    if (!draft.name.trim()) return toast.error('Enter a test name')
    for (const p of draft.passages) {
      if (!p.title.trim() || !p.content.trim())
        return toast.error('Fill in passage name and text')
      // Writing: no questions required; min_words required
      if (draft.module === 'writing') continue
      for (const q of p.questions) {
        if (!q.text.trim()) return toast.error('Fill in the question text')
        if (!q.correct_answer.trim())
          return toast.error('Mark the correct answer for each question')
      }
    }
    // Strip questions from writing passages before send
    const payload: TestDraft = {
      ...draft,
      passages: draft.passages.map((p) =>
        draft.module === 'writing' ? { ...p, questions: [] } : p,
      ),
    }
    saveMutation.mutate(payload)
  }

  const moduleAccents: Record<TestDraft['module'], { ring: string; tint: string; text: string; chip: string }> = {
    listening: { ring: 'border-indigo-100', tint: 'bg-indigo-50', text: 'text-indigo-700', chip: 'bg-indigo-100 text-indigo-700' },
    reading:   { ring: 'border-emerald-100', tint: 'bg-emerald-50', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700' },
    writing:   { ring: 'border-orange-100', tint: 'bg-orange-50', text: 'text-orange-700', chip: 'bg-orange-100 text-orange-700' },
    speaking:  { ring: 'border-purple-100', tint: 'bg-purple-50', text: 'text-purple-700', chip: 'bg-purple-100 text-purple-700' },
  }
  const accent = moduleAccents[draft.module]

  return (
    <Layout>
      <div className="mx-auto max-w-5xl p-6 lg:p-10">
        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
          <Link to={basePath} className="hover:text-indigo-600">Testlar</Link>
          <span>/</span>
          <span className="text-slate-900">{isNew ? 'Yangi' : 'Tahrirlash'}</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isNew ? 'Yangi test' : draft.name || 'Test tahriri'}
            </h1>
            <p className="mt-1 text-slate-500">
              {draft.module === 'listening' && 'IELTS Listening — qism va savollarni qo‘shing'}
              {draft.module === 'reading'   && 'IELTS Reading — passage va savollarni qo‘shing'}
              {draft.module === 'writing'   && 'IELTS Writing — Task 1 va Task 2 sharti'}
              {draft.module === 'speaking'  && 'IELTS Speaking — savollarni tayyorlang'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={basePath}>
              <Button variant="outline" className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" /> Orqaga
              </Button>
            </Link>
            <Button
              onClick={onSave}
              disabled={saveMutation.isPending}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              {saveMutation.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>
          </div>
        </div>

        {/* Module hint chip */}
        <div className="mb-6 inline-flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${accent.chip}`}>
            {draft.module}
          </span>
          <span className="text-xs text-slate-500">{draft.duration_minutes} daqiqa</span>
        </div>

      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Basic info</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Test name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="The Concept of Intelligence"
                />
              </div>
              <div className="space-y-2">
                <Label>Module</Label>
                <select
                  value={draft.module}
                  onChange={(e) =>
                    setDraft({ ...draft, module: e.target.value as TestDraft['module'] })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="reading">Reading</option>
                  <option value="listening">Listening</option>
                  <option value="writing">Writing</option>
                  <option value="speaking">Speaking</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <select
                  value={draft.difficulty}
                  onChange={(e) =>
                    setDraft({ ...draft, difficulty: e.target.value as TestDraft['difficulty'] })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="beginner">Beginner (4.5–5.5)</option>
                  <option value="intermediate">Intermediate (5.5–6.5)</option>
                  <option value="advanced">Advanced (6.5–7.5)</option>
                  <option value="expert">Expert (7.5+)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.duration_minutes}
                  onChange={(e) =>
                    setDraft({ ...draft, duration_minutes: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Academic Reading — Passage 1"
                />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <input
                  id="is_published"
                  type="checkbox"
                  checked={draft.is_published}
                  onChange={(e) =>
                    setDraft({ ...draft, is_published: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="is_published">Published (visible to users)</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {draft.passages.map((p, pi) => (
          <Card key={pi}>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Part {p.part_number}</h2>
                {draft.passages.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePassage(pi)}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Delete passage
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label>Passage name</Label>
                <Input
                  value={p.title}
                  onChange={(e) => updatePassage(pi, { title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {draft.module === 'writing' ? 'Task prompt' : 'Passage text / transcript'}
                </Label>
                <textarea
                  value={p.content}
                  onChange={(e) => updatePassage(pi, { content: e.target.value })}
                  rows={draft.module === 'writing' ? 6 : 8}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm"
                />
              </div>

              {draft.module === 'writing' && (
                <div className="space-y-2">
                  <Label>Minimum word count</Label>
                  <Input
                    type="number"
                    min={50}
                    value={p.min_words ?? 150}
                    onChange={(e) =>
                      updatePassage(pi, { min_words: Number(e.target.value) || 150 })
                    }
                    className="w-32"
                  />
                </div>
              )}

              {draft.module === 'listening' && (
                <AudioUploadField
                  currentUrl={p.audio_file ?? null}
                  currentPath={p.audio_file_path ?? null}
                  onUploaded={(path, url) =>
                    updatePassage(pi, { audio_file_path: path, audio_file: url })
                  }
                  onClear={() =>
                    updatePassage(pi, { audio_file_path: null, audio_file: null })
                  }
                />
              )}

              {draft.module === 'writing' ? null : (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Questions ({p.questions.length})
                </h3>
                {p.questions.map((q, qi) => (
                  <QuestionBuilder
                    key={qi}
                    q={q}
                    qi={qi}
                    onChangeType={(t) => changeQuestionType(pi, qi, t)}
                    onText={(v) => updateQuestion(pi, qi, { text: v })}
                    onPoints={(v) => updateQuestion(pi, qi, { points: v })}
                    onInstruction={(v) => updateQuestion(pi, qi, { instruction: v })}
                    onCorrect={(v) => updateQuestion(pi, qi, { correct_answer: v })}
                    onOption={(oi, v) => updateMCQOption(pi, qi, oi, v)}
                    onAddMatchingOption={() =>
                      updateQuestion(pi, qi, { options: [...q.options, ''] })
                    }
                    onRemoveMatchingOption={(oi) =>
                      updateQuestion(pi, qi, {
                        options: q.options.filter((_, k) => k !== oi),
                      })
                    }
                    onAcceptable={(vals) =>
                      updateQuestion(pi, qi, { acceptable_answers: vals })
                    }
                    onRemove={() => removeQuestion(pi, qi)}
                  />
                ))}
                <Button variant="outline" size="sm" onClick={() => addQuestion(pi)}>
                  <Plus className="mr-2 h-4 w-4" /> Add question
                </Button>
              </div>
              )}
            </CardContent>
          </Card>
        ))}

        <Button
          variant="outline"
          onClick={addPassage}
          className="w-full rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 py-6 font-medium text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50"
        >
          <Plus className="mr-2 h-4 w-4" />
          {draft.module === 'listening' && "Yangi Qism (Part) qo'shish"}
          {draft.module === 'reading'   && "Yangi Passage qo'shish"}
          {draft.module === 'writing'   && "Yangi Task qo'shish"}
          {draft.module === 'speaking'  && "Yangi qism qo'shish"}
        </Button>
      </div>
      </div>
    </Layout>
  )
}

// ============= QuestionBuilder component =============

type QBProps = {
  q: QDraft
  qi: number
  onChangeType: (t: QType) => void
  onText: (v: string) => void
  onPoints: (v: number) => void
  onInstruction: (v: string) => void
  onCorrect: (v: string) => void
  onOption: (oi: number, v: string) => void
  onAddMatchingOption: () => void
  onRemoveMatchingOption: (oi: number) => void
  onAcceptable: (vals: string[]) => void
  onRemove: () => void
}

function QuestionBuilder({
  q,
  qi,
  onChangeType,
  onText,
  onPoints,
  onInstruction,
  onCorrect,
  onOption,
  onAddMatchingOption,
  onRemoveMatchingOption,
  onAcceptable,
  onRemove,
}: QBProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          Question #{qi + 1}
        </span>
        <div className="flex items-center gap-3">
          <select
            value={q.question_type}
            onChange={(e) => onChangeType(e.target.value as QType)}
            className="h-9 rounded-md border border-input bg-white px-2 text-sm"
          >
            <option value="mcq">Multiple Choice</option>
            <option value="tfng">True/False/NG</option>
            <option value="fill">Fill in blank</option>
            <option value="matching">Matching</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Instruction (optional)</Label>
          <Input
            value={q.instruction}
            onChange={(e) => onInstruction(e.target.value)}
            placeholder="Choose A, B, C or D"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Question text</Label>
          <Input value={q.text} onChange={(e) => onText(e.target.value)} />
        </div>

        {q.question_type === 'mcq' && (
          <div className="space-y-2">
            <Label className="text-xs">Options (mark the correct answer)</Label>
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.correct_answer === opt && opt !== ''}
                  onChange={() => onCorrect(opt)}
                  className="h-4 w-4"
                />
                <span className="w-6 text-sm text-slate-500">
                  {String.fromCharCode(65 + oi)}
                </span>
                <Input
                  value={opt}
                  onChange={(e) => onOption(oi, e.target.value)}
                  placeholder={`Variant ${String.fromCharCode(65 + oi)}`}
                />
              </div>
            ))}
          </div>
        )}

        {q.question_type === 'tfng' && (
          <div className="space-y-2">
            <Label className="text-xs">Correct answer</Label>
            <div className="flex gap-2">
              {['True', 'False', 'Not Given'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onCorrect(v)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    q.correct_answer === v
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {q.question_type === 'fill' && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Correct answer</Label>
              <Input value={q.correct_answer} onChange={(e) => onCorrect(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Accepted alternatives (one per line)</Label>
              <textarea
                value={q.acceptable_answers.join('\n')}
                onChange={(e) =>
                  onAcceptable(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))
                }
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
              />
            </div>
          </div>
        )}

        {q.question_type === 'matching' && (
          <div className="space-y-2">
            <Label className="text-xs">Options</Label>
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => onOption(oi, e.target.value)}
                  placeholder={`Variant ${oi + 1}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveMatchingOption(oi)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={onAddMatchingOption}>
              <Plus className="mr-1 h-4 w-4" /> Option
            </Button>
            <div className="mt-2 space-y-1">
              <Label className="text-xs">Correct answer</Label>
              <select
                value={q.correct_answer}
                onChange={(e) => onCorrect(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm"
              >
                <option value="">— select —</option>
                {q.options.filter(Boolean).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Label className="text-xs">Points:</Label>
          <Input
            type="number"
            min={0}
            value={q.points}
            onChange={(e) => onPoints(Number(e.target.value) || 0)}
            className="w-20"
          />
        </div>
      </div>
    </div>
  )
}

// ============= AudioUploadField =============

type AudioFieldProps = {
  currentUrl: string | null
  currentPath: string | null
  onUploaded: (path: string, url: string) => void
  onClear: () => void
}

function AudioUploadField({
  currentUrl,
  currentPath,
  onUploaded,
  onClear,
}: AudioFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handlePick = () => inputRef.current?.click()

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<{ path: string; url: string }>(
        '/admin/upload/audio',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      onUploaded(data.path, data.url)
      toast.success('Audio uploaded')
    } catch (err) {
      toast.error('Upload failed')
      void err
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Label>Listening audio file</Label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={handleChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePick}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Loading…' : currentPath ? 'Refresh' : 'Choose file'}
        </Button>
        {currentPath && (
          <>
            <span className="max-w-xs truncate text-xs text-muted-foreground">
              {currentPath}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <Trash2 className="h-4 w-4 text-rose-600" />
            </Button>
          </>
        )}
      </div>
      {currentUrl && <audio controls src={currentUrl} className="w-full" />}
    </div>
  )
}
