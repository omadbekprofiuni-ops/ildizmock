import { Headphones, Volume2 } from 'lucide-react'
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

  // Audio o'ynalish jadvali — talaba qaysi tabda ekanidan mustaqil.
  // playingIdx = hozir o'ynayotgan part indeksi, finished[i]=true bo'lsa shu part
  // audiosi tugagan (qayta boshlash mumkin emas).
  const [playingIdx, setPlayingIdx] = useState(0)
  const [finished, setFinished] = useState<boolean[]>([])
  const [audioStatus, setAudioStatus] = useState<'loading' | 'playing' | 'between' | 'ended'>(
    'loading',
  )
  const [progress, setProgress] = useState(0)

  const submittedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastTimeRef = useRef(0)

  useEffect(() => {
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => {
        const ps: ListeningPart[] = r.data.listening_parts || []
        setParts(ps)
        setFinished(new Array(ps.length).fill(false))
      })
      .finally(() => setLoading(false))
  }, [bsid])

  // Barcha part audiolarini fonda preload qilamiz, shunda partlar orasida
  // network kechikishi bo'lmaydi. Active part audioRef'da o'ynaydi, qolganlari
  // hidden Audio() obyektlari orqali browser cache'iga tushiriladi.
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

  // Audio nazorati — har bir part o'z navbatida o'ynaydi
  useEffect(() => {
    const el = audioRef.current
    if (!el || parts.length === 0 || playingIdx >= parts.length) return
    if (!parts[playingIdx]?.audio_url) return

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
    const handlePlay = () => setAudioStatus('playing')
    const handleEnded = () => {
      setFinished((prev) => {
        const next = [...prev]
        next[playingIdx] = true
        return next
      })
      if (playingIdx + 1 < parts.length) {
        setAudioStatus('between')
        // Real IELTS partlar orasida pauza bor — qisqacha kechiktiramiz
        setTimeout(() => {
          setPlayingIdx((i) => i + 1)
        }, 1500)
      } else {
        setAudioStatus('ended')
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
      // autoplay block — status saqlanadi
    })

    return () => {
      el.removeEventListener('seeking', handleSeeking)
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('play', handlePlay)
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [playingIdx, parts])

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      await api.post(`/mock/submit/listening/${bsid}/`, { answers })
      onSubmit()
    } catch (err) {
      submittedRef.current = false
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Listening yuborishda xatolik. Internetni tekshiring va qayta urining.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmit = () => {
    if (!submittedRef.current) submit()
  }

  if (loading) return <div className="p-6 text-slate-500">Yuklanmoqda…</div>
  if (parts.length === 0) {
    return <div className="p-6 text-slate-500">Listening testda part topilmadi.</div>
  }

  const part = parts[activeIdx]
  const playingPart = parts[playingIdx]

  const audioStatusLabel = (() => {
    if (audioStatus === 'loading') return 'Loading…'
    if (audioStatus === 'between')
      return `Part ${playingPart?.part_number} ended — next part starting…`
    if (audioStatus === 'ended') return 'All audio ended'
    return `Audio: Part ${playingPart?.part_number} of ${parts.length}`
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

          {/* Persistent audio player — har doim ko'rinib turadi, tab almashganda
              o'zgarmaydi. Audio jadvali foydalanuvchidan mustaqil. */}
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
                Real IELTS kabi: audio ketma-ket bir marta o&apos;ynaydi. Tab
                almashganingizda audio davom etaveradi.
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
                {!finished[i] && i === playingIdx && (
                  <span className="ml-1 animate-pulse text-brand-400">●</span>
                )}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
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
                ← Oldingi part
              </button>

              {activeIdx < parts.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveIdx(activeIdx + 1)}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Keyingi part →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="rounded-full bg-green-600 px-8 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Yuborilmoqda…' : 'Tugatish va yuborish'}
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Bitta global audio elementi — tab almashganda render'dan chiqmaydi. */}
        {playingPart?.audio_url && (
          <audio
            ref={audioRef}
            src={playingPart.audio_url}
            preload="auto"
            controlsList="nodownload noplaybackrate"
            className="hidden"
          />
        )}
      </div>
    </FullscreenGate>
  )
}
