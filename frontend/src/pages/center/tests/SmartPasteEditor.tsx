import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  LivePreview,
  type PreviewData,
} from '@/components/smart-paste/LivePreview'
import { toast } from '@/components/ui/toaster'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api } from '@/lib/api'

type Mode = 'reading' | 'listening' | 'writing' | 'speaking'

export default function SmartPasteEditor() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug?: string }>()
  const backPath = slug ? `/${slug}/admin/tests/new` : '/admin/tests/new'
  const listPath = slug ? `/${slug}/admin/tests` : '/admin/tests'

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<Mode>('reading')
  const [moduleField, setModuleField] = useState<'academic' | 'general'>('academic')

  const [passage, setPassage] = useState('')
  const [transcript, setTranscript] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [task1Prompt, setTask1Prompt] = useState('')
  const [task2Prompt, setTask2Prompt] = useState('')
  const [part1, setPart1] = useState('')
  const [part2, setPart2] = useState('')
  const [part3, setPart3] = useState('')
  const [questions, setQuestions] = useState('')
  const [answers, setAnswers] = useState('')

  const formData = useMemo(
    () => ({
      mode,
      passage,
      transcript,
      questions,
      answers,
      task1_prompt: task1Prompt,
      task2_prompt: task2Prompt,
      part1,
      part2,
      part3,
    }),
    [mode, passage, transcript, questions, answers,
     task1Prompt, task2Prompt, part1, part2, part3],
  )

  const debounced = useDebouncedValue(formData, 800)

  const previewMutation = useMutation({
    mutationFn: async (data: typeof formData) =>
      (await api.post('/admin/smart-paste/preview/', data)).data as PreviewData,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      Object.entries(formData).forEach(([k, v]) => {
        if (v != null) fd.append(k, String(v))
      })
      fd.append('title', title)
      fd.append('module', moduleField)
      if (audioFile) fd.append('audio_file', audioFile)
      const r = await api.post<{ test_id: string; edit_url: string }>(
        '/admin/smart-paste/create/',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return r.data
    },
    onSuccess: (data) => {
      toast.success('Test yaratildi')
      // Backend edit_url'i ETAP 22 admin'ga ko'rsatadi, lekin slug bilan
      // moslash uchun listga qaytaramiz va u yerdan ochishni taklif qilamiz.
      navigate(slug ? `/${slug}/admin/tests` : data.edit_url || listPath)
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { errors?: string[]; error?: string } } })
        ?.response?.data
      const msg = data?.errors?.join('; ') ?? data?.error ?? 'Failed to create'
      toast.error(msg.slice(0, 200))
    },
  })

  // Trigger preview on debounced changes
  useEffect(() => {
    const hasContent =
      (debounced.mode === 'reading' &&
        (debounced.passage || debounced.questions || debounced.answers)) ||
      (debounced.mode === 'listening' &&
        (debounced.questions || debounced.answers)) ||
      (debounced.mode === 'writing' &&
        (debounced.task1_prompt || debounced.task2_prompt)) ||
      (debounced.mode === 'speaking' &&
        (debounced.part1 || debounced.part2 || debounced.part3))
    if (hasContent) previewMutation.mutate(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const preview = previewMutation.data ?? null
  const canSave =
    !!title.trim() &&
    !!preview &&
    (preview.errors?.length ?? 0) === 0 &&
    !createMutation.isPending

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Test nomi (masalan: Cambridge IELTS 17 Test 2)"
            className="w-96 border-b border-transparent bg-transparent text-lg font-medium focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="reading">Reading</option>
            <option value="listening">Listening</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
          <select
            value={moduleField}
            onChange={(e) => setModuleField(e.target.value as 'academic' | 'general')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="academic">Academic</option>
            <option value="general">General Training</option>
          </select>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {createMutation.isPending ? 'Saqlanmoqda…' : 'Saqlash va ochish'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 overflow-auto border-r border-slate-200 bg-slate-50 p-6">
          {mode === 'reading' && (
            <ReadingPasteForm
              passage={passage}
              setPassage={setPassage}
              questions={questions}
              setQuestions={setQuestions}
              answers={answers}
              setAnswers={setAnswers}
            />
          )}
          {mode === 'listening' && (
            <ListeningPasteForm
              audioFile={audioFile}
              setAudioFile={setAudioFile}
              transcript={transcript}
              setTranscript={setTranscript}
              questions={questions}
              setQuestions={setQuestions}
              answers={answers}
              setAnswers={setAnswers}
            />
          )}
          {mode === 'writing' && (
            <WritingPasteForm
              t1={task1Prompt}
              setT1={setTask1Prompt}
              t2={task2Prompt}
              setT2={setTask2Prompt}
            />
          )}
          {mode === 'speaking' && (
            <SpeakingPasteForm
              p1={part1}
              setP1={setPart1}
              p2={part2}
              setP2={setPart2}
              p3={part3}
              setP3={setPart3}
            />
          )}
        </div>

        <div className="w-1/2 overflow-auto p-6">
          <LivePreview
            preview={preview}
            loading={previewMutation.isPending}
          />
        </div>
      </div>
    </div>
  )
}

/* ─────────── Sub-forms ─────────── */

function PasteArea({
  label,
  hint,
  value,
  onChange,
  rows = 12,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="mb-5">
      <label className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-slate-900">{label}</span>
        <span className="text-xs text-slate-500">{value.length} chars</span>
      </label>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm focus:border-brand-500 focus:outline-none"
      />
    </div>
  )
}

interface ReadingProps {
  passage: string; setPassage: (v: string) => void
  questions: string; setQuestions: (v: string) => void
  answers: string; setAnswers: (v: string) => void
}

function ReadingPasteForm(props: ReadingProps) {
  return (
    <>
      <PasteArea
        label="📖 Passage"
        hint="Reading matni. Paragraflar avtomatik aniqlanadi (A, B, C…) yoki o'zingiz belgilang."
        value={props.passage}
        onChange={props.setPassage}
        rows={14}
      />
      <PasteArea
        label="❓ Questions"
        hint="Savollar bloki. Cambridge uslubidagi 'Questions 1-5: …' sarlavhalardan foydalaning."
        value={props.questions}
        onChange={props.setQuestions}
        rows={14}
      />
      <PasteArea
        label="✅ Answer Key"
        hint="Har qator bitta javob, masalan: '1   iv', '6   TRUE', '11   B'."
        value={props.answers}
        onChange={props.setAnswers}
        rows={10}
      />
    </>
  )
}

interface ListeningProps {
  audioFile: File | null; setAudioFile: (f: File | null) => void
  transcript: string; setTranscript: (v: string) => void
  questions: string; setQuestions: (v: string) => void
  answers: string; setAnswers: (v: string) => void
}

function ListeningPasteForm(props: ListeningProps) {
  return (
    <>
      <div className="mb-5">
        <label className="mb-1 block font-semibold text-slate-900">
          🔊 Audio fayl (.mp3, .wav, .m4a)
        </label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => props.setAudioFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        {props.audioFile && (
          <p className="mt-1 text-xs text-slate-500">
            {props.audioFile.name} —{' '}
            {(props.audioFile.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </div>
      <PasteArea
        label="📝 Transkript (ixtiyoriy)"
        hint="Sifat nazorati va o'qituvchi uchun; talabaga ko'rsatilmaydi."
        value={props.transcript}
        onChange={props.setTranscript}
        rows={10}
      />
      <PasteArea
        label="❓ Savollar (1–4 sectionlar)"
        hint="Barcha 40 ta savol. Section bo'linishi: 1-10, 11-20, 21-30, 31-40."
        value={props.questions}
        onChange={props.setQuestions}
        rows={16}
      />
      <PasteArea
        label="✅ Answer Key"
        hint="40 qator, har savolga bittadan."
        value={props.answers}
        onChange={props.setAnswers}
        rows={10}
      />
    </>
  )
}

interface WritingProps {
  t1: string; setT1: (v: string) => void
  t2: string; setT2: (v: string) => void
}

function WritingPasteForm(props: WritingProps) {
  return (
    <>
      <PasteArea
        label="✍️ Task 1 prompt (Academic: chart; General: xat)"
        hint="Academic uchun chart rasmni keyin alohida yuklang."
        value={props.t1}
        onChange={props.setT1}
        rows={10}
      />
      <PasteArea
        label="✍️ Task 2 prompt (250 so'z, 40 daqiqa)"
        value={props.t2}
        onChange={props.setT2}
        rows={10}
      />
    </>
  )
}

interface SpeakingProps {
  p1: string; setP1: (v: string) => void
  p2: string; setP2: (v: string) => void
  p3: string; setP3: (v: string) => void
}

function SpeakingPasteForm(props: SpeakingProps) {
  return (
    <>
      <PasteArea
        label="🗣️ Part 1 — Tanishuv savollari"
        value={props.p1}
        onChange={props.setP1}
        rows={8}
      />
      <PasteArea
        label="🗣️ Part 2 — Cue card"
        hint="Birinchi qator — mavzu; bullet (-, •) bilan boshlanuvchilar talking points."
        value={props.p2}
        onChange={props.setP2}
        rows={10}
      />
      <PasteArea
        label="🗣️ Part 3 — Munozara savollari"
        value={props.p3}
        onChange={props.setP3}
        rows={8}
      />
    </>
  )
}
