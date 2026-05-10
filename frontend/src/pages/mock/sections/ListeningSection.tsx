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
 * IELTS-style Listening section.
 *
 *  - Each part shows a big PLAY button. Audio NEVER auto-plays — the user
 *    must click to start (works around browser autoplay policies and
 *    matches a real exam: the proctor presses play).
 *  - Once started: pause / seek / rewind / keyboard shortcuts are blocked.
 *  - When a part ends, after a 2-second pause we auto-advance to the next
 *    part's PLAY button.
 *  - The audio progress header is independent of which part the student is
 *    currently READING — they can flip between Part tabs while audio plays.
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
  const [activeIdx, setActiveIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Audio state machine for the CURRENTLY PLAYING part.
  //   idle       → waiting for the user to press PLAY
  //   playing    → audio is playing
  //   between    → part finished, 2s pause before advancing to next
  //   ended      → all parts have played
  type AudioStatus = 'idle' | 'playing' | 'between' | 'ended'

  const [playingIdx, setPlayingIdx] = useState(0)
  const [finished, setFinished] = useState<boolean[]>([])
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle')
  const [progress, setProgress] = useState(0)
  // HOTFIX — aniq audio xato xabarini ko'rsatish uchun (alert o'rniga).
  const [audioError, setAudioError] = useState<string | null>(null)

  const submittedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastTimeRef = useRef(0)
  // True once the user has clicked PLAY for the current part. Used to
  // gate the auto-resume-on-pause behavior so it doesn't fire before the
  // audio has even started.
  const startedRef = useRef(false)

  // ── Load section data ──────────────────────────────────────────────
  useEffect(() => {
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => {
        const ps: ListeningPart[] = r.data.listening_parts || []
        setParts(ps)
        setFinished(new Array(ps.length).fill(false))
        // Skip leading parts that have no audio.
        const firstAudio = ps.findIndex((p) => !!p.audio_url)
        setPlayingIdx(firstAudio >= 0 ? firstAudio : 0)
      })
      .finally(() => setLoading(false))
  }, [bsid])

  // ── Background-preload parts 2..N so they start instantly ──────────
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

  // ── Reset to "idle" whenever the playing part changes ──────────────
  useEffect(() => {
    if (parts.length === 0) return
    if (playingIdx >= parts.length) return
    const part = parts[playingIdx]
    if (!part) return

    // No audio for this part → mark finished and advance.
    if (!part.audio_url) {
      setFinished((prev) => {
        const next = [...prev]
        next[playingIdx] = true
        return next
      })
      if (playingIdx + 1 < parts.length) {
        setPlayingIdx((i) => i + 1)
      } else {
        setAudioStatus('ended')
        setProgress(100)
      }
      return
    }

    // Wait for the user to press PLAY for this part.
    setAudioStatus('idle')
    setProgress(0)
    startedRef.current = false
    lastTimeRef.current = 0

    // Make sure the <audio> src is in sync (Safari needs explicit load()).
    const el = audioRef.current
    if (el && !el.src.endsWith(part.audio_url)) {
      el.src = part.audio_url
      try { el.load() } catch { /* ignore */ }
    }
  }, [playingIdx, parts])

  // ── Wire <audio> event listeners ───────────────────────────────────
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const handleSeeking = () => {
      // Block any seek attempt — IELTS rule: no rewind.
      if (Math.abs(el.currentTime - lastTimeRef.current) > 0.5) {
        el.currentTime = lastTimeRef.current
      }
    }
    const handleTimeUpdate = () => {
      lastTimeRef.current = el.currentTime
      if (el.duration > 0) {
        setProgress((el.currentTime / el.duration) * 100)
      }
    }
    const handlePlaying = () => {
      setAudioStatus('playing')
    }
    const handlePause = () => {
      // IELTS rule: once started, audio cannot be paused. If the browser
      // or the user paused, immediately resume — but only if the part has
      // actually been started by the user.
      if (startedRef.current && !el.ended) {
        el.play().catch(() => { /* ignore — extreme edge case */ })
      }
    }
    const handleEnded = () => {
      startedRef.current = false
      setFinished((prev) => {
        const next = [...prev]
        next[playingIdx] = true
        return next
      })
      if (playingIdx + 1 < parts.length) {
        setAudioStatus('between')
        // 2-second pause before next part — matches the spec.
        setTimeout(() => setPlayingIdx((i) => i + 1), 2000)
      } else {
        setAudioStatus('ended')
        setProgress(100)
      }
    }
    const handleContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('seeking', handleSeeking)
    el.addEventListener('timeupdate', handleTimeUpdate)
    el.addEventListener('playing', handlePlaying)
    el.addEventListener('pause', handlePause)
    el.addEventListener('ended', handleEnded)
    el.addEventListener('contextmenu', handleContextMenu)

    return () => {
      el.removeEventListener('seeking', handleSeeking)
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('playing', handlePlaying)
      el.removeEventListener('pause', handlePause)
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [playingIdx, parts])

  // ── Block keyboard shortcuts that could pause/seek the audio ───────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (audioStatus !== 'playing') return
      // Space → pause; arrow keys → seek; "k" / "j" / "l" common shortcuts.
      const blocked = [
        ' ', 'Space',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'k', 'K', 'j', 'J', 'l', 'L',
      ]
      if (blocked.includes(e.key)) {
        // Allow space inside form inputs (typing answer).
        const target = e.target as HTMLElement | null
        if (
          target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
          )
        ) return
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [audioStatus])

  // ── PLAY button click handler ───────────────────────────────────────
  const handlePlayClick = () => {
    const el = audioRef.current
    if (!el) {
      setAudioError('Audio player not initialized. Please reload the page.')
      return
    }
    // HOTFIX: src bo'sh yoki null bo'lsa, oldindan ushlaymiz.
    if (!el.src || el.src.endsWith('null') || el.src.endsWith('undefined')) {
      setAudioError(
        'Audio file URL is missing for this part. Contact your center admin '
        + '— they may need to re-upload the audio.',
      )
      return
    }
    setAudioError(null)
    el.play()
      .then(() => {
        startedRef.current = true
        setAudioStatus('playing')
      })
      .catch((err: unknown) => {
        // HOTFIX — error.name'ga qarab aniq sabab xabarini ko'rsatamiz.
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
            detail = 'Audio loading was interrupted. Check your internet connection.'
            break
          default:
            detail = e?.message || 'Unknown error.'
        }
        // eslint-disable-next-line no-console
        console.error('Audio play failed:', err, 'src:', el.src,
          'readyState:', el.readyState)
        setAudioStatus('idle')
        setAudioError(`Audio playback failed: ${detail}`)
      })
  }

  // ── Submit handler ──────────────────────────────────────────────────
  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      await api.post(`/mock/submit/listening/${bsid}/`, { answers })
      onSubmit()
    } catch (err) {
      submittedRef.current = false
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Error submitting Listening. Check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmit = () => {
    if (!submittedRef.current) submit()
  }

  // ── Render guards ──────────────────────────────────────────────────
  if (loading) return <div className="p-6 text-slate-500">Loading…</div>
  if (parts.length === 0) {
    return <div className="p-6 text-slate-500">No parts found in the Listening test.</div>
  }

  const part = parts[activeIdx]
  const playingPart = parts[playingIdx]

  const audioStatusLabel = (() => {
    if (audioStatus === 'idle') {
      return `Press START to play Part ${playingPart?.part_number}`
    }
    if (audioStatus === 'between')
      return `Part ${playingPart?.part_number} ended — next part starting…`
    if (audioStatus === 'ended') return 'All audio finished'
    return `Playing Part ${playingPart?.part_number} of ${parts.length}`
  })()

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

          {/* Persistent audio header — shows the playing part progress
              independent of which question tab the student is reading. */}
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Headphones className="h-4 w-4 text-brand-500" />
                  {audioStatusLabel}
                </div>
                <Volume2
                  className={`h-4 w-4 ${
                    audioStatus === 'playing'
                      ? 'animate-pulse text-brand-500'
                      : 'text-slate-400'
                  }`}
                />
              </div>
              <div className="flex gap-1">
                {parts.map((p, i) => (
                  <div
                    key={p.id}
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
                  >
                    <div
                      className="h-full bg-brand-500 transition-all"
                      style={{
                        width: `${
                          finished[i] ? 100 : i === playingIdx ? progress : 0
                        }%`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Just like real IELTS: each part plays once. You can&apos;t
                pause, rewind, or replay. Switching tabs won&apos;t affect
                the audio.
              </p>
            </div>
          </div>

          <div className="mx-auto flex max-w-7xl gap-2 px-4 pb-2">
            {parts.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`rounded-full px-4 py-1 text-sm ${
                  i === activeIdx
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Part {p.part_number}
                {finished[i] && <span className="ml-1 text-emerald-400">✓</span>}
                {!finished[i] && i === playingIdx && audioStatus === 'playing' && (
                  <span className="ml-1 animate-pulse text-brand-400">●</span>
                )}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
            {/* Big PLAY card — only visible when waiting for the user to
                start the currently-playing part. */}
            {audioStatus === 'idle' && playingPart?.audio_url && (
              <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-8 text-center">
                <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Headphones className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-slate-900">
                  Ready to play Part {playingPart.part_number}
                </h2>
                <p className="mb-6 text-sm text-slate-600">
                  Click START below to begin the audio for Part{' '}
                  {playingPart.part_number}. Once started, you can&apos;t
                  pause, rewind, or replay it — just like the real IELTS.
                </p>
                <button
                  type="button"
                  onClick={handlePlayClick}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-10 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-brand-700"
                >
                  <Play className="h-5 w-5 fill-current" />
                  START Part {playingPart.part_number}
                </button>
                {/* HOTFIX — audio xato banneri aniq sabab + 3 ta amal:
                    qayta urinish / sahifani yangilash / audio'ni alohida
                    ochish (debug). */}
                {audioError && (
                  <div className="mt-4 rounded-lg border-2 border-rose-300 bg-rose-50 p-4 text-left">
                    <p className="text-sm font-medium text-rose-800">
                      {audioError}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handlePlayClick}
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
                      {playingPart?.audio_url && (
                        <a
                          href={playingPart.audio_url}
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

            {/* While playing — clear "no controls" warning. */}
            {audioStatus === 'playing' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-sm font-semibold text-amber-800">
                  ⚠️ Audio is playing — you cannot pause or rewind.
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Real IELTS format: each part plays once only.
                </p>
              </div>
            )}

            {/* Between parts (2s pause) — calm "next" indicator. */}
            {audioStatus === 'between' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="mr-1 inline h-4 w-4 align-text-bottom" />
                  Part {playingPart?.part_number} complete — next part
                  starting in a moment…
                </p>
              </div>
            )}

            {/* Questions for the currently-active reading tab. */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-bold">Part {part.part_number}</h2>
              {part.instructions && (
                <p className="mb-3 text-sm text-slate-600">{part.instructions}</p>
              )}
              <div className="space-y-4">
                {part.questions.map((q, i) => (
                  <QuestionRenderer
                    key={q.id}
                    question={q}
                    index={i}
                    value={answers[String(q.id)]}
                    onChange={(v) =>
                      setAnswers((prev) => ({ ...prev, [String(q.id)]: v }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx(activeIdx - 1)}
                className="rounded-full bg-slate-200 px-6 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-40"
              >
                ← Previous part
              </button>

              {activeIdx < parts.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveIdx(activeIdx + 1)}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Next part →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="rounded-full bg-green-600 px-8 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Finish and submit'}
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Hidden <audio> — kept mounted across part transitions so the
            same DOM element is reused. */}
        <audio
          ref={audioRef}
          src={playingPart?.audio_url ?? undefined}
          preload="auto"
          controlsList="nodownload noplaybackrate"
          className="hidden"
        />
      </div>
    </FullscreenGate>
  )
}
