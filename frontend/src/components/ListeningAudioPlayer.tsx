import { Headphones, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'

interface Track {
  partNumber: number
  src: string
}

interface ListeningAudioPlayerProps {
  tracks: Track[]
  /**
   * Externally-owned audio element. Required.
   *
   * The element is created by `TestGate` so that:
   *  1. Part 1 is fully buffered BEFORE the test/timer starts.
   *  2. The very first `play()` happens inside the user's "Start test"
   *     click handler, satisfying browser autoplay policies.
   *
   * This component then takes over: it switches `src` between parts and
   * wires up event listeners. It does NOT render its own `<audio>` tag.
   */
  audioRef: RefObject<HTMLAudioElement>
  /**
   * If true, parts 2..N are NOT preloaded by this component because the
   * gate already kicked off background fetches. Avoids double-downloading.
   */
  remainingPreloaded?: boolean
}

/**
 * Real IELTS Listening kabi: 4 ta part audiosi ketma-ket o'ynaydi.
 * - Part 1 darhol o'ynaydi (TestGate'da to'liq yuklab olingan)
 * - Part 2..4 fonda yuklanadi (TestGate boshlagan)
 * - Pause / rewind / skip yo'q
 */
export function ListeningAudioPlayer({
  tracks,
  audioRef,
  remainingPreloaded = false,
}: ListeningAudioPlayerProps) {
  const lastTimeRef = useRef(0)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [status, setStatus] = useState<'loading' | 'playing' | 'between' | 'ended'>(
    'playing',
  )
  const [progress, setProgress] = useState(0)

  const currentTrack = tracks[currentIdx]

  // Parts 2..N preload — only if the gate didn't already do it.
  useEffect(() => {
    if (remainingPreloaded) return
    const preloaders: HTMLAudioElement[] = []
    tracks.forEach((track, idx) => {
      if (idx === 0) return
      const a = new Audio()
      a.preload = 'auto'
      a.src = track.src
      a.load()
      preloaders.push(a)
    })
    return () => {
      preloaders.forEach((a) => {
        try { a.pause() } catch { /* ignore */ }
        a.src = ''
      })
    }
  }, [tracks, remainingPreloaded])

  // Wire up the externally-owned audio element to current track + listeners.
  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentTrack) return

    lastTimeRef.current = 0
    setProgress(0)

    // Switch src only when changing parts (Part 1 already has src set by gate).
    if (el.src !== currentTrack.src && !el.src.endsWith(currentTrack.src)) {
      el.src = currentTrack.src
    }

    const handleSeeking = () => {
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
    const handlePlay = () => setStatus('playing')
    const handleWaiting = () => setStatus('loading')
    const handleEnded = () => {
      if (currentIdx + 1 < tracks.length) {
        setStatus('between')
        setTimeout(() => {
          setCurrentIdx((i) => i + 1)
        }, 1500)
      } else {
        setStatus('ended')
        setProgress(100)
      }
    }
    const handleContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('seeking', handleSeeking)
    el.addEventListener('timeupdate', handleTimeUpdate)
    el.addEventListener('play', handlePlay)
    el.addEventListener('waiting', handleWaiting)
    el.addEventListener('ended', handleEnded)
    el.addEventListener('contextmenu', handleContextMenu)

    // For Part 1 the gate already called play(); for parts 2..N we trigger it
    // here. Browsers allow this because the page already had a user gesture.
    if (currentIdx > 0) {
      el.play().catch(() => { /* unlikely after Part 1 played */ })
    } else if (el.paused) {
      el.play().catch(() => { /* gate's play() already ran */ })
    }

    return () => {
      el.removeEventListener('seeking', handleSeeking)
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('play', handlePlay)
      el.removeEventListener('waiting', handleWaiting)
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [currentIdx, currentTrack, tracks.length, audioRef])

  if (!currentTrack) return null

  const statusLabel = (() => {
    if (status === 'loading') return 'Loading…'
    if (status === 'between')
      return `Part ${currentTrack.partNumber} ended — next part starting…`
    if (status === 'ended') return 'All audio ended'
    return `Playing Part ${currentTrack.partNumber} of ${tracks.length}`
  })()

  return (
    <div className="sticky top-0 z-10 mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Headphones className="h-4 w-4 text-brand-500" />
          {statusLabel}
        </div>
        <Volume2
          className={`h-4 w-4 ${
            status === 'playing' ? 'animate-pulse text-brand-500' : 'text-slate-400'
          }`}
        />
      </div>

      <div className="mb-2 flex gap-1">
        {tracks.map((t, i) => (
          <div
            key={t.partNumber}
            className={`flex-1 text-center text-[10px] font-semibold uppercase tracking-wider ${
              i === currentIdx
                ? 'text-brand-600'
                : i < currentIdx
                  ? 'text-slate-400'
                  : 'text-slate-300'
            }`}
          >
            Part {t.partNumber}
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        {tracks.map((t, i) => (
          <div
            key={t.partNumber}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full bg-brand-500 transition-all"
              style={{
                width: `${
                  i < currentIdx ? 100 : i === currentIdx ? progress : 0
                }%`,
              }}
            />
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Real IELTS kabi: audio bir marta avtomatik o&apos;ynaydi. To&apos;xtatib,
        orqaga qaytarib bo&apos;lmaydi. Qismlar ketma-ket o&apos;ynaydi.
      </p>
    </div>
  )
}
