import { AlertTriangle, ArrowLeft, FileUp, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  PageHeader,
  PageShell,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { api } from '@/lib/api'

interface ParsedQuestion {
  number: number
  type: 'fill_blank' | 'multiple_choice' | 'matching' | 'short_answer'
  text: string
  options: string[]
  answer: string | string[]
}

interface ParsedPart {
  part_number: number
  title: string
  raw_text: string
  questions: ParsedQuestion[]
}

interface ParseResponse {
  parts: ParsedPart[]
  warnings: string[]
}

const TYPE_LABEL: Record<string, string> = {
  fill_blank: 'Fill in the blank',
  multiple_choice: 'Multiple Choice',
  matching: 'Matching',
  short_answer: 'Short Answer',
}

export default function ListeningPdfImportPage() {
  const { slug } = useParams<{ slug: string }>()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const onPickFile = (f: File | null) => {
    setError('')
    setPdfFile(f)
  }

  const upload = async () => {
    if (!pdfFile || !slug) return
    setError('')
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('pdf', pdfFile)
      const r = await api.post<ParseResponse>(
        `/center/${slug}/tests/parse-pdf/`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setParsed(r.data)
      setStep(2)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'PDF parse qilib bo\'lmadi')
    } finally {
      setParsing(false)
    }
  }

  const updateQuestion = (
    partIdx: number,
    qIdx: number,
    field: keyof ParsedQuestion,
    value: string | string[],
  ) => {
    if (!parsed) return
    const next = { ...parsed, parts: parsed.parts.map((p) => ({ ...p })) }
    const part = next.parts[partIdx]
    part.questions = part.questions.map((q, i) =>
      i === qIdx ? { ...q, [field]: value as never } : q,
    )
    setParsed(next)
  }

  return (
    <PageShell maxWidth="max-w-5xl">
      <Link
        to={`/${slug}/admin/tests`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Testlar
      </Link>

      <PageHeader
        title="Listening test — PDF import"
        subtitle="Automatically extract questions from Cambridge IELTS or similar PDFs"
      />

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 text-xs">
        <Step n={1} label="Upload PDF" active={step >= 1} done={step > 1} />
        <Divider />
        <Step n={2} label="Edit" active={step >= 2} done={step > 2} />
        <Divider />
        <Step n={3} label="Audio + save" active={step >= 3} done={false} />
      </div>

      {/* STEP 1: Upload */}
      {step === 1 && (
        <SurfaceCard>
          <h3 className="mb-3 text-base font-semibold text-slate-900">
            1. Upload the PDF file
          </h3>

          <div
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              pdfFile
                ? 'border-emerald-300 bg-emerald-50/40'
                : 'border-slate-300 hover:border-red-400 hover:bg-brand-50/30'
            }`}
          >
            <FileUp className="h-10 w-10 text-slate-400" />
            {pdfFile ? (
              <>
                <div className="font-semibold text-slate-900">{pdfFile.name}</div>
                <div className="text-xs text-slate-500">
                  {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </>
            ) : (
              <>
                <div className="font-medium text-slate-700">
                  Choose a PDF file or drag it here
                </div>
                <div className="text-xs text-slate-500">
                  Cambridge IELTS, DiyorBek IELTS yoki shunga o'xshash format · Maks. 20 MB
                </div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-cta-100 bg-cta-50 p-3 text-sm text-cta-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={upload}
              disabled={!pdfFile || parsing}
              className={btnPrimary + ' disabled:opacity-50'}
            >
              {parsing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Parse qilinyapti...
                </>
              ) : (
                <>
                  <Upload size={14} /> Parse
                </>
              )}
            </button>
          </div>
        </SurfaceCard>
      )}

      {/* STEP 2: Review & edit */}
      {step === 2 && parsed && (
        <div className="space-y-4">
          {parsed.warnings.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <ul className="list-disc pl-5">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.parts.length === 0 ? (
            <SurfaceCard>
              <p className="text-center text-slate-500">
                PDF dan savollar ajratib bo'lmadi. Faylni tekshiring.
              </p>
            </SurfaceCard>
          ) : (
            parsed.parts.map((part, pi) => (
              <SurfaceCard key={pi}>
                <h3 className="mb-3 flex items-center justify-between text-base font-semibold text-slate-900">
                  <span>
                    Part {part.part_number}{' '}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {part.title}
                    </span>
                  </span>
                  <span className="text-xs font-normal text-slate-500">
                    {part.questions.length} ta savol
                  </span>
                </h3>

                {part.questions.length === 0 ? (
                  <p className="text-sm text-slate-500">No questions found in this part.</p>
                ) : (
                  <div className="space-y-3">
                    {part.questions.map((q, qi) => (
                      <div
                        key={qi}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="mb-2 flex items-center gap-3 text-xs">
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono font-bold text-white">
                            #{q.number}
                          </span>
                          <select
                            value={q.type}
                            onChange={(e) =>
                              updateQuestion(pi, qi, 'type', e.target.value)
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            {Object.entries(TYPE_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={q.text}
                          onChange={(e) =>
                            updateQuestion(pi, qi, 'text', e.target.value)
                          }
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                        />
                        {q.type === 'multiple_choice' && q.options.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {q.options.map((opt, oi) => (
                              <input
                                key={oi}
                                value={opt}
                                onChange={(e) => {
                                  const next = [...q.options]
                                  next[oi] = e.target.value
                                  updateQuestion(pi, qi, 'options', next)
                                }}
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                placeholder={`${String.fromCharCode(65 + oi)}.`}
                              />
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="text-slate-500">Correct answer:</span>
                          <input
                            value={
                              Array.isArray(q.answer) ? q.answer.join(', ') : q.answer
                            }
                            onChange={(e) =>
                              updateQuestion(pi, qi, 'answer', e.target.value)
                            }
                            placeholder="answer..."
                            className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SurfaceCard>
            ))
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={btnOutline}
            >
              ← Orqaga
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={parsed.parts.length === 0}
              className={btnPrimary + ' disabled:opacity-50'}
            >
              Upload audioga →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Audio + Save (placeholder) */}
      {step === 3 && (
        <SurfaceCard>
          <h3 className="mb-2 text-base font-semibold text-slate-900">
            3. Audio file va saqlash
          </h3>
          <p className="mb-4 text-sm text-slate-600">
            Audio upload and test save will be completed in the next stage
            ishga tushiriladi. Hozircha parse qilingan ma'lumotlarni JSON
            sifatida ko'rishingiz mumkin.
          </p>

          <details className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-semibold">
              Parse qilingan JSON
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </details>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className={btnOutline}
            >
              ← Edit
            </button>
            <button
              type="button"
              disabled
              className={btnPrimary + ' opacity-50 cursor-not-allowed'}
              title="This feature will be finalized in the next stage"
            >
              Save (coming soon)
            </button>
          </div>
        </SurfaceCard>
      )}
    </PageShell>
  )
}

function Step({
  n,
  label,
  active,
  done,
}: {
  n: number
  label: string
  active: boolean
  done: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? 'bg-emerald-600 text-white'
            : active
              ? 'bg-brand-600 text-white'
              : 'bg-slate-200 text-slate-500'
        }`}
      >
        {done ? '✓' : n}
      </div>
      <span
        className={`font-semibold uppercase tracking-wider ${
          active ? 'text-slate-900' : 'text-slate-400'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

function Divider() {
  return <div className="h-px w-8 bg-slate-300" />
}
