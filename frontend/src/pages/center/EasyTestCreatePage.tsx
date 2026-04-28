import {
  ArrowLeft,
  BookOpen,
  GripVertical,
  Headphones,
  ImageIcon,
  Loader2,
  PenLine,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Module = 'listening' | 'reading' | 'writing'
type QType = 'mcq' | 'tfng' | 'fill' | 'matching' | 'short_answer'

type QDraft = {
  order: number
  question_type: QType
  text: string
  options: string[]
  correct_answer: string
  instruction: string
  points: number
}

type SectionDraft = {
  part_number: number
  title: string
  content: string // passage text or transcript
  instructions: string
  audio_file_path: string | null // listening only
  audio_url: string | null // preview
  image_path: string | null // listening map/diagram (ixtiyoriy)
  image_url: string | null
  questions: QDraft[]
}

type WritingTaskDraft = {
  task_number: number
  prompt: string
  min_words: number
  suggested_minutes: number
  requirements: string
  chart_image_path: string | null
  chart_image_url: string | null
}

const MODULE_OPTIONS: {
  value: Module
  label: string
  icon: LucideIcon
  hint: string
}[] = [
  { value: 'listening', label: 'Listening', icon: Headphones, hint: 'Audio yuklang, savollar yarating' },
  { value: 'reading', label: 'Reading', icon: BookOpen, hint: 'Passage matni va savollar' },
  { value: 'writing', label: 'Writing', icon: PenLine, hint: 'Task 1 + Task 2 sharti' },
]

const blankQuestion = (order: number): QDraft => ({
  order,
  question_type: 'mcq',
  text: '',
  options: ['', '', '', ''],
  correct_answer: '',
  instruction: '',
  points: 1,
})

const blankSection = (n: number): SectionDraft => ({
  part_number: n,
  title: '',
  content: '',
  instructions: '',
  audio_file_path: null,
  audio_url: null,
  image_path: null,
  image_url: null,
  questions: [blankQuestion(1)],
})

const blankWriting = (n: number): WritingTaskDraft => ({
  task_number: n,
  prompt: '',
  min_words: n === 1 ? 150 : 250,
  suggested_minutes: n === 1 ? 20 : 40,
  requirements: '',
  chart_image_path: null,
  chart_image_url: null,
})

export default function EasyTestCreatePage() {
  const { slug, module: moduleParam } = useParams<{ slug: string; module?: string }>()
  const navigate = useNavigate()

  // URL'dan module aniqlanadi — hub'dan kelgan bo'lsa oldindan tanlanadi.
  const initialModule: Module =
    moduleParam === 'listening' ? 'listening'
      : moduleParam === 'writing' ? 'writing'
        : moduleParam === 'reading' ? 'reading'
          : 'reading'
  const moduleLocked = !!moduleParam

  useEffect(() => {
    const mod = moduleParam ? `(${moduleParam})` : ''
    document.title = `ILDIZmock — Yangi test ${mod}`.trim()
  }, [moduleParam])

  const [module, setModule] = useState<Module>(initialModule)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | 'expert'>('intermediate')
  const [duration, setDuration] = useState(60)
  const [isPublished, setIsPublished] = useState(false)

  const [sections, setSections] = useState<SectionDraft[]>([blankSection(1)])
  const [writingTasks, setWritingTasks] = useState<WritingTaskDraft[]>([
    blankWriting(1),
    blankWriting(2),
  ])

  const [saving, setSaving] = useState(false)

  const updateSection = (i: number, patch: Partial<SectionDraft>) => {
    setSections((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  }
  const addSection = () => {
    setSections((s) => [...s, blankSection(s.length + 1)])
  }
  const removeSection = (i: number) => {
    setSections((s) =>
      s.filter((_, idx) => idx !== i).map((x, idx) => ({
        ...x,
        part_number: idx + 1,
      })),
    )
  }

  const updateQuestion = (si: number, qi: number, patch: Partial<QDraft>) => {
    setSections((s) =>
      s.map((sec, idx) =>
        idx !== si
          ? sec
          : {
              ...sec,
              questions: sec.questions.map((q, qq) =>
                qq === qi ? { ...q, ...patch } : q,
              ),
            },
      ),
    )
  }
  const addQuestion = (si: number) => {
    setSections((s) =>
      s.map((sec, idx) =>
        idx !== si
          ? sec
          : { ...sec, questions: [...sec.questions, blankQuestion(sec.questions.length + 1)] },
      ),
    )
  }
  const removeQuestion = (si: number, qi: number) => {
    setSections((s) =>
      s.map((sec, idx) =>
        idx !== si
          ? sec
          : {
              ...sec,
              questions: sec.questions
                .filter((_, qq) => qq !== qi)
                .map((q, qq) => ({ ...q, order: qq + 1 })),
            },
      ),
    )
  }

  const changeQuestionType = (si: number, qi: number, t: QType) => {
    let options: string[] = []
    if (t === 'mcq') options = ['', '', '', '']
    else if (t === 'tfng') options = ['True', 'False', 'Not Given']
    else options = []
    updateQuestion(si, qi, { question_type: t, options, correct_answer: '' })
  }

  const onSave = async () => {
    if (!name.trim()) {
      toast.error('Test nomini kiriting')
      return
    }
    if (module === 'writing') {
      if (!writingTasks[0].prompt.trim() || !writingTasks[1].prompt.trim()) {
        toast.error("Task 1 va Task 2 sharti kiritilishi kerak")
        return
      }
    } else {
      for (const sec of sections) {
        if (!sec.title.trim()) {
          toast.error("Har section'ga sarlavha bering")
          return
        }
        for (const q of sec.questions) {
          if (!q.text.trim()) {
            toast.error('Savol matni bo‘sh')
            return
          }
          if (!q.correct_answer.trim()) {
            toast.error('Har savolga to‘g‘ri javob ko‘rsating')
            return
          }
        }
      }
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name,
        module,
        description,
        difficulty,
        test_type: 'academic',
        duration_minutes: duration,
        is_published: isPublished,
      }
      if (module === 'reading') {
        payload.passages = sections.map((s) => ({
          part_number: s.part_number,
          title: s.title,
          content: s.content,
          instructions: s.instructions,
          questions: s.questions,
        }))
      } else if (module === 'listening') {
        payload.listening_parts = sections.map((s) => ({
          part_number: s.part_number,
          audio_file_path: s.audio_file_path,
          image_path: s.image_path,
          transcript: s.content,
          instructions: s.instructions,
          questions: s.questions,
        }))
      } else if (module === 'writing') {
        payload.writing_tasks = writingTasks.map((t) => ({
          task_number: t.task_number,
          prompt: t.prompt,
          min_words: t.min_words,
          suggested_minutes: t.suggested_minutes,
          requirements: t.requirements,
          chart_image_path: t.task_number === 1 ? t.chart_image_path : null,
        }))
      }

      await api.post(`/center/${slug}/tests/easy-create/`, payload)
      toast.success('Test yaratildi')
      navigate(`/${slug}/admin/tests`)
    } catch (err) {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      toast.error('Xatolik: ' + JSON.stringify(data).slice(0, 200))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell maxWidth="max-w-5xl">
      <Link
        to={`/${slug}/admin/tests`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
      >
        <ArrowLeft size={14} /> Testlar
      </Link>

      <PageHeader
        title="Yangi test yaratish"
        subtitle="Bir sahifada section/passage va savollarni qo‘shing — oxirida bir martalik saqlanadi"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate(`/${slug}/admin/tests`)}
              className={btnOutline}
            >
              Bekor
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={btnPrimary}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saqlanmoqda…
                </>
              ) : (
                <>Saqlash</>
              )}
            </button>
          </>
        }
      />

      <div className="space-y-6">
        {/* Module selector — faqat URL'dan modul aniq emas bo'lsa ko'rinadi */}
        {!moduleLocked && (
        <SurfaceCard>
          <p className="mb-3 text-sm font-medium text-slate-700">Test turi</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MODULE_OPTIONS.map((m) => {
              const selected = module === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setModule(m.value)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    selected
                      ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      selected ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <m.icon size={20} />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${selected ? 'text-red-700' : 'text-slate-900'}`}>
                      {m.label}
                    </div>
                    <div className="text-xs text-slate-500">{m.hint}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </SurfaceCard>
        )}

        {/* Basic info */}
        <SurfaceCard>
          <div className="space-y-4">
            <Field label="Test nomi">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Academic Reading — Practice 1"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </Field>

            <Field label="Tavsif (ixtiyoriy)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Qiyinlik">
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </Field>
              <Field label="Davomiyligi (daqiqa)">
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 60)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </Field>
              <Field label="Holat">
                <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-slate-700">Darhol e‘lon qilish</span>
                </label>
              </Field>
            </div>
          </div>
        </SurfaceCard>

        {/* Content sections */}
        {module === 'writing' ? (
          <div className="space-y-4">
            {writingTasks.map((t, i) => (
              <SurfaceCard key={i}>
                <div className="mb-3 flex items-center gap-2">
                  <Chip tone="amber">Task {t.task_number}</Chip>
                  <span className="text-xs text-slate-500">
                    Kamida {t.min_words} so‘z · taklif: {t.suggested_minutes} daqiqa
                  </span>
                </div>
                <Field label="Topshiriq sharti">
                  <textarea
                    value={t.prompt}
                    onChange={(e) =>
                      setWritingTasks((arr) =>
                        arr.map((x, idx) => (idx === i ? { ...x, prompt: e.target.value } : x)),
                      )
                    }
                    rows={5}
                    placeholder={
                      t.task_number === 1
                        ? 'The chart below shows...'
                        : 'Some people believe that... Discuss both views.'
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </Field>

                {t.task_number === 1 && (
                  <div className="mt-3">
                    <ChartImageField
                      task={t}
                      onChange={(patch) =>
                        setWritingTasks((arr) =>
                          arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
                        )
                      }
                    />
                  </div>
                )}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Kamida so‘z">
                    <input
                      type="number"
                      min={50}
                      value={t.min_words}
                      onChange={(e) =>
                        setWritingTasks((arr) =>
                          arr.map((x, idx) =>
                            idx === i ? { ...x, min_words: Number(e.target.value) || 0 } : x,
                          ),
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </Field>
                  <Field label="Taklif qilingan vaqt (daq.)">
                    <input
                      type="number"
                      min={5}
                      value={t.suggested_minutes}
                      onChange={(e) =>
                        setWritingTasks((arr) =>
                          arr.map((x, idx) =>
                            idx === i
                              ? { ...x, suggested_minutes: Number(e.target.value) || 0 }
                              : x,
                          ),
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </Field>
                </div>
              </SurfaceCard>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((s, si) => (
              <SectionEditor
                key={si}
                module={module}
                index={si}
                section={s}
                canRemove={sections.length > 1}
                onChange={(patch) => updateSection(si, patch)}
                onRemove={() => removeSection(si)}
                onUpdateQuestion={(qi, patch) => updateQuestion(si, qi, patch)}
                onAddQuestion={() => addQuestion(si)}
                onRemoveQuestion={(qi) => removeQuestion(si, qi)}
                onChangeQuestionType={(qi, t) => changeQuestionType(si, qi, t)}
              />
            ))}

            <button
              type="button"
              onClick={addSection}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-red-200 bg-red-50/40 py-5 font-medium text-red-700 hover:border-red-400 hover:bg-red-50"
            >
              <Plus size={18} />
              {module === 'listening' ? "Yangi Part qo'shish" : "Yangi Passage qo'shish"}
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function SectionEditor({
  module,
  index,
  section,
  canRemove,
  onChange,
  onRemove,
  onUpdateQuestion,
  onAddQuestion,
  onRemoveQuestion,
  onChangeQuestionType,
}: {
  module: Module
  index: number
  section: SectionDraft
  canRemove: boolean
  onChange: (patch: Partial<SectionDraft>) => void
  onRemove: () => void
  onUpdateQuestion: (qi: number, patch: Partial<QDraft>) => void
  onAddQuestion: () => void
  onRemoveQuestion: (qi: number) => void
  onChangeQuestionType: (qi: number, t: QType) => void
}) {
  const sectionLabel = module === 'listening' ? `Part ${section.part_number}` : `Passage ${section.part_number}`
  const accentTone = module === 'listening' ? 'red' : 'emerald'

  return (
    <SurfaceCard className={accentTone === 'red' ? 'border-red-100' : 'border-emerald-100'}>
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-slate-300" />
          <Chip tone={accentTone === 'red' ? 'indigo' : 'emerald'}>{sectionLabel}</Chip>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            title="O‘chirish"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <Field label={module === 'listening' ? 'Part sarlavhasi' : 'Passage sarlavhasi'}>
          <input
            value={section.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="The History of the Tortoise"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </Field>

        {module === 'listening' && (
          <>
            <AudioField section={section} onChange={onChange} />
            <SectionImageField section={section} onChange={onChange} />
          </>
        )}

        <Field label={module === 'listening' ? 'Audio matni / Transcript' : 'Passage matni'}>
          <textarea
            value={section.content}
            onChange={(e) => onChange({ content: e.target.value })}
            rows={module === 'listening' ? 5 : 8}
            placeholder={
              module === 'listening' ? 'Matn (transcript)…' : 'Reading passage matni…'
            }
            className="w-full rounded-xl border border-slate-300 p-3 text-sm leading-relaxed focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </Field>

        <Field label="Instruksiya (ixtiyoriy)">
          <input
            value={section.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            placeholder="Read the passage and answer questions 1–10"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            Savollar ({section.questions.length})
          </h3>
          <div className="space-y-3">
            {section.questions.map((q, qi) => (
              <QuestionEditor
                key={qi}
                question={q}
                index={qi}
                onChange={(patch) => onUpdateQuestion(qi, patch)}
                onRemove={() => onRemoveQuestion(qi)}
                onChangeType={(t) => onChangeQuestionType(qi, t)}
              />
            ))}
            <button
              type="button"
              onClick={onAddQuestion}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-red-200 bg-red-50/40 py-3 text-sm font-medium text-red-700 hover:border-red-400 hover:bg-red-50"
            >
              <Plus size={16} /> Savol qo'shish
            </button>
          </div>
        </div>
      </div>
      <span className="hidden">{index}</span>
    </SurfaceCard>
  )
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
  onChangeType,
}: {
  question: QDraft
  index: number
  onChange: (patch: Partial<QDraft>) => void
  onRemove: () => void
  onChangeType: (t: QType) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700">
          {index + 1}
        </span>
        <select
          value={question.question_type}
          onChange={(e) => onChangeType(e.target.value as QType)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 focus:border-red-500 focus:outline-none"
        >
          <option value="mcq">Multiple Choice</option>
          <option value="tfng">True / False / Not Given</option>
          <option value="fill">Fill in the blank</option>
          <option value="short_answer">Short answer</option>
          <option value="matching">Matching</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <input
        value={question.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Savol matni"
        className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
      />

      {question.question_type === 'mcq' && (
        <div className="space-y-2">
          {question.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                type="radio"
                name={`q-${index}-correct`}
                checked={question.correct_answer === opt && opt !== ''}
                onChange={() => onChange({ correct_answer: opt })}
                className="h-4 w-4 border-slate-300 text-red-600 focus:ring-red-600"
              />
              <input
                value={opt}
                onChange={(e) => {
                  const newOpts = [...question.options]
                  newOpts[oi] = e.target.value
                  // If the user updates the current correct answer text, keep tracking
                  const patch: Partial<QDraft> = { options: newOpts }
                  if (question.correct_answer === opt) patch.correct_answer = e.target.value
                  onChange(patch)
                }}
                placeholder={`Variant ${String.fromCharCode(65 + oi)}`}
                className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          ))}
        </div>
      )}

      {question.question_type === 'tfng' && (
        <div className="flex flex-wrap gap-2">
          {['True', 'False', 'Not Given'].map((v) => (
            <label
              key={v}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                question.correct_answer === v
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`q-${index}-tfng`}
                checked={question.correct_answer === v}
                onChange={() => onChange({ correct_answer: v })}
                className="hidden"
              />
              {v}
            </label>
          ))}
        </div>
      )}

      {(question.question_type === 'fill' || question.question_type === 'short_answer') && (
        <input
          value={question.correct_answer}
          onChange={(e) => onChange({ correct_answer: e.target.value })}
          placeholder="To'g'ri javob (kichik harflarda yozing)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      )}

      {question.question_type === 'matching' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Variantlar (har qatorda bittadan), to'g'ri javobni tanlang:
          </p>
          {question.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                type="radio"
                name={`q-${index}-match`}
                checked={question.correct_answer === opt && opt !== ''}
                onChange={() => onChange({ correct_answer: opt })}
                className="h-4 w-4 border-slate-300 text-red-600"
              />
              <input
                value={opt}
                onChange={(e) => {
                  const newOpts = [...question.options]
                  newOpts[oi] = e.target.value
                  onChange({ options: newOpts })
                }}
                placeholder="Variant…"
                className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
              {question.options.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ options: question.options.filter((_, k) => k !== oi) })
                  }
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ options: [...question.options, ''] })}
            className="text-xs text-red-600 hover:underline"
          >
            + Variant qo'shish
          </button>
        </div>
      )}
    </div>
  )
}

function AudioField({
  section,
  onChange,
}: {
  section: SectionDraft
  onChange: (patch: Partial<SectionDraft>) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post<{ path: string; url: string }>(
        '/admin/upload/audio',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      onChange({
        audio_file_path: res.data.path,
        audio_url: res.data.url,
      })
      toast.success('Audio yuklandi')
    } catch {
      toast.error('Audio yuklashda xatolik')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="mb-1 text-sm font-medium text-slate-700">Audio fayl</div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={onFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={btnOutline + ' !py-2 !px-3'}
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Yuklanmoqda…
            </>
          ) : (
            <>
              <Upload size={14} /> {section.audio_file_path ? 'Almashtirish' : 'Audio yuklash'}
            </>
          )}
        </button>
        {section.audio_file_path && (
          <span className="text-xs text-slate-500">
            ✓ {section.audio_file_path.split('/').pop()}
          </span>
        )}
      </div>
      {section.audio_url && (
        <audio controls src={section.audio_url} className="mt-2 h-10 w-full max-w-md" />
      )}
    </div>
  )
}

function SectionImageField({
  section,
  onChange,
}: {
  section: SectionDraft
  onChange: (patch: Partial<SectionDraft>) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'listening_images')
      const res = await api.post<{ path: string; url: string }>(
        '/admin/upload/image',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      onChange({ image_path: res.data.path, image_url: res.data.url })
      toast.success('Rasm yuklandi')
    } catch {
      toast.error('Rasm yuklashda xatolik')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <ImageIcon size={14} className="text-slate-500" />
        Rasm (map / diagram — ixtiyoriy)
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={btnOutline + ' !py-2 !px-3'}
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Yuklanmoqda…
            </>
          ) : (
            <>
              <Upload size={14} /> {section.image_path ? 'Almashtirish' : 'Rasm yuklash'}
            </>
          )}
        </button>
        {section.image_path && (
          <button
            type="button"
            onClick={() => onChange({ image_path: null, image_url: null })}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            <X size={12} /> O‘chirish
          </button>
        )}
      </div>
      {section.image_url && (
        <img
          src={section.image_url}
          alt="Section preview"
          className="mt-2 max-h-48 rounded-lg border border-slate-200 object-contain"
        />
      )}
    </div>
  )
}

function ChartImageField({
  task,
  onChange,
}: {
  task: WritingTaskDraft
  onChange: (patch: Partial<WritingTaskDraft>) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'writing_charts')
      const res = await api.post<{ path: string; url: string }>(
        '/admin/upload/image',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      onChange({
        chart_image_path: res.data.path,
        chart_image_url: res.data.url,
      })
      toast.success('Rasm yuklandi')
    } catch {
      toast.error('Rasm yuklashda xatolik')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <ImageIcon size={14} className="text-slate-500" />
        Chart / rasm (Task 1 uchun)
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={btnOutline + ' !py-2 !px-3'}
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Yuklanmoqda…
            </>
          ) : (
            <>
              <Upload size={14} /> {task.chart_image_path ? 'Almashtirish' : 'Rasm yuklash'}
            </>
          )}
        </button>
        {task.chart_image_path && (
          <button
            type="button"
            onClick={() => onChange({ chart_image_path: null, chart_image_url: null })}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            <X size={12} /> O‘chirish
          </button>
        )}
      </div>
      {task.chart_image_url && (
        <img
          src={task.chart_image_url}
          alt="Chart preview"
          className="mt-2 max-h-60 rounded-lg border border-slate-200 object-contain"
        />
      )}
      <p className="mt-1 text-xs text-slate-500">
        IELTS Task 1 uchun chart, grafik yoki jadval (PNG/JPG/WEBP).
      </p>
    </div>
  )
}
