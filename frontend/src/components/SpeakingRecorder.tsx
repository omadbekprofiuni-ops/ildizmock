/**
 * ETAP 14 BUG #11 — MediaRecorder API orqali Speaking audio yozish.
 *
 * `navigator.mediaDevices.getUserMedia` HTTPS yoki localhost'da ishlaydi.
 * Production'da http (HTTPS bo'lmasa) brauzer mikrofonga ruxsat bermaydi.
 */

import { Loader2, Mic, Pause, Play, RotateCw, Send, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type RecState = 'idle' | 'recording' | 'paused' | 'recorded' | 'uploading' | 'done'

export function SpeakingRecorder({
  bsid,
  onUploaded,
  maxDurationSec = 15 * 60, // 15 daqiqa
}: {
  bsid: string
  onUploaded?: () => void
  maxDurationSec?: number
}) {
  const [state, setState] = useState<RecState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state === 'recording') {
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= maxDurationSec) {
            stop()
            return maxDurationSec
          }
          return s + 1
        })
      }, 1000)
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, maxDurationSec])

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Sizning brauzeringiz mikrofonni qo\'llab-quvvatlamaydi')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = rec
      chunksRef.current = []

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(URL.createObjectURL(blob))
        setState('recorded')
        // Mikrofonni o'chirish
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      rec.start()
      setSeconds(0)
      setState('recording')
    } catch (err) {
      toast.error('Mikrofonga kirish rad etildi')
      console.error(err)
    }
  }

  const pause = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause()
      setState('paused')
    }
  }

  const resume = () => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume()
      setState('recording')
    }
  }

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    chunksRef.current = []
    setSeconds(0)
    setState('idle')
  }

  const upload = async () => {
    if (chunksRef.current.length === 0) {
      toast.error('Yozilgan audio yo\'q')
      return
    }
    setState('uploading')
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const fd = new FormData()
      fd.append('audio', blob, `speaking-${bsid}.webm`)
      fd.append('duration_seconds', String(seconds))
      await api.post(`/mock/submit/speaking/${bsid}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Audio yuborildi')
      setState('done')
      onUploaded?.()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail
      toast.error(detail || 'Yuborib bo\'lmadi')
      setState('recorded')
    }
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-semibold text-emerald-900">
          ✓ Audio muvaffaqiyatli yuborildi
        </p>
        <p className="mt-1 text-sm text-emerald-700">
          Waiting for the teacher's grading.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          🎤 Speaking yozish
        </h3>
        <span
          className={`font-mono text-2xl tabular-nums ${
            state === 'recording'
              ? 'text-rose-600'
              : 'text-slate-700'
          }`}
        >
          {fmt(seconds)}
        </span>
      </div>

      {state === 'recording' && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-600" />
          Yozish ketmoqda…
        </div>
      )}
      {state === 'paused' && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⏸ To'xtatildi
        </div>
      )}

      {audioUrl && (
        <audio src={audioUrl} controls className="mb-4 w-full" />
      )}

      <div className="flex flex-wrap gap-2">
        {state === 'idle' && (
          <Button onClick={start} className="bg-rose-600 hover:bg-rose-700">
            <Mic className="mr-2 h-4 w-4" /> Yozishni boshlash
          </Button>
        )}
        {state === 'recording' && (
          <>
            <Button variant="outline" onClick={pause}>
              <Pause className="mr-2 h-4 w-4" /> Pauza
            </Button>
            <Button variant="outline" onClick={stop}>
              <Square className="mr-2 h-4 w-4" /> Tugatish
            </Button>
          </>
        )}
        {state === 'paused' && (
          <>
            <Button onClick={resume} className="bg-emerald-600 hover:bg-emerald-700">
              <Play className="mr-2 h-4 w-4" /> Continue
            </Button>
            <Button variant="outline" onClick={stop}>
              <Square className="mr-2 h-4 w-4" /> Tugatish
            </Button>
          </>
        )}
        {state === 'recorded' && (
          <>
            <Button variant="outline" onClick={reset}>
              <RotateCw className="mr-2 h-4 w-4" /> Qayta yozish
            </Button>
            <Button onClick={upload} className="bg-emerald-600 hover:bg-emerald-700">
              <Send className="mr-2 h-4 w-4" /> Submit
            </Button>
          </>
        )}
        {state === 'uploading' && (
          <Button disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </Button>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Maks vaqt: {Math.floor(maxDurationSec / 60)} daqiqa.
        Yakunlangach Submit tugmasini bosing.
      </p>
    </div>
  )
}
