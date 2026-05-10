import { Clock, Loader2, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { useConfirm } from '@/components/ConfirmDialog'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type AudioUrls = {
  part1?: string
  part2?: string
  part3?: string
  part4?: string
}

type PDFTest = {
  id: string
  name: string
  module: 'reading' | 'listening'
  total_questions: number
  duration_minutes: number
  pdf_url: string
  audio_urls: AudioUrls
  answer_key_questions?: number[]
}

type SubmitResult = {
  score: number
  total_questions: number
  percentage: number
  results: Record<string, boolean>
}

export default function PDFTestTaking() {
  const { testId } = useParams<{ testId: string }>()
  const confirm = useConfirm()

  const [test, setTest] = useState<PDFTest | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [startTime] = useState(Date.now())
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const [currentPart, setCurrentPart] = useState(1)
  const [audioStarted, setAudioStarted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const submittedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await api.get(`/pdf-tests/${testId}/`)
        if (cancelled) return
        const t: PDFTest = res.data.test
        setTest(t)
        const init: Record<string, string> = {}
        const qs = t.answer_key_questions?.length
          ? t.answer_key_questions
          : Array.from({ length: t.total_questions }, (_, i) => i + 1)
        for (const q of qs) init[String(q)] = ''
        setAnswers(init)
        setTimeLeft(t.duration_minutes * 60)
      } catch {
        toast.error('Failed to load test')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [testId])

  const handleAnswer = (q: string, v: string) => setAnswers((p) => ({ ...p, [q]: v }))

  const submitNow = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      const timeTaken = Math.floor((Date.now() - startTime) / 1000)
      try {
        const res = await api.post(`/pdf-tests/${testId}/submit/`, {
          answers,
          time_taken_seconds: timeTaken,
        })
        setResult({
          score: res.data.score,
          total_questions: res.data.total_questions,
          percentage: res.data.percentage,
          results: res.data.results ?? {},
        })
        toast.success(
          auto
            ? `Time up! Score: ${res.data.score}/${res.data.total_questions}`
            : `Score: ${res.data.score}/${res.data.total_questions}`,
        )
      } catch (e) {
        submittedRef.current = false
        const err = e as { response?: { data?: { error?: string } } }
        toast.error(err.response?.data?.error ?? 'Failed to submit')
      } finally {
        setSubmitting(false)
      }
    },
    [answers, startTime, testId],
  )

  // Reload <audio> element when src changes between parts (Fix #10)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load()
      setAudioStarted(false)
    }
  }, [currentPart])

  // Countdown + auto-submit (Fix #9)
  useEffect(() => {
    if (timeLeft === null || result || submittedRef.current) return
    if (timeLeft <= 0) {
      submitNow(true)
      return
    }
    const t = setInterval(() => {
      setTimeLeft((prev) => (prev === null ? null : prev - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [timeLeft, result, submitNow])

  const handlePlay = () => {
    if (!audioRef.current) return
    audioRef.current.play().then(() => {
      setAudioStarted(true)
      toast.success(`Part ${currentPart} audio started`)
    }).catch(() => {
      toast.error('Audio play blocked. Click again.')
    })
  }

  const handleAudioEnded = () => {
    if (!test) return
    if (currentPart < 4 && test.audio_urls[`part${currentPart + 1}` as keyof AudioUrls]) {
      setTimeout(() => {
        setCurrentPart((p) => p + 1)
      }, 2000)
    }
  }

  const handleSubmit = async () => {
    const ok = await confirm({
      title: 'Submit test?',
      description: 'Once submitted you cannot retake this test.',
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

  if (!test) {
    return <div className="p-8 text-center text-slate-500">Test not found</div>
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div
          className="rounded-[24px] p-10 text-center text-white"
          style={{ background: 'var(--gradient-hero)', boxShadow: 'var(--shadow-lg)' }}
        >
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight">Test Submitted</h1>
          <p className="text-lg text-white/90">
            Score: <span className="font-extrabold">{result.score}</span> /{' '}
            {result.total_questions} ({result.percentage.toFixed(1)}%)
          </p>
        </div>
        <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-8">
          {Object.entries(result.results).map(([q, ok]) => (
            <div
              key={q}
              className={
                'rounded-lg px-2 py-2 text-center text-sm font-bold ' +
                (ok
                  ? 'bg-teal-50 text-teal-700'
                  : 'bg-cta-50 text-cta-700')
              }
            >
              {q}: {ok ? '✓' : '✗'}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const currentAudioUrl = test.audio_urls[`part${currentPart}` as keyof AudioUrls]
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }
  const lowTime = timeLeft !== null && timeLeft <= 60

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar — slate-950 like the test runner */}
      <div
        className="flex items-center justify-between px-6 py-3.5 text-white"
        style={{ background: 'var(--brand-950)' }}
      >
        <h1 className="text-base font-extrabold tracking-tight">{test.name}</h1>
        {timeLeft !== null && (
          <div
            className={
              'inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-extrabold tabular-nums ' +
              (lowTime ? 'animate-pulse text-white' : 'text-white')
            }
            style={{
              background: lowTime ? 'var(--cta-500)' : 'rgba(255,255,255,0.15)',
              fontFamily: 'var(--font-mono)',
            }}
            title="Time left"
          >
            <Clock size={16} /> {fmtTime(timeLeft)}
          </div>
        )}
      </div>

      {test.module === 'listening' && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((p) => (
                <div
                  key={p}
                  className={
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold transition-colors ' +
                    (p === currentPart ? 'text-white' : 'bg-slate-200 text-slate-600')
                  }
                  style={p === currentPart ? { background: 'var(--brand-600)' } : undefined}
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
              <span className="text-sm font-semibold text-[#B45309]">
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

      <div className="flex flex-1 overflow-hidden">
        <div className="w-3/5 border-r border-slate-200 bg-slate-100">
          {/*
            <object> brauzerning ichki PDF viewer'iga uzatadi va Brave/Chrome
            shield'lar bloklamaydi (iframe bloklanardi). Yuklanmasa fallback.
          */}
          <object
            data={`${test.pdf_url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
            type="application/pdf"
            className="h-full w-full"
          >
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-slate-600">
                PDF brauzeringizda ko'rinmayapti. Brave/Chrome shield'lar
                yoqilgan bo'lishi mumkin.
              </p>
              <a
                href={test.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
              >
                PDF'ni yangi oynada ochish
              </a>
            </div>
          </object>
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
                  onChange={(e) => handleAnswer(q, e.target.value)}
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
            className="mt-6 w-full rounded-xl bg-cta-500 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(239,68,68,0.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? 'Submitting…' : 'Submit Test'}
          </button>
        </div>
      </div>
    </div>
  )
}
