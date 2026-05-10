import { Clock, Loader2, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useConfirm } from '@/components/ConfirmDialog'
import { PdfPagesViewer } from '@/components/test-runner/PdfPagesViewer'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import { Timer } from './Timer'

type AudioUrls = {
  part1?: string
  part2?: string
  part3?: string
  part4?: string
}

interface SectionPayload {
  section: 'listening' | 'reading'
  kind: 'pdf'
  test: { id: string; name: string; module: string; duration_minutes: number }
  /** HOTFIX — yangi: PDF sahifa rasmlari (PNG URL'lari). Bo'sh bo'lsa
   *  pdf_url'ga fallback. */
  pdf_pages?: string[]
  pdf_page_count?: number
  /** Backfill qilinmagan eski testlar uchun fallback. */
  pdf_url?: string
  audio_urls: AudioUrls
  answer_key_questions: number[]
  total_questions: number
  seconds_remaining: number
}

/**
 * Mock session ichida PDFTest bilan ishlash uchun bo'lim.
 * Listening yoki Reading bo'lishi mumkin — PDF iframe + (listening uchun)
 * play-once audio + javoblar paneli + submit. UI logikasi
 * `student/PDFTestTaking.tsx` bilan bir xil, lekin mock submit endpoint'iga
 * yuboradi.
 */
export function MockPdfSection({
  bsid,
  section,
  name,
  secondsRemaining,
  onSubmit,
}: {
  bsid: string
  section: 'listening' | 'reading'
  name: string
  secondsRemaining: number
  onSubmit: () => void
}) {
  const confirm = useConfirm()
  const [data, setData] = useState<SectionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [currentPart, setCurrentPart] = useState(1)
  const [audioStarted, setAudioStarted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<SectionPayload>(`/mock/section/${bsid}/`)
      .then((r) => {
        if (cancelled) return
        setData(r.data)
        const init: Record<string, string> = {}
        const qs = r.data.answer_key_questions?.length
          ? r.data.answer_key_questions
          : Array.from({ length: r.data.total_questions }, (_, i) => i + 1)
        for (const q of qs) init[String(q)] = ''
        setAnswers(init)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load test')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bsid])

  // Audio src o'zgarsa qayta yuklash
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load()
      setAudioStarted(false)
    }
  }, [currentPart])

  const submitNow = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      try {
        const res = await api.post(`/mock/submit/${section}/${bsid}/`, {
          answers,
        })
        if (auto) {
          toast.success(`Time up. Band: ${res.data.band}`)
        } else {
          toast.success(
            `Submitted. Band: ${res.data.band} (${res.data.correct}/${res.data.total})`,
          )
        }
        onSubmit()
      } catch (e) {
        submittedRef.current = false
        const err = e as { response?: { data?: { detail?: string } } }
        toast.error(err.response?.data?.detail ?? 'Failed to submit')
      } finally {
        setSubmitting(false)
      }
    },
    [answers, bsid, section, onSubmit],
  )

  const handleAutoSubmit = () => {
    if (!submittedRef.current) submitNow(true)
  }

  const handlePlay = () => {
    if (!audioRef.current) return
    audioRef.current
      .play()
      .then(() => {
        setAudioStarted(true)
        toast.success(`Part ${currentPart} audio started`)
      })
      .catch(() => {
        toast.error('Audio play blocked. Click again.')
      })
  }

  const handleAudioEnded = () => {
    if (!data) return
    const next = `part${currentPart + 1}` as keyof AudioUrls
    if (currentPart < 4 && data.audio_urls[next]) {
      setTimeout(() => {
        setCurrentPart((p) => p + 1)
      }, 2000)
    }
  }

  const handleSubmit = async () => {
    const ok = await confirm({
      title: `Submit ${section}?`,
      description: 'Once submitted you cannot retake this section.',
      confirmText: 'Submit',
      tone: 'danger',
    })
    if (!ok) return
    await submitNow(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        <Loader2 className="mr-2 animate-spin" /> Loading…
      </div>
    )
  }

  if (!data) {
    return <div className="p-8 text-center text-slate-500">Test not found</div>
  }

  const currentAudioUrl = data.audio_urls[`part${currentPart}` as keyof AudioUrls]

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold capitalize">{section} Test</h1>
            <p className="text-xs text-slate-500">{name}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-bold tabular-nums text-slate-800">
            <Clock size={16} />
            <Timer initialSeconds={secondsRemaining} onExpire={handleAutoSubmit} />
          </div>
        </div>

        {section === 'listening' && (
          <div className="border-t border-amber-200 bg-amber-50 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((p) => (
                  <div
                    key={p}
                    className={
                      'flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold transition-colors ' +
                      (p === currentPart
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200 text-slate-600')
                    }
                  >
                    {p}
                  </div>
                ))}
              </div>
              {!audioStarted && currentAudioUrl && (
                <button
                  type="button"
                  onClick={handlePlay}
                  className="inline-flex items-center gap-2 rounded-xl bg-cta-500 px-4 py-2 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600"
                >
                  <Play size={16} /> Play Part {currentPart}
                </button>
              )}
              {!currentAudioUrl && (
                <span className="text-sm font-semibold text-amber-700">
                  No audio for this part.
                </span>
              )}
            </div>
            {currentAudioUrl && (
              <audio
                ref={audioRef}
                src={currentAudioUrl}
                onEnded={handleAudioEnded}
                className="hidden"
              />
            )}
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-3/5 border-r border-slate-200 bg-slate-100">
          {/* HOTFIX — Brave/Chrome shield iframe'ni bloklayotgani uchun
              PDF endi PNG sahifa rasmlari sifatida ko'rsatiladi. Backfill
              qilinmagan eski testlarda pdf_pages bo'sh bo'lib, eski PDF URL
              fallback'i ishlaydi. */}
          {data.pdf_pages && data.pdf_pages.length > 0 ? (
            <PdfPagesViewer pages={data.pdf_pages} className="h-full" />
          ) : data.pdf_url ? (
            <object
              data={`${data.pdf_url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
              type="application/pdf"
              className="h-full w-full"
            >
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-slate-600">
                  PDF hali rasm sahifalarga aylantirilmagan. Server admin
                  `python manage.py convert_existing_pdfs` ishga tushirsa,
                  bu test ham galereya ko'rinishida ochiladi.
                </p>
                <a
                  href={data.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
                >
                  PDF'ni yangi oynada ochish
                </a>
              </div>
            </object>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              Bu bo'lim uchun kontent mavjud emas.
            </div>
          )}
        </div>
        <div className="w-2/5 overflow-auto bg-slate-50 p-6">
          <h2 className="mb-4 text-lg font-extrabold text-slate-900">Your Answers</h2>
          <div className="space-y-2">
            {Object.keys(answers).map((q) => (
              <div key={q} className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">
                  {q}
                </div>
                <input
                  type="text"
                  value={answers[q]}
                  onChange={(e) =>
                    setAnswers((p) => ({ ...p, [q]: e.target.value }))
                  }
                  placeholder="Your answer"
                  className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-sm transition-all placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-100"
                  disabled={submitting}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-cta-500 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? 'Submitting…' : `Submit ${section}`}
          </button>
        </div>
      </div>
    </div>
  )
}
