import { CheckCircle2, Headphones, Play, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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

/**
 * DEFINITIVE FIX — Listening sektsiyasi to'liq qayta yozildi.
 *
 * Avvalgi 10 ta urinish nima uchun muvaffaqiyatsiz bo'lgan:
 *   1. Yuklanish vaqtida `audio_played_parts` bo'sh emas bo'lsa yoki
 *      birorta partda audio_url null bo'lsa, kaskad ravishda barcha
 *      part'lar "finished" deb belgilanardi → "All audio finished"
 *      birinchi clickdan oldin ko'rinardi.
 *   2. Pre-test ekrani yo'q edi — talaba to'g'ridan player'ga tushardi.
 *   3. "Audio o'ynay oladi" va "audio tugagan" bayroqlari bir xil
 *      qiymatdan boshlanardi — initialization paytida tasodifan true
 *      bo'lib qolardi.
 *
 * Yangi yondashuv:
 *   - Har bir part'ning statusi alohida: 'pending' | 'ready' | 'playing'
 *     | 'finished'. Mount vaqtida HAR DOIM 'pending' boshlanadi.
 *   - Backend'dan kelgan audio_played_parts / audio_finished_parts
 *     birlashmasi orqali finished'larni aniqlaymiz, birinchi non-finished
 *     part 'ready' bo'ladi.
 *   - START tugmasi user gesture ichida audio.play() chaqiradi (autoplay
 *     restrictsiyasi shu yerda buzilmaydi — chunki pre-test ekrandagi
 *     "Start Exam" allaqachon gesture yaratgan).
 *   - "All audio finished" FAQAT statuses.every(s => s === 'finished')
 *     bo'lganda chiqadi. Bu — yagona haqiqat manbai.
 *   - Pending part'ning javob input'lari `<fieldset disabled>` ichida —
 *     audio boshlanmaguncha javob yozib bo'lmaydi.
 */
type PartStatus = 'pending' | 'ready' | 'playing' | 'finished'

interface SectionDataError {
  detail: string
  error_code?: 'NO_PARTS' | 'MISSING_AUDIO'
  missing_parts?: number[]
}

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
  const [statuses, setStatuses] = useState<PartStatus[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [configError, setConfigError] = useState<SectionDataError | null>(null)

  const submittedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastTimeRef = useRef(0)
  const startedRef = useRef(false)

  // ── Load section data ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => {
        if (cancelled) return
        const ps: ListeningPart[] = r.data.listening_parts || []
        setParts(ps)

        // CRITICAL: backend ikkita ro'yxat qaytaradi — eski mijozlar
        // faqat audio_played_parts ga yozardi; yangilari ikkalasiga.
        // Union'ni "finished" deb hisoblaymiz (interrupted mid-play
        // ham 'finished' deb qabul qilinadi — spec talabi).
        const played: number[] = Array.isArray(r.data.audio_played_parts)
          ? r.data.audio_played_parts
          : []
        const finished: number[] = Array.isArray(r.data.audio_finished_parts)
          ? r.data.audio_finished_parts
          : []
        const finishedSet = new Set<number>([...played, ...finished])

        const initial: PartStatus[] = ps.map((p) =>
          finishedSet.has(p.part_number) ? 'finished' : 'pending',
        )
        // Birinchi pending part 'ready' bo'ladi — uni o'ynaymiz.
        const firstPending = initial.findIndex((s) => s === 'pending')
        if (firstPending !== -1) {
          initial[firstPending] = 'ready'
          setActiveIdx(firstPending)
        } else {
          // Hammasi finished — talaba refresh qilganida bu yo'lga
          // tushadi. activeIdx oxirgi partda qoladi.
          setActiveIdx(Math.max(0, ps.length - 1))
        }
        setStatuses(initial)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const errData = (err as { response?: { data?: SectionDataError } })
          ?.response?.data
        if (errData && (errData.error_code || errData.detail)) {
          setConfigError(errData)
        } else {
          setConfigError({
            detail:
              'Could not load the Listening test. Please refresh the page.',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bsid])

  // ── Preload upcoming parts in background ───────────────────────────
  useEffect(() => {
    if (parts.length === 0) return
    const preloaders: HTMLAudioElement[] = []
    parts.forEach((p, idx) => {
      if (idx === 0 || !p.audio_url) return
      const a = new Audio()
      a.preload = 'auto'
      a.src = p.audio_url
      a.load()
      preloaders.push(a)
    })
    return () => {
      preloaders.forEach((a) => {
        try { a.pause() } catch { /* ignore */ }
        a.src = ''
      })
    }
  }, [parts])

  // ── Sync <audio> src when active part changes ─────────────────────
  useEffect(() => {
    if (parts.length === 0) return
    const part = parts[activeIdx]
    if (!part) return
    setProgress(0)
    setCurrentTime(0)
    setDuration(0)
    startedRef.current = false
    lastTimeRef.current = 0
    const el = audioRef.current
    if (el && part.audio_url && !el.src.endsWith(part.audio_url)) {
      el.src = part.audio_url
      try { el.load() } catch { /* ignore */ }
    }
  }, [activeIdx, parts])

  // ── Audio event listeners ──────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const handleSeeking = () => {
      // IELTS rule: no rewind/seek.
      if (Math.abs(el.currentTime - lastTimeRef.current) > 0.5) {
        el.currentTime = lastTimeRef.current
      }
    }
    const handleTimeUpdate = () => {
      lastTimeRef.current = el.currentTime
      setCurrentTime(el.currentTime)
      if (el.duration > 0) {
        setProgress((el.currentTime / el.duration) * 100)
      }
    }
    const handleLoadedMeta = () => {
      setDuration(el.duration || 0)
    }
    const handlePlaying = () => {
      setStatuses((prev) =>
        prev.map((s, i) => (i === activeIdx ? 'playing' : s)),
      )
    }
    const handlePause = () => {
      // IELTS rule: cannot pause once started.
      if (startedRef.current && !el.ended) {
        el.play().catch(() => { /* ignore — extreme edge case */ })
      }
    }
    const handleEnded = () => {
      startedRef.current = false
      const partOrder = parts[activeIdx]?.part_number
      // Spec talabi: ikkala endpointga ham yozamiz.
      if (partOrder) {
        api
          .post(`/mock/audio-finished/${bsid}/`, { part_order: partOrder })
          .catch(() => {
            // Yangi endpoint mavjud bo'lmasa (backend deploy oldin),
            // eski endpoint refresh-safety ta'minlaydi.
            api
              .post(`/mock/audio-played/${bsid}/`, { part_order: partOrder })
              .catch(() => { /* ignore — best-effort */ })
          })
      }
      // BU YERDA activeIdx'ni avtomatik o'zgartirmaymiz —
      // talaba "Continue to Part N+1" tugmasini bossa o'zgaradi.
      setStatuses((prev) =>
        prev.map((s, i) => {
          if (i === activeIdx) return 'finished'
          // Keyingi part 'pending' bo'lsa, uni hali ham 'pending' qoldiramiz —
          // "Continue" tugmasi bosilganda 'ready' ga aylanadi.
          return s
        }),
      )
      setProgress(100)
    }
    const handleError = () => {
      const err = el.error
      const detail = !err
        ? 'Unknown audio error.'
        : err.code === MediaError.MEDIA_ERR_ABORTED
          ? 'Audio loading was aborted.'
          : err.code === MediaError.MEDIA_ERR_NETWORK
            ? 'Network error while loading audio. Check your internet.'
            : err.code === MediaError.MEDIA_ERR_DECODE
              ? 'Audio file is corrupted or could not be decoded.'
              : err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                ? 'Audio format is not supported by your browser.'
                : 'Unknown audio error.'
      console.error('Audio element error:', err, 'src:', el.src)
      setAudioError(detail)
      // 'playing' holatdan 'ready'ga qaytamiz — talaba qayta urinib ko'radi.
      setStatuses((prev) =>
        prev.map((s, i) =>
          i === activeIdx && s === 'playing' ? 'ready' : s,
        ),
      )
    }
    const handleContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('seeking', handleSeeking)
    el.addEventListener('timeupdate', handleTimeUpdate)
    el.addEventListener('loadedmetadata', handleLoadedMeta)
    el.addEventListener('playing', handlePlaying)
    el.addEventListener('pause', handlePause)
    el.addEventListener('ended', handleEnded)
    el.addEventListener('error', handleError)
    el.addEventListener('contextmenu', handleContextMenu)
    return () => {
      el.removeEventListener('seeking', handleSeeking)
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('loadedmetadata', handleLoadedMeta)
      el.removeEventListener('playing', handlePlaying)
      el.removeEventListener('pause', handlePause)
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('error', handleError)
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [activeIdx, parts, bsid])

  // ── beforeunload warning when audio is mid-play ────────────────────
  useEffect(() => {
    const cur = statuses[activeIdx]
    if (cur !== 'playing') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [statuses, activeIdx])

  // ── Block keyboard shortcuts that could pause/seek the audio ───────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (statuses[activeIdx] !== 'playing') return
      const blocked = [
        ' ', 'Space',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'k', 'K', 'j', 'J', 'l', 'L',
      ]
      if (blocked.includes(e.key)) {
        const target = e.target as HTMLElement | null
        if (
          target && (
            target.tagName === 'INPUT'
            || target.tagName === 'TEXTAREA'
            || target.isContentEditable
          )
        ) return
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [statuses, activeIdx])

  // ── START Part N click ─────────────────────────────────────────────
  const handleStart = () => {
    const el = audioRef.current
    if (!el) {
      setAudioError('Audio player not initialized. Please reload the page.')
      return
    }
    const part = parts[activeIdx]
    if (!part?.audio_url) {
      setAudioError(
        'Audio file URL is missing for this part. Contact your center '
        + 'admin — they may need to re-upload the audio.',
      )
      return
    }
    if (!el.src || el.src.endsWith('null') || el.src.endsWith('undefined')) {
      el.src = part.audio_url
      try { el.load() } catch { /* ignore */ }
    }
    setAudioError(null)
    // START bosilishi bilan backend'ga "boshlandi" deb yozamiz — agar
    // talaba sahifani yangilab yuborsa, ushbu part qayta boshlanmasligi
    // uchun.
    api
      .post(`/mock/audio-played/${bsid}/`, { part_order: part.part_number })
      .catch(() => { /* ignore — best-effort */ })
    el.play()
      .then(() => {
        startedRef.current = true
        setStatuses((prev) =>
          prev.map((s, i) => (i === activeIdx ? 'playing' : s)),
        )
      })
      .catch((err: unknown) => {
        const e = err as { name?: string; message?: string }
        let detail: string
        switch (e?.name) {
          case 'NotAllowedError':
            detail = 'Your browser blocked autoplay. Please click "Try again".'
            break
          case 'NotSupportedError':
            detail = 'Your browser does not support this audio format.'
            break
          case 'AbortError':
            detail =
              'Audio loading was interrupted. Check your internet connection.'
            break
          default:
            detail = e?.message || 'Unknown error.'
        }
        console.error('Audio play failed:', err, 'src:', el.src,
          'readyState:', el.readyState)
        setAudioError(`Audio playback failed: ${detail}`)
      })
  }

  // ── Continue to Part N+1 click ─────────────────────────────────────
  const handleContinue = () => {
    const nextIdx = activeIdx + 1
    if (nextIdx >= parts.length) return
    setActiveIdx(nextIdx)
    setStatuses((prev) =>
      prev.map((s, i) =>
        i === nextIdx && s === 'pending' ? 'ready' : s,
      ),
    )
  }

  // ── Submit handler ─────────────────────────────────────────────────
  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      await api.post(`/mock/submit/listening/${bsid}/`, { answers })
      onSubmit()
    } catch (err) {
      submittedRef.current = false
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
          {configError.missing_parts && configError.missing_parts.length > 0 && (
            <p className="mt-2 text-xs text-rose-600">
              Missing audio for Part(s):{' '}
              {configError.missing_parts.join(', ')}
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Admin: open this test in the Tests page → edit → upload audio for
            each Listening part.
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

  const part = parts[activeIdx]
  const currentStatus = statuses[activeIdx] ?? 'pending'
  const allFinished
    = statuses.length === parts.length
    && statuses.every((s) => s === 'finished')

  const audioStatusLabel = (() => {
    if (allFinished) return 'All audio finished'
    if (currentStatus === 'playing') {
      return `Playing Part ${part.part_number} audio…`
    }
    if (currentStatus === 'finished') {
      return `Part ${part.part_number} audio finished`
    }
    return `Ready to play Part ${part.part_number}`
  })()

  const fmt = (s: number) => {
    if (!isFinite(s) || s <= 0) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Pending statusi — javob inputlari LOCKED. Boshlanmagan part'ga
  // o'tib javob yozish mumkin emas (spec talabi).
  const inputsLocked = currentStatus === 'pending'

  return (
    <FullscreenGate title="Listening Test">
      <div className="flex h-screen flex-col bg-slate-50">
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-lg font-bold">Listening Test</h1>
              <p className="text-xs text-slate-500">{name}</p>
            </div>
            <Timer initialSeconds={secondsRemaining} onExpire={handleAutoSubmit} />
          </div>

          {/* Persistent audio header */}
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Headphones className="h-4 w-4 text-brand-500" />
                  {audioStatusLabel}
                </div>
                <Volume2
                  className={`h-4 w-4 ${
                    currentStatus === 'playing'
                      ? 'animate-pulse text-brand-500'
                      : 'text-slate-400'
                  }`}
                />
              </div>
              <div className="flex gap-1">
                {parts.map((p, i) => {
                  const s = statuses[i] ?? 'pending'
                  const widthPct
                    = s === 'finished' ? 100
                      : i === activeIdx && s === 'playing' ? progress
                        : 0
                  return (
                    <div
                      key={p.id}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
                    >
                      <div
                        className="h-full bg-brand-500 transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Just like real IELTS: each part plays once. You can&apos;t
                pause, rewind, or replay. Switching tabs won&apos;t affect
                the audio.
              </p>
            </div>
          </div>

          {/* Part tabs */}
          <div className="mx-auto flex max-w-7xl gap-2 px-4 pb-2">
            {parts.map((p, i) => {
              const s = statuses[i] ?? 'pending'
              const clickable = s !== 'pending'
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => clickable && setActiveIdx(i)}
                  disabled={!clickable}
                  className={`rounded-full px-4 py-1 text-sm transition ${
                    i === activeIdx
                      ? 'bg-slate-900 text-white'
                      : s === 'finished'
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : s === 'ready' || s === 'playing'
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  Part {p.part_number}
                  {s === 'finished' && (
                    <span className="ml-1 text-emerald-500">✓</span>
                  )}
                  {s === 'playing' && (
                    <span className="ml-1 animate-pulse text-brand-400">●</span>
                  )}
                </button>
              )
            })}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
            {/* ─── Audio control card ─── */}
            {!allFinished && currentStatus === 'ready' && (
              <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-8 text-center">
                <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Headphones className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-slate-900">
                  Ready to play Part {part.part_number}
                </h2>
                <p className="mb-6 text-sm text-slate-600">
                  {activeIdx === 0
                    ? `Click START below to begin the audio for Part ${part.part_number}. Once started, you can't pause, rewind, or replay it — just like the real IELTS.`
                    : `Part ${parts[activeIdx - 1]?.part_number ?? activeIdx} finished. When ready, click START to begin Part ${part.part_number}.`}
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-10 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-brand-700"
                >
                  <Play className="h-5 w-5 fill-current" />
                  START Part {part.part_number}
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
                      {part.audio_url && (
                        <a
                          href={part.audio_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Open audio directly
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!allFinished && currentStatus === 'playing' && (
              <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-6 text-center">
                <div className="mb-2 flex items-center justify-center gap-2 text-lg font-bold text-brand-700">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand-600" />
                  Playing Part {part.part_number} audio…
                </div>
                <div className="mx-auto mt-3 h-2.5 max-w-md overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full bg-brand-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 font-mono text-sm text-brand-700">
                  {fmt(currentTime)} / {fmt(duration)}
                </p>
                <p className="mt-2 text-xs text-amber-700">
                  ⚠️ Audio cannot be paused, rewound, or replayed.
                </p>
              </div>
            )}

            {!allFinished
              && currentStatus === 'finished'
              && activeIdx < parts.length - 1 && (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-2 text-lg font-bold text-emerald-800">
                  Part {part.part_number} audio finished
                </h2>
                <p className="mt-1 text-sm text-emerald-700">
                  When ready, click below to start Part{' '}
                  {parts[activeIdx + 1]?.part_number ?? activeIdx + 2}.
                </p>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-700"
                >
                  <Play className="h-4 w-4 fill-current" />
                  START Part {parts[activeIdx + 1]?.part_number ?? activeIdx + 2}
                </button>
              </div>
            )}

            {allFinished && (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-2 text-lg font-bold text-emerald-800">
                  All audio finished
                </h2>
                <p className="mt-1 text-sm text-emerald-700">
                  You have 10 minutes to transfer / review your answers before
                  the test ends. Submit when ready.
                </p>
              </div>
            )}

            {/* ─── Questions area ─── */}
            <div className="relative">
              {inputsLocked && (
                <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-white/70 pt-8 backdrop-blur-[2px]">
                  <p className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg">
                    ▲ Click &quot;START Part {part.part_number}&quot; above to
                    unlock these questions
                  </p>
                </div>
              )}
              <div className={inputsLocked ? 'opacity-40' : ''}>
                <fieldset
                  disabled={inputsLocked}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <h2 className="mb-3 text-xl font-bold">
                    Part {part.part_number}
                  </h2>
                  {part.instructions && (
                    <p className="mb-3 text-sm text-slate-600">
                      {part.instructions}
                    </p>
                  )}
                  <div className="space-y-4">
                    {part.questions.map((q, i) => (
                      <QuestionRenderer
                        key={q.id}
                        question={q}
                        index={i}
                        value={answers[String(q.id)]}
                        onChange={(v) =>
                          setAnswers((prev) => ({
                            ...prev, [String(q.id)]: v,
                          }))}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>

            {/* ─── Navigation + Submit ─── */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => {
                  // Faqat finished/playing/ready part'larga o'tish mumkin —
                  // pending part'ga "Previous" tugmasi orqali ham
                  // o'tib bo'lmaydi.
                  const prev = activeIdx - 1
                  if (prev >= 0 && statuses[prev] !== 'pending') {
                    setActiveIdx(prev)
                  }
                }}
                className="rounded-full bg-slate-200 px-6 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-40"
              >
                ← Previous part
              </button>

              {activeIdx < parts.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = activeIdx + 1
                    if (statuses[nextIdx] !== 'pending') {
                      setActiveIdx(nextIdx)
                    }
                  }}
                  disabled={
                    activeIdx + 1 >= parts.length
                    || statuses[activeIdx + 1] === 'pending'
                  }
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next part →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting || !allFinished}
                  onClick={submit}
                  className="rounded-full bg-green-600 px-8 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Finish and submit'}
                </button>
              )}
            </div>
            {!allFinished && activeIdx === parts.length - 1 && (
              <p className="text-center text-xs text-slate-500">
                Submit becomes available after the last part audio finishes.
              </p>
            )}
          </div>
        </main>

        {/* Hidden <audio> — re-used across part transitions. */}
        <audio
          ref={audioRef}
          preload="auto"
          controlsList="nodownload noplaybackrate"
          className="hidden"
        />
      </div>
    </FullscreenGate>
  )
}
