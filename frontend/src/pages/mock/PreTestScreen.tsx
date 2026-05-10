import { Headphones, Home, Volume2, Wifi } from 'lucide-react'
import { useState } from 'react'

/**
 * DEFINITIVE FIX — Pre-test screen (matches examy.me).
 *
 * Listening sektsiyaga kirishdan oldin foydalanuvchi:
 *   1. Speaker tovushini tekshiradi (Web Audio API beep — fayl kerak emas).
 *   2. Cheklist'ni ko'rib chiqadi.
 *   3. "Start Exam" tugmasini bosib audio playerga o'tadi.
 *
 * Pre-test ekrani bo'lmasa, browser autoplay ruxsatlari darrov chetdan
 * urilib, ListeningSection buzuq holatga tushadi (3 ta ildiz sababdan biri).
 */
export function PreTestScreen({
  studentName,
  skill,
  onStart,
  onHomepage,
}: {
  studentName: string
  skill: 'listening' | 'reading' | 'writing' | 'speaking'
  onStart: () => void
  onHomepage?: () => void
}) {
  const [audioOk, setAudioOk] = useState(false)
  const [testing, setTesting] = useState(false)

  const meta = {
    listening: { label: 'Listening Test', icon: <Headphones className="h-8 w-8" /> },
    reading: { label: 'Reading Test', icon: '📖' as const },
    writing: { label: 'Writing Test', icon: '✏️' as const },
    speaking: { label: 'Speaking Test', icon: '🎤' as const },
  }[skill]

  const playFileTone = async (src: string): Promise<boolean> => {
    // Spec talabi: /sounds/test-tone.mp3 fayl orqali sinash. HEAD bilan
    // 200 ekanini tekshiramiz — Audio.play() 404 paytida ham promise
    // rezolv qilishi mumkin (decode xatosi).
    try {
      const head = await fetch(src, { method: 'HEAD' })
      if (!head.ok) return false
    } catch {
      return false
    }
    return new Promise<boolean>((resolve) => {
      const audio = new Audio(src)
      audio.volume = 0.5
      let resolved = false
      const finish = (ok: boolean) => {
        if (resolved) return
        resolved = true
        resolve(ok)
      }
      audio.addEventListener('ended', () => finish(true), { once: true })
      audio.addEventListener('error', () => finish(false), { once: true })
      audio.play().then(() => {
        // Play sodir bo'ldi; biz 'ended' yoki 'error' kutamiz.
      }).catch(() => finish(false))
      // Safety net — 2 soniyadan keyin ham 'ended' kelmasa, OK deb
      // hisoblaymiz (qisqa tone playback kechikishi).
      setTimeout(() => finish(true), 2000)
    })
  }

  const playWebAudioBeep = async (): Promise<void> => {
    // Fallback: fayl yuklab bo'lmasa Web Audio API bilan generatsiya.
    const Ctx = (window.AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)
    const ctx = new Ctx()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 440
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95)
    osc.start(now)
    osc.stop(now + 1.0)
    await new Promise<void>((res) => {
      osc.onended = () => res()
    })
    try { await ctx.close() } catch { /* ignore */ }
  }

  const testSpeakers = async () => {
    setTesting(true)
    try {
      // Play a short test tone (or any short audio file you have)
      // Spec'da .mp3 talab qilingan; WAV ham fallback (repository'da
      // generate qilingan haqiqiy fayl). Ikkalasi ham 404 bo'lsa,
      // Web Audio API beep.
      let ok = await playFileTone('/sounds/test-tone.mp3')
      if (!ok) ok = await playFileTone('/sounds/test-tone.wav')
      if (!ok) await playWebAudioBeep()
      setAudioOk(true)
    } catch (err) {
      console.error('Test tone failed:', err)
      alert(
        'Could not play test tone. Check your speakers and click "Test '
        + 'Speakers" again.',
      )
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-700">
            {typeof meta.icon === 'string'
              ? <span className="text-3xl">{meta.icon}</span>
              : meta.icon}
          </div>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">{meta.label}</h1>
          <p className="mt-2 text-slate-600">
            {studentName
              ? `Hello, ${studentName}. `
              : ''}
            Test your {skill} skills with audio passages and questions.
          </p>
        </div>

        {skill === 'listening' && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={testSpeakers}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 font-medium text-white transition hover:bg-red-700 disabled:bg-gray-300"
            >
              <Volume2 className="h-5 w-5" />
              {testing
                ? 'Playing test tone…'
                : audioOk
                  ? 'Speakers OK — test again'
                  : 'Test Speakers'}
            </button>
          </div>
        )}

        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="text-amber-500">⚠️</span> Before you start:
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <Wifi className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
              Ensure you have a stable internet connection
            </li>
            {skill === 'listening' && (
              <li className="flex items-start gap-2">
                <Volume2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                Test your speakers — you should be able to hear audio clearly
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="mt-0.5">✨</span>
              <span>
                <span className="rounded bg-yellow-200 px-1">Highlight words</span>
                {' '}by selecting or double-clicking on them
              </span>
            </li>
            {skill === 'listening' && (
              <li className="rounded-lg bg-amber-50 p-3 text-amber-900">
                ⚠️ You will have <strong>10 minutes</strong> to transfer your
                answers at the end (in real CD IELTS it&apos;s 2 minutes,
                in paper-based it&apos;s 10).
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-600">✓</span>
              Click <strong>Start Exam</strong> when ready
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-600">✓</span>
              Good luck with your IELTS Mock Exam!
            </li>
          </ul>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onStart}
            className="flex-1 rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            Start Exam
          </button>
          {onHomepage && (
            <button
              type="button"
              onClick={onHomepage}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-blue-600 transition hover:bg-slate-50"
            >
              <Home className="h-4 w-4" />
              Homepage
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
