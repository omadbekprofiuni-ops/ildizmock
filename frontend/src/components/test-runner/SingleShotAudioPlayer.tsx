import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  onEnded?: () => void
  /** Tugma yorlig'i (default: "▶ Audio'ni boshlash") */
  startLabel?: string
}

/**
 * IELTS uslubidagi single-shot audio player.
 *
 * - Bir marta foydalanuvchi tugmani bosgach avtomatik o'ynaydi
 *   (zamonaviy brauzer autoplay siyosati uchun gesture kerak).
 * - To'xtatib bo'lmaydi, scrub qilib bo'lmaydi, qayta o'ynay olmaysiz.
 * - O'tgan / umumiy vaqtni ko'rsatadi (faqat indikator — tugma emas).
 */
export function SingleShotAudioPlayer({
  src,
  onEnded,
  startLabel = "▶ Audio'ni boshlash",
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [duration, setDuration] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onLoaded = () => setDuration(a.duration)
    const onTime = () => setElapsed(a.currentTime)
    const onEnd = () => {
      setEnded(true)
      onEnded?.()
    }
    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [onEnded])

  const handleStart = async () => {
    if (audioRef.current && !started) {
      try {
        await audioRef.current.play()
        setStarted(true)
      } catch (e) {
        console.error('Audio play blocked:', e)
      }
    }
  }

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00'
    const m = Math.floor(s / 60)
    const ss = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {/* Yashirin native audio — controls yo'q */}
      <audio ref={audioRef} src={src} preload="auto" />

      {!started && !ended && (
        <button
          type="button"
          onClick={handleStart}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          {startLabel}
        </button>
      )}

      {started && !ended && (
        <>
          <div className="flex h-3 flex-1 items-center overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{
                width: duration ? `${(elapsed / duration) * 100}%` : '0%',
              }}
            />
          </div>
          <span className="font-mono text-sm tabular-nums text-slate-700">
            {fmt(elapsed)} / {fmt(duration)}
          </span>
        </>
      )}

      {ended && (
        <span className="text-sm font-medium text-slate-500">
          Audio tugadi
        </span>
      )}
    </div>
  )
}
