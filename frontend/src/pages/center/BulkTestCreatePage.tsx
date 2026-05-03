import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Loader2,
  Music,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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

type ParsedQuestion = {
  order: number
  question_type: QType
  text: string
  options: string[] | null
  correct_answer: string
  instruction: string
  points: number
}

type ParseResult =
  | { ok: true; questions: ParsedQuestion[] }
  | { ok: false; error: string; lineNumber: number }

type Passage = {
  title: string
  content: string
  bulk: string
  // Listening only — uploaded audio file metadata
  audio_file_path: string | null
  audio_url: string | null
  audio_uploading: boolean
}

const SHORTHAND_TO_TYPE: Record<string, QType> = {
  mcq: 'mcq',
  tfng: 'tfng',
  fill: 'fill',
  short: 'short_answer',
  short_answer: 'short_answer',
}

const TFNG_VALID = new Set(['TRUE', 'FALSE', 'NOT GIVEN'])

/**
 * Parse one passage's bulk-question textarea.
 *
 * Line format:
 *   <num>|<type>|<text>|<answer>             (tfng / fill / short)
 *   <num>|mcq|<text>|A) opt1, B) opt2, ...|<letter>   (mcq)
 *
 * Blank lines and lines starting with `#` are ignored.
 */
function parseBulk(text: string): ParseResult {
  const lines = text.split('\n')
  const out: ParsedQuestion[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    const parts = line.split('|').map((s) => s.trim())
    if (parts.length < 4) {
      return {
        ok: false,
        lineNumber: i + 1,
        error: `Line ${i + 1}: needs at least 4 fields separated by "|" — got ${parts.length}.`,
      }
    }

    const numStr = parts[0]
    const typeStr = parts[1].toLowerCase()
    const text = parts[2]

    const num = Number(numStr)
    if (!Number.isFinite(num) || num <= 0) {
      return {
        ok: false,
        lineNumber: i + 1,
        error: `Line ${i + 1}: question number "${numStr}" is not a positive integer.`,
      }
    }

    const qtype = SHORTHAND_TO_TYPE[typeStr]
    if (!qtype) {
      return {
        ok: false,
        lineNumber: i + 1,
        error: `Line ${i + 1}: unknown type "${typeStr}". Use: tfng, mcq, fill, short.`,
      }
    }

    if (!text) {
      return {
        ok: false,
        lineNumber: i + 1,
        error: `Line ${i + 1}: question text is empty.`,
      }
    }

    if (qtype === 'mcq') {
      if (parts.length < 5) {
        return {
          ok: false,
          lineNumber: i + 1,
          error: `Line ${i + 1}: MCQ needs options and a correct letter. Format: <n>|mcq|<text>|A) opt1, B) opt2, C) opt3, D) opt4|B`,
        }
      }
      const optionsRaw = parts[3]
      const correctLetter = parts[4].toUpperCase()
      // Split on commas, but preserve commas inside option text by relying on letter prefix.
      // Simple heuristic: split by /,(?=\s*[A-Z]\))/.
      const optParts = optionsRaw.split(/,(?=\s*[A-Z]\))/g)
      const options: string[] = []
      let correctAnswer = ''
      for (const opt of optParts) {
        const o = opt.trim()
        const m = o.match(/^([A-Z])\)\s*(.+)$/)
        if (!m) {
          return {
            ok: false,
            lineNumber: i + 1,
            error: `Line ${i + 1}: option "${o}" must start with a letter and ")", e.g. "A) some text".`,
          }
        }
        options.push(m[2].trim())
        if (m[1] === correctLetter) correctAnswer = m[2].trim()
      }
      if (!correctAnswer) {
        return {
          ok: false,
          lineNumber: i + 1,
          error: `Line ${i + 1}: correct letter "${correctLetter}" doesn't match any option.`,
        }
      }
      out.push({
        order: num,
        question_type: 'mcq',
        text,
        options,
        correct_answer: correctAnswer,
        instruction: '',
        points: 1,
      })
    } else {
      const answer = parts[3]
      if (!answer) {
        return {
          ok: false,
          lineNumber: i + 1,
          error: `Line ${i + 1}: correct answer is empty.`,
        }
      }
      if (qtype === 'tfng') {
        const upper = answer.toUpperCase()
        if (!TFNG_VALID.has(upper)) {
          return {
            ok: false,
            lineNumber: i + 1,
            error: `Line ${i + 1}: TFNG answer must be TRUE, FALSE, or NOT GIVEN — got "${answer}".`,
          }
        }
      }
      out.push({
        order: num,
        question_type: qtype,
        text,
        options: null,
        correct_answer: qtype === 'tfng' ? answer.toUpperCase() : answer,
        instruction: '',
        points: 1,
      })
    }
  }

  if (out.length === 0) {
    return {
      ok: false,
      lineNumber: 0,
      error: 'No questions parsed. Paste at least one line.',
    }
  }
  return { ok: true, questions: out }
}

const blankPassage = (): Passage => ({
  title: '',
  content: '',
  bulk: '',
  audio_file_path: null,
  audio_url: null,
  audio_uploading: false,
})

const SAMPLE = `# Format: Number|Type|Text|Answer
# Types: tfng, mcq, fill, short
# MCQ: Number|mcq|Text|A) opt1, B) opt2, C) opt3, D) opt4|CorrectLetter

1|tfng|Coffee was first discovered in Ethiopia|TRUE
2|tfng|Kaldi was a coffee farmer|FALSE
3|mcq|When did coffee reach Europe?|A) 13th century, B) 15th century, C) 17th century, D) 19th century|C
4|fill|Kaldi noticed his goats became ___ after eating the berries|energetic
5|short|What did Kaldi discover?|the coffee plant`

export default function BulkTestCreatePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [name, setName] = useState('')
  const [module, setModule] = useState<'reading' | 'listening'>('reading')
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'expert'
  >('intermediate')
  const [duration, setDuration] = useState(60)
  const [passages, setPassages] = useState<Passage[]>([
    { ...blankPassage(), bulk: SAMPLE },
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = 'ILDIZmock — Bulk Test Entry'
  }, [])

  // Live parse for each passage so we show errors as the user types
  const parsed = useMemo(
    () => passages.map((p) => parseBulk(p.bulk)),
    [passages],
  )
  const totalQuestions = parsed.reduce(
    (s, r) => s + (r.ok ? r.questions.length : 0),
    0,
  )
  const anyParseError = parsed.some((r) => !r.ok)

  const updatePassage = (idx: number, patch: Partial<Passage>) => {
    setPassages((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    )
  }

  const sectionWord = module === 'listening' ? 'part' : 'passage'
  const maxSections = module === 'listening' ? 4 : 4

  const addPassage = () => {
    if (passages.length >= maxSections) {
      toast.info(`Up to ${maxSections} ${sectionWord}s.`)
      return
    }
    setPassages((prev) => [...prev, blankPassage()])
  }

  const removePassage = async (idx: number) => {
    const ok = await confirm({
      title: `Remove this ${sectionWord}?`,
      description: `Questions in this ${sectionWord} will be lost.`,
      confirmText: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setPassages((prev) => prev.filter((_, i) => i !== idx))
  }

  const uploadAudio = async (idx: number, file: File) => {
    updatePassage(idx, { audio_uploading: true })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post<{ path: string; url: string }>(
        '/admin/upload/audio',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      updatePassage(idx, {
        audio_file_path: res.data.path,
        audio_url: res.data.url,
      })
      toast.success('Audio uploaded')
    } catch {
      toast.error('Failed to upload audio')
    } finally {
      updatePassage(idx, { audio_uploading: false })
    }
  }

  const onSave = async () => {
    if (!name.trim()) {
      toast.error('Enter a test name.')
      return
    }
    if (anyParseError) {
      toast.error('Fix the parse errors first — see the red box under each passage.')
      return
    }
    if (totalQuestions === 0) {
      toast.error('At least one question is required.')
      return
    }
    for (const [i, p] of passages.entries()) {
      if (!p.title.trim() || !p.content.trim()) {
        toast.error(
          module === 'listening'
            ? `Part ${i + 1}: title and transcript are required.`
            : `Passage ${i + 1}: title and content are required.`,
        )
        return
      }
      if (module === 'listening' && !p.audio_file_path) {
        toast.error(`Part ${i + 1}: audio file is required for Listening.`)
        return
      }
    }

    setSaving(true)
    try {
      // Reading and Listening have different payload shapes in easy-create:
      //   reading  -> passages[]
      //   listening -> listening_parts[] (audio_file_path, transcript, ...)
      const sections = passages.map((p, i) => {
        const parseRes = parsed[i]
        if (!parseRes.ok) throw new Error('unreachable: parse error')
        if (module === 'listening') {
          return {
            part_number: i + 1,
            audio_file_path: p.audio_file_path,
            transcript: p.content,
            instructions: '',
            questions: parseRes.questions,
            // Reuse `title` as a hint inside instructions field-equivalent;
            // listening parts have no title field — fold into transcript header.
          }
        }
        return {
          part_number: i + 1,
          title: p.title,
          content: p.content,
          instructions: '',
          questions: parseRes.questions,
        }
      })

      const payload: Record<string, unknown> = {
        name,
        module,
        test_type: 'academic',
        difficulty,
        duration_minutes: duration,
        is_published: true,
      }
      if (module === 'listening') {
        payload.listening_parts = sections
      } else {
        payload.passages = sections
      }

      await api.post(`/center/${slug}/tests/easy-create/`, payload)
      toast.success(`Test created with ${totalQuestions} questions`)
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
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
      >
        <ArrowLeft size={14} /> Tests
      </Link>

      <PageHeader
        title="Bulk question entry"
        subtitle="Paste all questions in one textarea using a simple format. 5–10 minutes vs 30–45."
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
              disabled={saving || anyParseError || totalQuestions === 0}
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
              placeholder="e.g. Cambridge IELTS 19 — Reading Test 1"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </Field>
          <Field label="Module">
            <select
              value={module}
              onChange={(e) => {
                const m = e.target.value as typeof module
                setModule(m)
                // Sensible defaults per module — user can still override.
                if (m === 'listening' && duration === 60) setDuration(30)
                if (m === 'reading' && duration === 30) setDuration(60)
              }}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="reading">Reading</option>
              <option value="listening">Listening (audio + transcript)</option>
            </select>
          </Field>
          <Field label="Difficulty">
            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as typeof difficulty)
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </Field>
          <Field label="Duration (minutes)">
            <input
              type="number"
              min={5}
              max={180}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 60)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </Field>
        </div>
      </SurfaceCard>

      {/* Format reference */}
      <SurfaceCard className="mb-6 border-blue-100 bg-blue-50/40">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900">
          <Wand2 size={16} /> Format reference
        </h3>
        <ul className="space-y-1 text-xs text-blue-900">
          <li>
            <code className="rounded bg-white px-1">N|tfng|Question|TRUE</code>{' '}
            — also FALSE / NOT GIVEN
          </li>
          <li>
            <code className="rounded bg-white px-1">
              N|mcq|Question|A) opt1, B) opt2, C) opt3, D) opt4|B
            </code>
          </li>
          <li>
            <code className="rounded bg-white px-1">N|fill|Question with ___|answer</code>
          </li>
          <li>
            <code className="rounded bg-white px-1">N|short|Question|expected answer</code>
          </li>
          <li>Lines starting with <code>#</code> are comments.</li>
        </ul>
      </SurfaceCard>

      {/* Passages */}
      <div className="space-y-4">
        {passages.map((p, idx) => {
          const parseRes = parsed[idx]
          return (
            <SurfaceCard key={idx}>
              <div className="mb-4 flex items-start justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <BookOpen size={18} className="text-red-600" />
                  {module === 'listening' ? `Part ${idx + 1}` : `Passage ${idx + 1}`}
                  {parseRes.ok && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                      ✓ {parseRes.questions.length} questions parsed
                    </span>
                  )}
                </h2>
                {passages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePassage(idx)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>

              <div className="mb-4 space-y-4">
                {/* Audio upload — listening only */}
                {module === 'listening' && (
                  <Field
                    label={`Audio file (Part ${idx + 1}) — required for Listening`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-red-300 hover:bg-red-50">
                        {p.audio_uploading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Upload size={14} />
                        )}
                        {p.audio_uploading
                          ? 'Uploading…'
                          : p.audio_file_path
                            ? 'Replace audio'
                            : 'Upload audio (.mp3/.wav/.m4a)'}
                        <input
                          type="file"
                          accept="audio/*"
                          disabled={p.audio_uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) uploadAudio(idx, f)
                            e.target.value = ''
                          }}
                          className="hidden"
                        />
                      </label>
                      {p.audio_url && (
                        <div className="flex flex-1 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                          <Music size={14} className="text-emerald-700" />
                          <audio
                            src={p.audio_url}
                            controls
                            className="h-8 max-w-xs"
                          />
                        </div>
                      )}
                    </div>
                    {!p.audio_file_path && (
                      <p className="mt-1 text-xs text-amber-700">
                        ⚠ Listening parts need an audio file. Upload before saving.
                      </p>
                    )}
                  </Field>
                )}

                <Field
                  label={
                    module === 'listening' ? 'Part title (internal label)' : 'Passage title'
                  }
                >
                  <input
                    value={p.title}
                    onChange={(e) =>
                      updatePassage(idx, { title: e.target.value })
                    }
                    placeholder={
                      module === 'listening'
                        ? 'e.g. Hotel Booking Inquiry'
                        : 'e.g. The Origins of Coffee'
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </Field>
                <Field
                  label={
                    module === 'listening'
                      ? 'Audio transcript (full text — used for review and grading)'
                      : 'Passage content'
                  }
                >
                  <textarea
                    value={p.content}
                    onChange={(e) =>
                      updatePassage(idx, { content: e.target.value })
                    }
                    rows={6}
                    placeholder={
                      module === 'listening'
                        ? 'Paste the audio transcript…'
                        : 'Paste the passage text…'
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </Field>
                <Field
                  label={`Questions (one per line, "|" separated — ${
                    parseRes.ok ? parseRes.questions.length : 0
                  } parsed)`}
                >
                  <textarea
                    value={p.bulk}
                    onChange={(e) =>
                      updatePassage(idx, { bulk: e.target.value })
                    }
                    rows={12}
                    spellCheck={false}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </Field>
              </div>

              {!parseRes.ok && p.bulk.trim() && (
                <div className="mb-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{parseRes.error}</span>
                </div>
              )}
            </SurfaceCard>
          )
        })}

        {passages.length < maxSections && (
          <button
            type="button"
            onClick={addPassage}
            className={btnOutline + ' w-full justify-center'}
          >
            + Add {sectionWord} ({passages.length} / {maxSections})
          </button>
        )}
      </div>

      {saving && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          <Loader2 size={14} className="animate-spin" />
          Saving test…
        </div>
      )}
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
