import { useEffect, useState } from 'react'

import { SpeakingRecorder } from '@/components/SpeakingRecorder'
import { api } from '@/lib/api'

import { FullscreenGate } from './FullscreenGate'
import { Timer } from './Timer'

interface SpeakingTask {
  id: number
  task_number: number
  prompt: string
  chart_image_url: string | null
  min_words: number
  suggested_minutes: number
  requirements: string
}

export function SpeakingSection({
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
  const [tasks, setTasks] = useState<SpeakingTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get(`/mock/section/${bsid}/`)
      .then((r) => setTasks(r.data.speaking_tasks || []))
      .finally(() => setLoading(false))
  }, [bsid])

  if (loading) {
    return (
      <FullscreenGate title="Speaking">
        <div className="flex h-screen items-center justify-center text-slate-500">
          Loading…
        </div>
      </FullscreenGate>
    )
  }

  return (
    <FullscreenGate title="Speaking">
      <div className="flex h-screen flex-col bg-slate-50">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="text-sm">
            <span className="text-slate-500">Mock</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className="font-medium">{name}</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className="font-semibold text-rose-600">Speaking</span>
          </div>
          <Timer initialSeconds={secondsRemaining} onExpire={onSubmit} />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl space-y-6 p-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <h2 className="text-lg font-bold text-rose-900">
                Speaking yo'riqnomasi
              </h2>
              <p className="mt-2 text-sm text-rose-800">
                Quyidagi savollar/topshiriqlarni o'qing va o'z javobingizni
                speak into the microphone. When done, press <strong>Submit</strong>
                tugmasini bosing — ustozingiz baholashni kutmoqdasiz.
              </p>
            </div>

            {tasks.length === 0 ? (
              <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
                Hozircha bu sessiyada speaking topshiriqlari belgilanmagan.
                Sevgan mavzuda 1-2 daqiqa gapirishingiz mumkin.
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Part {t.task_number}
                    </h3>
                    <div className="prose prose-slate max-w-none whitespace-pre-line text-slate-800">
                      {t.prompt}
                    </div>
                    {t.requirements && (
                      <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                        {t.requirements}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <SpeakingRecorder bsid={bsid} onUploaded={onSubmit} />
          </div>
        </main>
      </div>
    </FullscreenGate>
  )
}
