import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, FileText, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type ParsedQuestion = {
  order: number
  part_number: number
  stem: string
  type: 'completion' | 'multiple_choice' | 'matching' | 'true_false' | string
  options: string[]
  suggested_answer: string | null
  confidence: number
  needs_review: boolean
  answer?: string
}

type ParsedTest = {
  title: string
  test_type: 'listening' | 'reading' | 'writing'
  duration_minutes: number
  confidence: number
  audio_hint: string | null
  warnings: string[]
  questions: ParsedQuestion[]
}

type ConfirmResponse = {
  id: string
  next: string
  is_library: boolean
  questions_saved: number
}

interface PdfImportPageProps {
  /** Override base path for "/<base>/<id>/edit" navigation after save. */
  editBasePath?: string
  /** Override "Back" button destination. */
  backPath?: string
}

export default function PdfImportPage({
  editBasePath,
  backPath: backPathProp,
}: PdfImportPageProps = {}) {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug?: string }>()
  const backPath =
    backPathProp ?? (slug ? `/${slug}/admin/tests/new-mode` : '/admin/tests/new-mode')
  const editBase =
    editBasePath ?? (slug ? `/${slug}/admin/tests` : '/admin/tests')

  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<ParsedTest | null>(null)
  const [useAI, setUseAI] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('pdf', file)
      fd.append('use_ai', useAI ? 'true' : 'false')
      const res = await api.post('/admin/tests/import-pdf/preview/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data as ParsedTest
    },
    onSuccess: (data) => {
      setParsed(data)
      toast.success(
        `${data.questions.length} questions extracted (${Math.round(data.confidence * 100)}% confidence)`,
      )
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Could not parse PDF')
    },
  })

  const confirm = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error('No parsed data')
      const res = await api.post('/admin/tests/import-pdf/confirm/', parsed)
      return res.data as ConfirmResponse
    },
    onSuccess: (data) => {
      toast.success(`${data.questions_saved} questions saved as draft`)
      navigate(`${editBase}/${data.id}/edit`)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Could not save test')
    },
  })

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please drop a PDF file.')
      return
    }
    upload.mutate(f)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) upload.mutate(f)
  }

  const updateQuestion = (idx: number, patch: Partial<ParsedQuestion>) => {
    if (!parsed) return
    const next = [...parsed.questions]
    next[idx] = { ...next[idx], ...patch }
    setParsed({ ...parsed, questions: next })
  }

  // ---------- STEP 1: Drop zone ----------

  if (!parsed) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <button
          onClick={() => navigate(backPath)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-slate-900">Import test from PDF</h1>
        <p className="mt-1 text-slate-600">
          Drag and drop your IELTS test PDF. We'll extract the questions
          automatically and let you review before saving.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-6 rounded-xl border-2 border-dashed p-12 text-center transition ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : upload.isPending
                ? 'border-blue-300 bg-blue-50'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
        >
          {upload.isPending ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Parsing PDF… this takes 10–30 seconds.
              </p>
            </>
          ) : (
            <>
              <FileText className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-3 text-lg font-medium text-slate-800">
                Drop your PDF here
              </p>
              <p className="mt-1 text-sm text-slate-500">or</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" /> Choose PDF
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onPick}
                className="hidden"
              />
              <label className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Use AI to improve question parsing (slower but more accurate)
              </label>
            </>
          )}
        </div>

        {upload.error && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {(upload.error as any).response?.data?.error || 'Upload failed'}
          </p>
        )}
      </div>
    )
  }

  // ---------- STEP 2: Review parsed data ----------

  const confidenceColor =
    parsed.confidence > 0.8
      ? 'text-green-600'
      : parsed.confidence > 0.5
        ? 'text-amber-600'
        : 'text-red-600'

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review imported test</h1>
          <p className="mt-1 text-sm text-slate-600">
            Confidence:{' '}
            <span className={`font-semibold ${confidenceColor}`}>
              {Math.round(parsed.confidence * 100)}%
            </span>{' '}
            · {parsed.questions.length} questions
          </p>
        </div>
        <button
          onClick={() => setParsed(null)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Re-upload PDF
        </button>
      </div>

      {parsed.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-800">⚠ Warnings</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-700">
            {parsed.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            value={parsed.title}
            onChange={(e) => setParsed({ ...parsed, title: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Type</span>
          <select
            value={parsed.test_type}
            onChange={(e) =>
              setParsed({
                ...parsed,
                test_type: e.target.value as ParsedTest['test_type'],
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5"
          >
            <option value="listening">Listening</option>
            <option value="reading">Reading</option>
            <option value="writing">Writing</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Duration (min)</span>
          <input
            type="number"
            min={1}
            value={parsed.duration_minutes}
            onChange={(e) =>
              setParsed({
                ...parsed,
                duration_minutes: parseInt(e.target.value, 10) || 60,
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5"
          />
        </label>
      </div>

      {parsed.test_type === 'listening' && parsed.audio_hint && (
        <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          🎧 Audio file mentioned: <code>{parsed.audio_hint}</code> — upload it
          separately on the next step.
        </p>
      )}

      <h2 className="mt-8 text-lg font-bold text-slate-900">
        {parsed.questions.length} questions
      </h2>
      <div className="mt-3 space-y-3">
        {parsed.questions.map((q, idx) => (
          <div
            key={`${q.order}-${idx}`}
            className={`rounded-lg border bg-white p-4 ${
              q.needs_review ? 'border-amber-400' : 'border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                Q{q.order} · Part {q.part_number}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                {q.type}
              </span>
              {q.needs_review && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  needs review
                </span>
              )}
              <span className="ml-auto text-xs text-slate-500">
                {Math.round(q.confidence * 100)}% confidence
              </span>
            </div>
            <textarea
              value={q.stem}
              onChange={(e) => updateQuestion(idx, { stem: e.target.value })}
              rows={2}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            {q.options.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {q.options.map((opt, i) => (
                  <li key={i}>{opt}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Answer</label>
              <input
                value={q.answer || ''}
                onChange={(e) => updateQuestion(idx, { answer: e.target.value })}
                placeholder="Enter correct answer"
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={() => setParsed(null)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Re-upload PDF
        </button>
        <button
          onClick={() => confirm.mutate()}
          disabled={confirm.isPending || parsed.questions.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {confirm.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            'Save test →'
          )}
        </button>
      </div>
    </div>
  )
}
