import { Headphones, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Track {
  partNumber: number
  src: string
}

interface ListeningAudioPlayerProps {
  tracks: Track[]
}

/**
 * Real IELTS Listening kabi: 4 ta part audiosi ketma-ket o'ynaydi.
 * - Mount paytida BARCHA partlar fonda preload qilinadi (browser cache'ga
 *   tushadi), shunda partlar orasida network kechikishi bo'lmaydi
 * - Birinchi part avtomatik boshlanadi
 * - Tugagach keyingi part avtomatik boshlanadi (cache'dan darhol)
 * - Pause / rewind / skip yo'q
 */
export function ListeningAudioPlayer({ tracks }: ListeningAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastTimeRef = useRef(0)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [status, setStatus] = useState<'loading' | 'playing' | 'between' | 'ended'>(
    'loading',
  )
  const [progress, setProgress] = useState(0)
  const [preloadProgress, setPreloadProgress] = useState<Record<number, number>>({})

  const currentTrack = tracks[currentIdx]

  // Mount paytida BARCHA partlarni fonda yuklab, browser cache'iga tushiramiz.
  // Active player'dan tashqari hidden Audio() obyektlari bilan parallel
  // download boshlanadi.
  useEffect(() => {
    const preloaders: HTMLAudioElement[] = []
    const cleanup: Array<() => void> = []

    tracks.forEach((track, idx) => {
      // Active track'ni alohida audioRef boshqaradi — preloader kerak emas
      if (idx === 0) return
      const a = new Audio()
      a.preload = 'auto'
      a.src = track.src
      const onProgress = () => {
        if (a.duration > 0 && a.buffered.length > 0) {
          const buffered = a.buffered.end(a.buffered.length - 1)
          setPreloadProgress((p) => ({
            ...p,
            [track.partNumber]: Math.min(100, (buffered / a.duration) * 100),
          }))
        }
      }
      const onCanPlay = () => {
        setPreloadProgress((p) => ({ ...p, [track.partNumber]: 100 }))
      }
      a.addEventListener('progress', onProgress)
      a.addEventListener('canplaythrough', onCanPlay)
      // Mobile Safari'ni preload qila boshlatish uchun load() chaqirish kerak
      a.load()
      preloaders.push(a)
      cleanup.push(() => {
        a.removeEventListener('progress', onProgress)
        a.removeEventListener('canplaythrough', onCanPlay)
        a.src = ''
      })
    })

    return () => {
      cleanup.forEach((fn) => fn())
      preloaders.forEach((a) => {
        try { a.pause() } catch { /* ignore */ }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentTrack) return

    lastTimeRef.current = 0
    setProgress(0)

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
    const handleEnded = () => {
      if (currentIdx + 1 < tracks.length) {
        setStatus('between')
        // Real IELTS'da partlar orasida qisqa pauza bor (taxminan 30 sekund —
        // biz testda qisqa qildik)
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
    el.addEventListener('ended', handleEnded)
    el.addEventListener('contextmenu', handleContextMenu)

    el.play().catch(() => {
      // Autoplay taqiqlangan bo'lsa, status'da turamiz
    })

    return () => {
      el.removeEventListener('seeking', handleSeeking)
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('play', handlePlay)
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [currentIdx, currentTrack, tracks.length])

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

      <audio
        ref={audioRef}
        src={currentTrack.src}
        preload="auto"
        controlsList="nodownload noplaybackrate"
        className="hidden"
      />
    </div>
  )
}
