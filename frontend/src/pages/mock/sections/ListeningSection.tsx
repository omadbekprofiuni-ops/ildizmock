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
 * DEFINITIVE FIX — Listening sektsiyasi (yangi sequential auto-advance).
 *
 * Foydalanuvchi talab qildi:
 *   - Bitta START tugmasi (ko'p emas).
 *   - Bosilgach, qayta bosilmasligi kerak (disabled / yashirin).
 *   - Part 1 → Part 2 → Part 3 → Part 4 navbat bilan AVTOMATIK
 *     o'ynashi kerak (har part oxirida foydalanuvchi click qilmasdan).
 *
 * State machine:
 *   - PartStatus: 'pending' | 'playing' | 'finished'.
 *   - Mount vaqtida hamma part 'pending' (faqat backend allaqachon
 *     finished deb yozgan part'lar 'finished').
 *   - Bitta START tugmasi — birinchi 'pending' partga, audio.play()
 *     chaqiradi. Bosilgach status 'playing' bo'ladi va tugma yo'qoladi.
 *   - 'ended' event'ida: current part 'finished', keyingi non-finished
 *     part 'playing' deb belgilanadi, audio src yangilanadi va
 *     avtomatik .play() chaqiriladi (user gesture allaqachon berilgan —
 *     brauzer ruxsat beradi).
 *   - "All audio finished" FAQAT hamma part 'finished' bo'lganda.
 *
 * Refresh-safety:
 *   - Backend audio_played_parts / audio_finished_parts birlashmasi
 *     bilan boshlang'ich statuses tiklanadi.
 *
 * UX qoidalari:
 *   - Audio o'ynayotgan paytda tab almashtirish src'ni o'zgartirmaydi
 *     (el.paused tekshirilgani uchun) — talaba boshqa part'ning
 *     savollarini ko'rishi mumkin, lekin audio uzilmaydi.
 *   - Pending part'ning javob inputlari <fieldset disabled> ichida.
 */
type PartStatus = 'pending' | 'playing' | 'finished'

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
  // Bitta START click sodir bo'lganmi — qayta bosilmasligi uchun guard.
  const [starting, setStarting] = useState(false)

  const submittedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastTimeRef = useRef(0)
  const startedRef = useRef(false)
  // 'ended' callback statuses snapshot'i bilan ishlashi uchun ref.
  const statusesRef = useRef<PartStatus[]>([])
  const activeIdxRef = useRef(0)
  const partsRef = useRef<ListeningPart[]>([])

  useEffect(() => { statusesRef.current = statuses }, [statuses])
  useEffect(() => { activeIdxRef.current = activeIdx }, [activeIdx])
  useEffect(() => { partsRef.current = parts }, [parts])

  // ── Load section data ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => {
        if (cancelled) return
        const ps: ListeningPart[] = r.data.listening_parts || []
        setParts(ps)
        const played: number[] = Array.isArray(r.data.audio_played_parts)
          ? r.data.audio_played_parts : []
        const finished: number[] = Array.isArray(r.data.audio_finished_parts)
          ? r.data.audio_finished_parts : []
        const finishedSet = new Set<number>([...played, ...finished])
        const initial: PartStatus[] = ps.map((p) =>
          finishedSet.has(p.part_number) ? 'finished' : 'pending',
        )
        setStatuses(initial)
        // Birinchi non-finished part — START tugmasi shu yerga ishora qiladi.
        const firstPending = initial.findIndex((s) => s === 'pending')
        setActiveIdx(firstPending !== -1 ? firstPending : Math.max(0, ps.length - 1))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const errData = (err as { response?: { data?: SectionDataError } })
          ?.response?.data
        setConfigError(
          errData && (errData.error_code || errData.detail)
            ? errData
            : { detail: 'Could not load the Listening test. Please refresh the page.' },
        )
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bsid])

  // ── Preload upcoming parts ─────────────────────────────────────────
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

  // ── Sync <audio> src when active tab changes — but NOT during play ─
  // Audio o'ynayotgan paytda src'ni o'zgartirmaymiz (talaba boshqa
  // part'ning savollarini ko'rmoqda — audio uzilmasligi kerak).
  useEffect(() => {
    if (parts.length === 0) return
    const part = parts[activeIdx]
    if (!part) return
    const el = audioRef.current
    if (!el) return
    if (!el.paused && !el.ended) return
    if (part.audio_url && !el.src.endsWith(part.audio_url)) {
      el.src = part.audio_url
      try { el.load() } catch { /* ignore */ }
      setProgress(0)
      setCurrentTime(0)
      setDuration(0)
      startedRef.current = false
      lastTimeRef.current = 0
    }
  }, [activeIdx, parts])

  // ── Audio event listeners ──────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const handleSeeking = () => {
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
    const handleLoadedMeta = () => setDuration(el.duration || 0)
    const handlePlaying = () => {
      // Audio chindan ham o'ynay boshlaganda, status 'playing' bo'lishini
      // tasdiqlaymiz (handleStart va auto-advance ham qo'yadi — idempotent).
      const idx = activeIdxRef.current
      setStatuses((prev) => prev.map((s, i) => (i === idx ? 'playing' : s)))
    }
    const handlePause = () => {
      // IELTS: pause yo'q. Browser yoki user pause qilsa, darrov resume.
      if (startedRef.current && !el.ended) {
        el.play().catch(() => { /* ignore */ })
      }
    }
    const handleEnded = () => {
      startedRef.current = false
      setProgress(100)
      const curIdx = activeIdxRef.current
      const currentParts = partsRef.current
      const currentStatuses = statusesRef.current
      const curPart = currentParts[curIdx]
      if (curPart?.part_number) {
        api
          .post(`/mock/audio-finished/${bsid}/`, { part_order: curPart.part_number })
          .catch(() => {
            // Eski endpoint — yangi backend yo'q bo'lsa fallback
            api
              .post(`/mock/audio-played/${bsid}/`, { part_order: curPart.part_number })
              .catch(() => { /* ignore */ })
          })
      }
      // Keyingi non-finished part'ni izlaymiz.
      let nextIdx = -1
      for (let i = curIdx + 1; i < currentParts.length; i++) {
        if (currentStatuses[i] !== 'finished') {
          nextIdx = i
          break
        }
      }
      if (nextIdx === -1) {
        // Hamma tugadi — faqat current'ni finished qilamiz.
        setStatuses((prev) =>
          prev.map((s, i) => (i === curIdx ? 'finished' : s)),
        )
        return
      }
      const nextPart = currentParts[nextIdx]
      if (!nextPart?.audio_url) {
        // Keyingi audio yo'q (theoretik holat — backend rad etishi kerak edi).
        setStatuses((prev) =>
          prev.map((s, i) => (i === curIdx ? 'finished' : s)),
        )
        return
      }
      // AUTO-ADVANCE: src yangilanadi, status 'playing', activeIdx
      // o'tadi, audio darrov boshlanadi.
      setStatuses((prev) =>
        prev.map((s, i) => {
          if (i === curIdx) return 'finished'
          if (i === nextIdx) return 'playing'
          return s
        }),
      )
      setActiveIdx(nextIdx)
      setProgress(0)
      setCurrentTime(0)
      setDuration(0)
      lastTimeRef.current = 0
      // Audio src + play — sinxron qilamiz, sync effect aralashmaydi
      // (el.paused tekshiruvi bilan).
      el.src = nextPart.audio_url
      try { el.load() } catch { /* ignore */ }
      api
        .post(`/mock/audio-played/${bsid}/`, { part_order: nextPart.part_number })
        .catch(() => { /* ignore */ })
      el.play()
        .then(() => { startedRef.current = true })
        .catch((err: unknown) => {
          const e = err as { name?: string; message?: string }
          console.error('Auto-advance play failed:', err, 'src:', el.src)
          setStatuses((prev) =>
            prev.map((s, i) => (i === nextIdx ? 'pending' : s)),
          )
          setAudioError(
            `Auto-play of Part ${nextPart.part_number} failed: `
            + (e?.message || e?.name || 'Unknown error')
            + '. Please reload or click START again to resume.',
          )
        })
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
      const idx = activeIdxRef.current
      setStatuses((prev) =>
        prev.map((s, i) => (i === idx && s === 'playing' ? 'pending' : s)),
      )
      setStarting(false)
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
    // Listenerlar bsid'ga bog'liq (mark-finished endpoint URL'i uchun).
  }, [bsid])

  // ── beforeunload guard ─────────────────────────────────────────────
  useEffect(() => {
    const anyPlaying = statuses.some((s) => s === 'playing')
    if (!anyPlaying) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [statuses])

  // ── Keyboard shortcut block during playback ────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const anyPlaying = statuses.some((s) => s === 'playing')
      if (!anyPlaying) return
      const blocked = [
        ' ', 'Space',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'k', 'K', 'j', 'J', 'l', 'L',
      ]
      if (blocked.includes(e.key)) {
        const t = e.target as HTMLElement | null
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
          || t.isContentEditable)) return
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [statuses])

  // ── Single START click ────────────────────────────────────────────
  const handleStart = () => {
    if (starting) return                 // double-click guard
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
    setStarting(true)
    setAudioError(null)
    if (!el.src.endsWith(part.audio_url)) {
      el.src = part.audio_url
      try { el.load() } catch { /* ignore */ }
    }
    api
      .post(`/mock/audio-played/${bsid}/`, { part_order: part.part_number })
      .catch(() => { /* ignore */ })
    el.play()
      .then(() => {
        startedRef.current = true
        setStatuses((prev) =>
          prev.map((s, i) => (i === activeIdx ? 'playing' : s)),
        )
        // starting'ni false qilmaymiz — bir marta bosilgan, qayta
        // ko'rsatilmaydi. Faqat error bo'lsa rollback qilamiz.
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
            detail = 'Audio loading was interrupted. Check your internet.'
            break
          default:
            detail = e?.message || 'Unknown error.'
        }
        console.error('Audio play failed:', err, 'src:', el.src,
          'readyState:', el.readyState)
        setStarting(false)              // rollback so user can retry
        setAudioError(`Audio playback failed: ${detail}`)
      })
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
              Missing audio for Part(s): {configError.missing_parts.join(', ')}
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
  const anyPlaying = statuses.some((s) => s === 'playing')
  // START tugma faqat 'pending' partga ishora qilganda VA hech qanday
  // part hozir o'ynamayotgan bo'lsa ko'rinadi. starting=true bo'lsa
  // ham yashiramiz (bosilgach qayta bosilmaydi).
  const showStartButton
    = !allFinished
    && currentStatus === 'pending'
    && !anyPlaying
    && !starting

  // Topish: qaysi part 'playing' yoki keyingi non-finished — banner uchun.
  const playingIdx = statuses.findIndex((s) => s === 'playing')
  const shownPlayingPart = playingIdx >= 0 ? parts[playingIdx] : part

  const audioStatusLabel = (() => {
    if (allFinished) return 'All audio finished'
    if (anyPlaying && shownPlayingPart) {
      return `Playing Part ${shownPlayingPart.part_number} audio…`
    }
    return `Ready to play Part ${part.part_number}`
  })()

  const fmt = (s: number) => {
    if (!isFinite(s) || s <= 0) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Pending part'ning input'lari LOCKED — audio boshlanmaguncha javob
  // yozib bo'lmaydi. (Playing/finished part'larniki — ochiq.)
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

          <div className="mx-auto max-w-7xl px-4 pb-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Headphones className="h-4 w-4 text-brand-500" />
                  {audioStatusLabel}
                </div>
                <Volume2
                  className={`h-4 w-4 ${
                    anyPlaying
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
                      : i === playingIdx && s === 'playing' ? progress
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
                pause, rewind, or replay. Parts play in sequence
                automatically — no need to click between them.
              </p>
            </div>
          </div>

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
                        : s === 'playing'
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
            {/* ─── Bitta START tugmasi ─── */}
            {showStartButton && (
              <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-8 text-center">
                <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Headphones className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-slate-900">
                  Ready to play Part {part.part_number}
                </h2>
                <p className="mb-6 text-sm text-slate-600">
                  Click START below to begin. All {parts.length} parts will
                  play one after another automatically. You can&apos;t pause,
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

            {/* ─── Audio o'ynamoqda ─── */}
            {!allFinished && anyPlaying && (
              <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-6 text-center">
                <div className="mb-2 flex items-center justify-center gap-2 text-lg font-bold text-brand-700">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand-600" />
                  Playing Part {shownPlayingPart?.part_number} audio…
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
                  Parts {playingIdx + 1}–{parts.length} continue automatically.
                </p>
              </div>
            )}

            {/* ─── Hammasi tugadi ─── */}
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

            {/* ─── Savollar ─── */}
            <div className="relative">
              {inputsLocked && (
                <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-white/70 pt-8 backdrop-blur-[2px]">
                  <p className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg">
                    ▲ Waiting for Part {part.part_number} audio to start.
                    Questions will unlock automatically.
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

            {/* ─── Navigatsiya + Submit ─── */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={activeIdx === 0 || statuses[activeIdx - 1] === 'pending'}
                onClick={() => {
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
