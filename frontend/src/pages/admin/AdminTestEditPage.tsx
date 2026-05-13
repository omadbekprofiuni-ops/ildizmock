import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImageIcon, Plus, Trash2, Upload } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { useAutosave } from '@/hooks/useAutosave'
import { api } from '@/lib/api'

import AdminLayout from './AdminLayout'

type LayoutComponent = ComponentType<{ children: ReactNode }>

type Props = {
  Layout?: LayoutComponent
  basePath?: string
}

type QType = 'mcq' | 'tfng' | 'fill' | 'matching' | 'matching_headings'

// ETAP 22 — group-form Matching Headings payload contract.
type MHHeading = { id: string; text: string }
type MHPayload = { headings: MHHeading[]; paragraphs: string[] }
type MHAnswer = { matches: Record<string, string> }

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
  image_path?: string | null
  image?: string | null  // read-only preview URL
  // Group-form payload (currently used for matching_headings).
  // Empty/absent means legacy single-heading form is in use.
  payload?: Partial<MHPayload> & Record<string, unknown>
  answer_key?: Partial<MHAnswer> & Record<string, unknown>
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
  image_path: null,
  image: null,
  payload: {},
  answer_key: {},
})

const ROMAN_HEADINGS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii']

const blankMatchingHeadings = (order: number): QDraft => ({
  ...blankQuestion(order),
  question_type: 'matching_headings',
  text: 'Match each paragraph with the correct heading from the list below.',
  options: [],
  correct_answer: '',
  payload: {
    headings: [
      { id: 'i', text: '' },
      { id: 'ii', text: '' },
      { id: 'iii', text: '' },
      { id: 'iv', text: '' },
    ],
    paragraphs: ['B', 'C', 'D'],
  },
  answer_key: { matches: {} },
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

function formatRelative(d: Date): string {
  const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  return `${hr}h ago`
}

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
  if (newType === 'mcq') return { ...q, question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', payload: {}, answer_key: {} }
  if (newType === 'tfng') return { ...q, question_type: 'tfng', options: ['True', 'False', 'Not Given'], correct_answer: '', payload: {}, answer_key: {} }
  if (newType === 'fill') return { ...q, question_type: 'fill', options: [], correct_answer: '', payload: {}, answer_key: {} }
  if (newType === 'matching_headings') {
    // Group-form (ETAP 22). Reuse existing payload if it already looks like one.
    const hasGroup = Array.isArray((q.payload as MHPayload | undefined)?.headings)
    if (hasGroup) return { ...q, question_type: 'matching_headings' }
    const fresh = blankMatchingHeadings(q.order)
    return { ...fresh, instruction: q.instruction, points: q.points }
  }
  return { ...q, question_type: 'matching', options: q.options.length ? q.options : ['', ''], correct_answer: '', payload: {}, answer_key: {} }
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
    questions: Array<QDraft & { payload?: unknown; answer_key?: unknown }>
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
        image: (q as { image?: string | null }).image ?? null,
        image_path: (q as { image_path?: string | null }).image_path ?? null,
        payload:
          ((q as { payload?: Record<string, unknown> }).payload
            && typeof (q as { payload?: unknown }).payload === 'object')
            ? ((q as { payload?: Record<string, unknown> }).payload as Record<string, unknown>)
            : {},
        answer_key:
          ((q as { answer_key?: Record<string, unknown> }).answer_key
            && typeof (q as { answer_key?: unknown }).answer_key === 'object')
            ? ((q as { answer_key?: Record<string, unknown> }).answer_key as Record<string, unknown>)
            : {},
      })),
    })),
  }
}

export default function AdminTestEditPage({
  Layout = AdminLayout,
  basePath = '/admin/tests',
}: Props = {}) {
  const { testId, slug } = useParams<{ testId?: string; slug?: string }>()
  const isNew = !testId || testId === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()

  // basePath bo'lsa "/" bilan boshlanmasa — center context (slug). Absolyut
  // yo'lga aylantiramiz, aks holda navigate(basePath) joriy URL ga qo'shilib
  // ketadi va 404 bo'ladi (masalan: /uniqueacademy/admin/tests/<id>/edit/tests).
  const listPath = basePath.startsWith('/')
    ? basePath
    : slug
      ? `/${slug}/admin/${basePath}`
      : `/${basePath}`
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
      navigate(listPath)
    },
    onError: (err) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      toast.error('Failed to save: ' + JSON.stringify(data).slice(0, 200))
    },
  })

  // ETAP 22 — autosave fixes the refresh-loses-data bug.
  // Only enabled for existing drafts (a test must have an id first); for a
  // brand-new test, the user clicks Save once which POSTs and routes them
  // to /:id/edit, after which autosave takes over.
  const autosave = useAutosave<TestDraft>({
    url: !isNew && testId ? `/admin/tests/${testId}/` : null,
    data: !isNew && testId ? draft : null,
    serialize: (d) => {
      const { passages: _p, ...body } = d
      void _p
      return { ...body, passages_input: d.passages }
    },
    enabled: !isNew && !!testId,
  })

  if (!isNew && query.isLoading) {
    return (
      <Layout>
        <div className="p-8 text-muted-foreground">Loading…</div>
      </Layout>
    )
  }
  if (!isNew && query.isError) {
    return <Navigate to={listPath} replace />
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
        if (q.question_type === 'matching_headings') {
          // Group form: at least one paragraph→heading match required.
          const matches = (q.answer_key as Partial<MHAnswer> | undefined)?.matches ?? {}
          if (!matches || Object.keys(matches).length === 0) {
            return toast.error('Set the correct heading for each paragraph')
          }
          continue
        }
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
    listening: { ring: 'border-red-100', tint: 'bg-brand-50', text: 'text-brand-700', chip: 'bg-brand-100 text-brand-700' },
    reading:   { ring: 'border-emerald-100', tint: 'bg-emerald-50', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700' },
    writing:   { ring: 'border-orange-100', tint: 'bg-orange-50', text: 'text-orange-700', chip: 'bg-orange-100 text-orange-700' },
    speaking:  { ring: 'border-purple-100', tint: 'bg-purple-50', text: 'text-purple-700', chip: 'bg-purple-100 text-purple-700' },
  }
  const accent = moduleAccents[draft.module]

  // ETAP 19 — Listening testlar uchun backend listening_parts'ni passages
  // sifatida qaytaradi; agar shunga qaramay 0 passage va > 0 savol bo'lsa,
  // foydalanuvchini wizard'ga yo'naltiramiz (writing/speaking format'lar).
  const wizardCandidate =
    !isNew &&
    !query.isLoading &&
    query.data &&
    draft.passages.length === 0 &&
    ((query.data as { question_count?: number }).question_count ?? 0) > 0

  const switchToWizardPath = basePath.startsWith('/')
    ? `${basePath}/wizard/${testId}`
    : '#'

  return (
    <Layout>
      <div className="mx-auto max-w-5xl p-6 lg:p-10">
        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
          <Link to={listPath} className="hover:text-brand-600">Testlar</Link>
          <span>/</span>
          <span className="text-slate-900">{isNew ? 'New' : 'Edit'}</span>
        </div>

        {/* Listening edit shu yerda ham ishlaydi — banner faqat writing/speaking
            kabi qo'llab-quvvatlanmaydigan formatlar uchun ko'rinadi */}
        {wizardCandidate && basePath.startsWith('/') && (
          <div className="mb-5 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm">
                <p className="font-bold text-amber-900">
                  Bu test formati simple editor'da tahrirlanmaydi
                </p>
                <p className="mt-1 text-amber-800">
                  Bu modul (writing/speaking) maxsus Wizard'da yaratilgan.
                  Savollarni tahrirlash uchun Wizard'ga o'ting.
                </p>
              </div>
              <Link
                to={switchToWizardPath}
                className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
              >
                Wizard'ga o'tish →
              </Link>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isNew ? 'New test' : draft.name || 'Test edit'}
            </h1>
            <p className="mt-1 text-slate-500">
              {draft.module === 'listening' && 'IELTS Listening — add parts and questions'}
              {draft.module === 'reading'   && 'IELTS Reading — add passages and questions'}
              {draft.module === 'writing'   && 'IELTS Writing — Task 1 va Task 2 sharti'}
              {draft.module === 'speaking'  && 'IELTS Speaking — savollarni tayyorlang'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <span
                className={`text-xs font-medium ${
                  autosave.status === 'error'
                    ? 'text-red-600'
                    : autosave.status === 'saving'
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                }`}
                title={autosave.error ?? ''}
              >
                {autosave.status === 'saving' && 'Auto-saving…'}
                {autosave.status === 'saved' && autosave.savedAt &&
                  `Auto-saved ${formatRelative(autosave.savedAt)}`}
                {autosave.status === 'error' && 'Auto-save failed'}
                {autosave.status === 'idle' && 'Auto-save on'}
              </span>
            )}
            <Link to={listPath}>
              <Button variant="outline" className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" /> Orqaga
              </Button>
            </Link>
            <Button
              onClick={onSave}
              disabled={saveMutation.isPending}
              className="rounded-xl bg-brand-600 hover:bg-brand-700"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
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
                    className="text-cta-600 hover:text-cta-700"
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
                    onImage={(path, url) =>
                      updateQuestion(pi, qi, { image_path: path, image: url })
                    }
                    onClearImage={() =>
                      updateQuestion(pi, qi, { image_path: null, image: null })
                    }
                    onPayload={(patch) =>
                      updateQuestion(pi, qi, {
                        payload: { ...(q.payload ?? {}), ...patch },
                      })
                    }
                    onAnswerKey={(patch) =>
                      updateQuestion(pi, qi, {
                        answer_key: { ...(q.answer_key ?? {}), ...patch },
                      })
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
          className="w-full rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 py-6 font-medium text-brand-700 hover:border-red-400 hover:bg-brand-50"
        >
          <Plus className="mr-2 h-4 w-4" />
          {draft.module === 'listening' && "Add new part"}
          {draft.module === 'reading'   && "Add new passage"}
          {draft.module === 'writing'   && "Add new task"}
          {draft.module === 'speaking'  && "Add new part"}
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
  onImage: (path: string, url: string) => void
  onClearImage: () => void
  onRemove: () => void
  onPayload: (patch: Partial<QDraft['payload']>) => void
  onAnswerKey: (patch: Partial<QDraft['answer_key']>) => void
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
  onImage,
  onClearImage,
  onPayload,
  onAnswerKey,
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
            <option value="matching_headings">Matching Headings</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-cta-600 hover:text-cta-700"
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

        {q.question_type === 'matching_headings' && (
          <MatchingHeadingsBuilder
            payload={(q.payload as Partial<MHPayload> | undefined) ?? {}}
            answerKey={(q.answer_key as Partial<MHAnswer> | undefined) ?? {}}
            onPayload={onPayload}
            onAnswerKey={onAnswerKey}
          />
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

        <QuestionImageField
          currentUrl={q.image ?? null}
          currentPath={q.image_path ?? null}
          onUploaded={onImage}
          onClear={onClearImage}
        />

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

type QuestionImageFieldProps = {
  currentUrl: string | null
  currentPath: string | null
  onUploaded: (path: string, url: string) => void
  onClear: () => void
}

function QuestionImageField({
  currentUrl,
  currentPath,
  onUploaded,
  onClear,
}: QuestionImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('folder', 'question_images')
      const { data } = await api.post<{ path: string; url: string }>(
        '/admin/upload/image',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      onUploaded(data.path, data.url)
      toast.success('Image uploaded')
    } catch {
      toast.error('Image failed to upload')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">Rasm (ixtiyoriy)</Label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          {uploading ? 'Loading…' : currentPath ? "O'zgartirish" : 'Choose image'}
        </Button>
        {currentPath && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="h-4 w-4 text-cta-600" />
          </Button>
        )}
      </div>
      {currentUrl && (
        <img
          src={currentUrl}
          alt="Question"
          className="mt-2 max-h-48 rounded-md border border-slate-200 object-contain"
        />
      )}
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
              <Trash2 className="h-4 w-4 text-cta-600" />
            </Button>
          </>
        )}
      </div>
      {currentUrl && <audio controls src={currentUrl} className="w-full" />}
    </div>
  )
}

// ============= MatchingHeadingsBuilder (ETAP 22 group form) =============

type MHBuilderProps = {
  payload: Partial<MHPayload>
  answerKey: Partial<MHAnswer>
  onPayload: (patch: Partial<MHPayload>) => void
  onAnswerKey: (patch: Partial<MHAnswer>) => void
}

function MatchingHeadingsBuilder({ payload, answerKey, onPayload, onAnswerKey }: MHBuilderProps) {
  const headings: MHHeading[] = Array.isArray(payload.headings) ? payload.headings : []
  const paragraphs: string[] = Array.isArray(payload.paragraphs) ? payload.paragraphs : []
  const matches: Record<string, string> = (answerKey.matches && typeof answerKey.matches === 'object')
    ? answerKey.matches
    : {}

  const setHeading = (idx: number, text: string) => {
    const next = headings.map((h, i) => (i === idx ? { ...h, text } : h))
    onPayload({ headings: next })
  }

  const addHeading = () => {
    const id = ROMAN_HEADINGS[headings.length] ?? `h${headings.length + 1}`
    onPayload({ headings: [...headings, { id, text: '' }] })
  }

  const removeHeading = (idx: number) => {
    const removed = headings[idx]?.id
    const next = headings.filter((_, i) => i !== idx)
    onPayload({ headings: next })
    if (removed) {
      const cleared: Record<string, string> = {}
      for (const [p, h] of Object.entries(matches)) {
        if (h !== removed) cleared[p] = h
      }
      onAnswerKey({ matches: cleared })
    }
  }

  const setParagraphs = (raw: string) => {
    // CSV: "B, C, D, E" → ['B','C','D','E']
    const next = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    onPayload({ paragraphs: next })
  }

  const setMatch = (paragraph: string, headingId: string) => {
    const next = { ...matches }
    if (!headingId) delete next[paragraph]
    else next[paragraph] = headingId
    onAnswerKey({ matches: next })
  }

  return (
    <div className="space-y-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          List of Headings
        </Label>
        <p className="text-xs text-slate-500">
          Define candidate headings. IELTS typically uses 8 headings for 5 paragraphs (3 distractors).
        </p>
        {headings.map((h, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-10 text-right text-sm font-medium text-emerald-700">{h.id}.</span>
            <Input
              value={h.text}
              onChange={(e) => setHeading(idx, e.target.value)}
              placeholder={`Heading ${h.id}`}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeHeading(idx)}
              disabled={headings.length <= 2}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addHeading}>
          <Plus className="mr-1 h-4 w-4" /> Add heading
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Paragraphs to match
        </Label>
        <Input
          value={paragraphs.join(', ')}
          onChange={(e) => setParagraphs(e.target.value)}
          placeholder="B, C, D, E"
        />
        <p className="text-xs text-slate-500">
          Comma-separated paragraph IDs (e.g. <code>B, C, D, E</code>). Skip A if it's the example.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Correct answers
        </Label>
        {paragraphs.length === 0 && (
          <p className="text-xs italic text-slate-500">Add paragraphs above first.</p>
        )}
        {paragraphs.map((p) => (
          <div key={p} className="flex items-center gap-2">
            <span className="w-12 text-sm font-medium text-slate-700">Para {p}</span>
            <span className="text-slate-400">→</span>
            <select
              value={matches[p] ?? ''}
              onChange={(e) => setMatch(p, e.target.value)}
              className="h-9 flex-1 rounded-md border border-input bg-white px-2 text-sm"
            >
              <option value="">— select heading —</option>
              {headings.filter((h) => h.text.trim()).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.id}. {h.text}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
