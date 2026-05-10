import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Headphones, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '@/lib/api'

import { FullscreenGate } from './FullscreenGate'
import { QuestionRenderer, type Question } from './QuestionRenderer'
import { Timer } from './Timer'

interface ListeningPart {
  id: number
  part_number: number
  audio_url: string | null
  audio_duration_seconds: number
  instructions: string
  questions: Question[]
}

interface SectionDataError {
  detail: string
  error_code?: 'NO_PARTS' | 'MISSING_AUDIO'
}

type AudioState = 'ready' | 'playing' | 'finished'

/**
 * FINAL FIX — Single Audio, Single START Button.
 *
 * Admin bitta MP3 fayl yuklaydi (Cambridge IELTS uslubida 4 ta part
 * bir fayl ichida). Talabaga:
 *   - Bitta blue "▶ START Listening" tugmasi tepada.
 *   - Tagida — 40 ta savol Part 1–4 bo'yicha guruhlangan holda.
 *   - START bosilgach: tugma yo'qoladi, audio o'ynay boshlaydi, hamma
 *     40 input ochiladi.
 *   - Audio tugagach: "✓ All audio finished" + Submit tugmasi.
 *
 * State: 3 ta — 'ready' | 'playing' | 'finished'. Yagona haqiqat
 * manbai. Pending/auto-advance/per-part state-machine yo'q.
 *
 * Refresh-safety: backend audio_finished_parts yoki audio_played_parts
 * birortasida har qanday element bo'lsa, "audio session tugagan" deb
 * hisoblaymiz va to'g'ridan 'finished' holatda ochamiz (interrupted
 * mid-play counts as finished — IELTS qoidasi).
 */
export function ListeningSection({
  bsid,
  name,
  secondsRemaining,
  onSubmit,
}: {
  bsid: string
  name: string
  secondsRemaining: number
  onSubmit: () => void
}) {
  const [parts, setParts] = useState<ListeningPart[]>([])
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null)
  const [testName, setTestName] = useState<string>('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [audioState, setAudioState] = useState<AudioState>('ready')
  const [starting, setStarting] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [configError, setConfigError] = useState<SectionDataError | null>(null)
  // FINAL FIX — refresh paytida 'playing' bo'lib qolgan, lekin browser
  // audio'ni autoplay qila olmaydigan holat. Talaba submit qila olishi
  // uchun escape hatch kerak.
  const [audioInterrupted, setAudioInterrupted] = useState(false)

  const submittedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  // Per-input autosave uchun debounce timer (har savol uchun alohida).
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Submit tugagandan keyin save chaqirilmasligi uchun.
  const saveLockedRef = useRef(false)

  // ── Load section data ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => {
        if (cancelled) return
        const ps: ListeningPart[] = r.data.listening_parts || []
        setParts(ps)
        const testAudio: string | null = r.data.test?.audio_url
          ?? (ps.find((p) => p.audio_url)?.audio_url ?? null)
        setTestAudioUrl(testAudio)
        setTestName(r.data.test?.name || '')

        const played: number[] = Array.isArray(r.data.audio_played_parts)
          ? r.data.audio_played_parts : []
        const finished: number[] = Array.isArray(r.data.audio_finished_parts)
          ? r.data.audio_finished_parts : []
        // Restore audio state from backend — three-tier spec logic:
        //   finished marker  → 'finished'
        //   started only     → 'playing' (resume best-effort; flag
        //                      interrupted=true so submit is allowed)
        //   neither          → 'ready'
        if (finished.length > 0) {
          setAudioState('finished')
        } else if (played.length > 0) {
          setAudioState('playing')
          setAudioInterrupted(true)
        } else {
          setAudioState('ready')
        }

        // Sync answers from backend on load — refresh paytida talaba
        // yozgan javoblar tiklanadi (per-input autosave orqali saqlangan).
        if (r.data.answers && typeof r.data.answers === 'object') {
          setAnswers(r.data.answers as Record<string, unknown>)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const errData = (err as { response?: { data?: SectionDataError } })
          ?.response?.data
        setConfigError(
          errData && (errData.error_code || errData.detail)
            ? errData
            : { detail: 'Could not load the Listening test. Please refresh.' },
        )
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bsid])

  // ── Audio event listeners (spec-minimal: 4 listeners) ─────────────
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onMeta = () => setDuration(el.duration || 0)
    const onTime = () => setCurrentTime(el.currentTime)
    const onEnded = () => {
      setAudioState('finished')
      setAudioInterrupted(false)
      // Hamma part'larni "finished" deb belgilaymiz (bir fayl, hammasi
      // tugadi). Best-effort POST — yangi endpoint yo'q bo'lsa eski'ga
      // fallback (refresh-safety).
      for (const p of parts) {
        api
          .post(`/mock/audio-finished/${bsid}/`, { part_order: p.part_number })
          .catch(() => {
            api
              .post(`/mock/audio-played/${bsid}/`, { part_order: p.part_number })
              .catch(() => { /* ignore */ })
          })
      }
    }
    const onErr = () => {
      const err = el.error
      const detail = !err
        ? 'Unknown audio error.'
        : err.code === 1 ? 'Audio loading aborted.'
          : err.code === 2 ? 'Network error while loading audio.'
            : err.code === 3 ? 'Audio file is corrupted.'
              : err.code === 4 ? 'Audio format not supported by your browser.'
                : 'Unknown audio error.'
      console.error('Audio element error:', err, 'src:', el.src)
      setAudioError(detail)
      // Don't auto-retry — let user click START again
      setAudioState('ready')
      setStarting(false)
    }

    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onErr)
    return () => {
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onErr)
    }
  }, [bsid, parts])

  // ── beforeunload guard ─────────────────────────────────────────────
  useEffect(() => {
    if (audioState !== 'playing') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [audioState])

  // ── THE SINGLE START HANDLER ──────────────────────────────────────
  // CRITICAL: audio.play() must be called SYNCHRONOUSLY inside the
  // click handler so the browser keeps the user gesture. Awaiting
  // BEFORE the play() call can lose the gesture on Safari/WebKit and
  // cause NotAllowedError. The spec pattern: capture the promise
  // first, do optimistic UI + POST, THEN await the promise.
  //
  // Tradeoff: if .play() ultimately rejects (autoplay block, decode
  // error), the "started" POST has already landed. Recovery: refresh
  // restores the user to audioInterrupted state — they can mark audio
  // complete and submit anyway. That state machine is intentional.
  const handleStart = async () => {
    if (starting) return                    // double-click guard
    const el = audioRef.current
    if (!el) {
      setAudioError('Audio player not loaded.')
      return
    }
    if (!el.src || el.src.endsWith('null') || el.src.endsWith('undefined')) {
      setAudioError(
        'Audio file is missing. Ask your admin to re-upload it.',
      )
      return
    }
    setStarting(true)
    setAudioError(null)
    try {
      // Direct play() in click handler — user gesture preserved
      const playPromise = el.play()
      setAudioState('playing')
      // Mark "started" for all parts (single-audio mode → all 4 at once,
      // refresh-safety).
      for (const p of parts) {
        api
          .post(`/mock/audio-played/${bsid}/`, { part_order: p.part_number })
          .catch(() => { /* best-effort */ })
      }
      if (playPromise !== undefined) await playPromise
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string }
      const detail
        = e?.name === 'NotAllowedError'
          ? 'Browser blocked audio. Click START again.'
          : e?.name === 'NotSupportedError'
            ? 'Audio format not supported.'
            : e?.name === 'AbortError'
              ? 'Audio loading was interrupted. Check your internet.'
              : e?.message || 'Unknown error.'
      console.error('Audio play failed:', err, 'src:', el.src,
        'readyState:', el.readyState)
      setStarting(false)                    // rollback for retry
      setAudioError(detail)
      setAudioState('ready')
    }
  }

  // ── Save answer (tanstack useMutation + 600ms debounce per qid) ──
  // Spec uses useMutation; debounce kept because mutate() fires
  // immediately and ~800 POSTs/test would crush the backend.
  const saveAnswer = useMutation({
    mutationFn: ({ qid, ans }: { qid: string; ans: unknown }) =>
      api.post(`/mock/listening-answers/${bsid}/`, {
        question_id: qid, answer: ans,
      }),
    // Silent on error — submit batch fallback rescues any lost answers.
  })

  const handleAnswer = (qid: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
    if (saveLockedRef.current) return
    const existing = saveTimersRef.current[qid]
    if (existing) clearTimeout(existing)
    saveTimersRef.current[qid] = setTimeout(() => {
      saveAnswer.mutate({ qid, ans: value })
    }, 600)
  }

  // Cleanup: komponent unmount bo'lganda saqlanmagan timer'larni
  // tozalaymiz (yo'qotilmasligi uchun darrov flush ham qilamiz).
  useEffect(() => {
    return () => {
      const timers = saveTimersRef.current
      for (const k of Object.keys(timers)) {
        clearTimeout(timers[k])
      }
    }
  }, [])

  // ── Submit handler ─────────────────────────────────────────────────
  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    saveLockedRef.current = true                  // stop autosaves
    // Saqlanmagan pending timer'larni darrov flush qilamiz emas, balki
    // submit'ga to'liq answers obyektini berib yuborayotganimiz uchun
    // ularni shunchaki bekor qilamiz.
    for (const k of Object.keys(saveTimersRef.current)) {
      clearTimeout(saveTimersRef.current[k])
    }
    saveTimersRef.current = {}
    setSubmitting(true)
    try {
      await api.post(`/mock/submit/listening/${bsid}/`, { answers })
      onSubmit()
    } catch (err) {
      submittedRef.current = false
      saveLockedRef.current = false               // allow saves to resume
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      alert(detail
        || 'Error submitting Listening. Check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmit = () => {
    if (!submittedRef.current) submit()
  }

  // ── Group questions by part_number for display ────────────────────
  // Spec form: Record<number, Question[]> with 1..4 pre-initialised.
  // Per-part instructions tracked in a parallel map so the render can
  // show them without the nested wrapper object.
  const questionsByPart = useMemo(() => {
    if (!parts || parts.length === 0) return {} as Record<number, Question[]>
    const groups: Record<number, Question[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const p of parts) {
      const pn = p.part_number || 1
      if (!groups[pn]) groups[pn] = []
      for (const q of p.questions || []) {
        groups[pn].push(q)
      }
    }
    return groups
  }, [parts])

  const instructionsByPart = useMemo(() => {
    const m: Record<number, string> = {}
    for (const p of parts) {
      if (p.instructions) m[p.part_number] = p.instructions
    }
    return m
  }, [parts])

  // ── Render guards ──────────────────────────────────────────────────
  if (loading) return <div className="p-6 text-slate-500">Loading…</div>

  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border-2 border-rose-300 bg-rose-50 p-8 text-center shadow-sm">
          <h2 className="mb-2 text-xl font-bold text-rose-800">
            Listening test configuration error
          </h2>
          <p className="text-sm text-rose-700">{configError.detail}</p>
          <p className="mt-4 text-xs text-slate-500">
            Admin: open this test in the Tests page → edit → upload an MP3
            covering all 4 parts (attach to Part 1).
          </p>
        </div>
      </div>
    )
  }

  if (parts.length === 0) {
    return (
      <div className="p-6 text-slate-500">
        No parts found in the Listening test.
      </div>
    )
  }

  // 4-segment progress: each part is 25% of the total duration.
  const ratio = duration > 0 ? currentTime / duration : 0
  const currentPlayingPart
    = audioState !== 'playing' || !duration ? null
      : ratio < 0.25 ? 1
        : ratio < 0.50 ? 2
          : ratio < 0.75 ? 3
            : 4

  const fmt = (s: number) => {
    if (!isFinite(s) || s <= 0) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const inputsLocked = audioState === 'ready'

  return (
    <FullscreenGate title="Listening Test">
      <div className="flex h-screen flex-col bg-slate-50">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-lg font-bold">Listening Test</h1>
              <p className="text-xs text-slate-500">
                {testName || name}
              </p>
            </div>
            <Timer initialSeconds={secondsRemaining} onExpire={handleAutoSubmit} />
          </div>

          {/* Status banner + 4-segment progress bar */}
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Headphones className="h-4 w-4 text-brand-500" />
                {audioState === 'ready' && 'Ready to start'}
                {audioState === 'playing' && !audioInterrupted && (
                  <>
                    <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-brand-600" />
                    {`Playing… Part ${currentPlayingPart ?? 1}  ·  ${fmt(currentTime)} / ${fmt(duration)}`}
                  </>
                )}
                {audioState === 'playing' && audioInterrupted && (
                  <span className="text-amber-800">
                    Audio interrupted — review &amp; submit answers
                  </span>
                )}
                {audioState === 'finished' && (
                  <span className="text-emerald-700">All audio finished</span>
                )}
              </div>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((p) => {
                  const segStart = (p - 1) * 0.25
                  const segEnd = p * 0.25
                  let fill = 0
                  if (audioState === 'finished') fill = 1
                  else if (ratio >= segEnd) fill = 1
                  else if (ratio > segStart) fill = (ratio - segStart) / 0.25
                  return (
                    <div
                      key={p}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
                    >
                      <div
                        className="h-full bg-brand-500 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, fill * 100))}%` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex gap-1 text-[11px] text-slate-500">
                <div className="flex-1 text-center">Part 1</div>
                <div className="flex-1 text-center">Part 2</div>
                <div className="flex-1 text-center">Part 3</div>
                <div className="flex-1 text-center">Part 4</div>
              </div>
              <p className="mt-2 text-[11px] italic text-slate-500">
                Just like real IELTS: the audio plays once continuously
                through all 4 parts. You can&apos;t pause, rewind, or replay.
              </p>
            </div>
          </div>
        </header>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">

            {/* ─── Single START card (only while 'ready') ─── */}
            {audioState === 'ready' && (
              <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-8 text-center">
                <div className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Headphones className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-slate-900">
                  Ready to play Listening
                </h2>
                <p className="mb-6 text-sm text-slate-600">
                  Click START below. The audio will play all 4 parts
                  continuously without stopping. You can&apos;t pause,
                  rewind, or replay — just like the real IELTS.
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={starting}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-10 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play className="h-5 w-5 fill-current" />
                  START Listening
                </button>
                {audioError && (
                  <div className="mt-4 rounded-lg border-2 border-rose-300 bg-rose-50 p-4 text-left">
                    <p className="text-sm font-medium text-rose-800">
                      {audioError}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleStart}
                        className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                      >
                        Try again
                      </button>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Reload page
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Playing banner ─── */}
            {audioState === 'playing' && !audioInterrupted && (
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-center">
                <p className="text-sm font-semibold text-amber-800">
                  ⚠️ Audio cannot be paused, rewound, or replayed.
                </p>
              </div>
            )}
            {audioState === 'playing' && audioInterrupted && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-center">
                <p className="text-sm font-semibold text-amber-900">
                  ⚠️ Audio was interrupted (page reload)
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  The browser doesn&apos;t allow audio to resume automatically
                  after a refresh. Your saved answers are restored — finish
                  entering them and submit when ready.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAudioState('finished')
                    setAudioInterrupted(false)
                  }}
                  className="mt-3 rounded-full bg-emerald-600 px-5 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
                >
                  Mark audio complete &amp; review answers
                </button>
              </div>
            )}

            {/* ─── Finished banner ─── */}
            {audioState === 'finished' && (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-2 text-lg font-bold text-emerald-800">
                  All audio finished
                </h2>
                <p className="mt-1 text-sm text-emerald-700">
                  Review your answers and submit when ready.
                </p>
              </div>
            )}

            {/* ─── Questions: all parts stacked, all 40 visible ─── */}
            <div className="relative">
              {inputsLocked && (
                <div className="mb-4 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800">
                  ▲ Click &quot;START Listening&quot; above. Questions will
                  unlock automatically.
                </div>
              )}
              {[1, 2, 3, 4].map((pn) => {
                const qs = questionsByPart[pn] || []
                if (qs.length === 0) return null
                const firstQ = qs[0]?.question_number ?? qs[0]?.order
                const lastQ = qs[qs.length - 1]?.question_number
                  ?? qs[qs.length - 1]?.order
                const instructions = instructionsByPart[pn]
                return (
                  <fieldset
                    key={pn}
                    disabled={inputsLocked}
                    className={`mb-6 rounded-2xl border bg-white p-6 shadow-sm ${
                      inputsLocked ? 'opacity-50' : ''
                    }`}
                  >
                    <h2 className="text-lg font-bold">
                      PART {pn} — Questions {firstQ}–{lastQ}
                    </h2>
                    {instructions && (
                      <p className="mb-3 mt-1 text-sm text-slate-600">
                        {instructions}
                      </p>
                    )}
                    <div className="space-y-4">
                      {qs.map((q, i) => (
                        <QuestionRenderer
                          key={q.id}
                          question={q}
                          index={i}
                          value={answers[String(q.id)]}
                          onChange={(v) => handleAnswer(String(q.id), v)}
                        />
                      ))}
                    </div>
                  </fieldset>
                )
              })}
            </div>

            {/* ─── Submit (when audio finished, OR interrupted) ─── */}
            {(audioState === 'finished' || audioInterrupted) && (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="w-full rounded-full bg-orange-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit final answers'}
              </button>
            )}
            {audioState !== 'finished' && !audioInterrupted && (
              <p className="text-center text-xs text-slate-500">
                Submit becomes available after the audio finishes.
              </p>
            )}
          </div>
        </main>

        {/* Hidden audio element. preload="auto" so it's ready when user clicks. */}
        <audio
          ref={audioRef}
          src={testAudioUrl ?? undefined}
          preload="auto"
          controlsList="nodownload noplaybackrate"
          className="hidden"
        />
      </div>
    </FullscreenGate>
  )
}
