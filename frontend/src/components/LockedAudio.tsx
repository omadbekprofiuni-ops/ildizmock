import { Headphones, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface LockedAudioProps {
  src: string
  onEnded?: () => void
}

/**
 * ETAP 18 — Real IELTS Listening kabi audio:
 *   - avto-play (component mount bo'lganda boshlanadi)
 *   - controls yo'q (pause/rewind/skip mumkin emas)
 *   - seeking bloklangan (timeline'ni siljitib bo'lmaydi)
 *   - context menu yopiq (right-click "Save as" yo'q)
 *
 * Talabaga faqat status (Playing / Ended) va chiziqli progress
 * ko'rsatiladi — ovozni boshqarish imkoni yo'q.
 */
export function LockedAudio({ src, onEnded }: LockedAudioProps) {
  const ref = useRef<HTMLAudioElement>(null)
  const lastTimeRef = useRef(0)
  const [status, setStatus] = useState<'loading' | 'playing' | 'ended'>('loading')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleSeeking = () => {
      // Student timeline'ni surish urinishi — qayta tiklaymiz
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
      setStatus('ended')
      setProgress(100)
      onEnded?.()
    }
    const handleContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('seeking', handleSeeking)
    el.addEventListener('timeupdate', handleTimeUpdate)
    el.addEventListener('play', handlePlay)
    el.addEventListener('ended', handleEnded)
    el.addEventListener('contextmenu', handleContextMenu)

    // Avto-play (browser policy: muted bo'lmasa user gesture talab qilishi mumkin)
    el.play().catch(() => {
      // Avto-play taqiqlangan bo'lsa, status playing'da turadi user click qilguniga qadar
    })

    return () => {
      el.removeEventListener('seeking', handleSeeking)
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('play', handlePlay)
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [src, onEnded])

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Headphones className="h-4 w-4 text-brand-500" />
          {status === 'ended' ? 'Audio ended' : 'Audio playing'}
        </div>
        <Volume2
          className={`h-4 w-4 ${
            status === 'playing' ? 'animate-pulse text-brand-500' : 'text-slate-400'
          }`}
        />
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Real IELTS kabi: audio bir marta avtomatik o&apos;ynaydi. To&apos;xtatib,
        orqaga qaytarib bo&apos;lmaydi.
      </p>

      {/*
        controls and controlsList intentionally removed.
        muted=false by default; browser autoplay policy is fine because
        by the time this mounts the user has already pressed "Start".
      */}
      <audio
        ref={ref}
        src={src}
        preload="auto"
        controlsList="nodownload noplaybackrate"
        className="hidden"
      />
    </div>
  )
}
