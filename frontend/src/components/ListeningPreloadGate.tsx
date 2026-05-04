import { CheckCircle2, Headphones, Loader2 } from 'lucide-react'
import { useEffect, useState, type RefObject } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  /** All listening parts in order. Part 1 is the one we wait for. */
  tracks: { partNumber: number; src: string }[]
  /**
   * Externally-owned <audio> element holding Part 1's src. The parent keeps
   * this element mounted across the preload → started transition so the
   * `play()` call we make inside the user's "Start test" click stays valid.
   */
  audioRef: RefObject<HTMLAudioElement>
  /** Called when user clicks "Start test" after Part 1 is fully buffered. */
  onStart: () => void
  /** Show a spinner overlay while we're awaiting the /start/ API call. */
  isStarting: boolean
}

/**
 * Listening test preload screen.
 *
 *  - Listens for `canplaythrough` on the parent's `<audio>` element to know
 *    Part 1 is fully buffered.
 *  - Kicks off background `new Audio()` preloaders for Parts 2..N so they
 *    finish during the test.
 *  - Shows a progress UI; only enables the "Test boshlash" button once
 *    Part 1 is ready.
 */
export function ListeningPreloadGate({
  tracks,
  audioRef,
  onStart,
  isStarting,
}: Props) {
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const part1 = tracks[0]
  const remainingTracks = tracks.slice(1)

  // Listen for buffering progress on the parent's Part 1 audio element.
  useEffect(() => {
    const el = audioRef.current
    if (!el || !part1) return

    // If readyState already 4 (HAVE_ENOUGH_DATA) — fully buffered already.
    if (el.readyState >= 4) {
      setProgress(100)
      setReady(true)
      return
    }

    const handleProgress = () => {
      try {
        if (el.buffered.length > 0 && el.duration > 0) {
          const buffered = el.buffered.end(el.buffered.length - 1)
          setProgress(Math.min(100, Math.round((buffered / el.duration) * 100)))
        }
      } catch { /* ignore */ }
    }
    const handleCanPlayThrough = () => {
      setProgress(100)
      setReady(true)
    }
    const handleError = () => {
      setError(
        'Audio yuklab bo‘lmadi — internetingizni tekshirib qayta urinib ko‘ring.',
      )
    }

    el.addEventListener('progress', handleProgress)
    el.addEventListener('canplaythrough', handleCanPlayThrough)
    el.addEventListener('error', handleError)

    // Mobile Safari needs an explicit load() call to start preloading.
    try { el.load() } catch { /* ignore */ }

    return () => {
      el.removeEventListener('progress', handleProgress)
      el.removeEventListener('canplaythrough', handleCanPlayThrough)
      el.removeEventListener('error', handleError)
    }
  }, [audioRef, part1])

  // Background preload for Parts 2..N. These keep loading while the user is
  // taking the test — by the time Part 1 ends they are already cached.
  useEffect(() => {
    if (remainingTracks.length === 0) return
    const preloaders: HTMLAudioElement[] = []
    remainingTracks.forEach((t) => {
      const a = new Audio()
      a.preload = 'auto'
      a.src = t.src
      a.load()
      preloaders.push(a)
    })
    return () => {
      // Don't abort — let them finish into browser cache so when
      // ListeningAudioPlayer mounts, Parts 2..N are ready.
      preloaders.forEach((a) => {
        a.onerror = null
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!part1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-destructive">
          Listening test'da audio fayl topilmadi.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-brand-50 p-4 text-brand-600">
            <Headphones className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {ready ? 'Audio tayyor' : 'Audio yuklanmoqda…'}
          </h1>
          <p className="text-sm text-slate-600">
            {ready
              ? 'Part 1 to‘liq yuklandi. Test boshlanganda timer ham ishga tushadi.'
              : 'Birinchi qism to‘liq yuklab olinadi, keyin test boshlanadi. '
                + 'Qolgan qismlar test davomida fonda yuklanadi.'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Part 1 audio</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${
                ready ? 'bg-emerald-500' : 'bg-brand-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {remainingTracks.length > 0 && (
          <p className="text-center text-[11px] text-slate-500">
            Parts {remainingTracks[0].partNumber}–
            {remainingTracks[remainingTracks.length - 1].partNumber} fonda
            tayyorlanmoqda
          </p>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-center text-xs text-red-700">
            {error}
          </p>
        )}

        <Button
          type="button"
          onClick={onStart}
          disabled={!ready || isStarting || !!error}
          className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]"
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Test boshlanmoqda…
            </>
          ) : ready ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Test boshlash →
            </>
          ) : (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Yuklanmoqda…
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
