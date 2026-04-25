import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import TeacherLayout from './TeacherLayout'

type SubmissionDetail = {
  id: number
  test_name: string
  student_name: string
  student_phone: string
  word_count: number
  status: 'pending' | 'graded'
  teacher_band: string | null
  teacher_feedback: string
  essay_text: string
  task_prompt: string
  min_words: number | null
  duration_minutes: number
  submitted_at: string
}

export default function TeacherGradePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['teacher-submission', id],
    queryFn: async () =>
      (await api.get<SubmissionDetail>(`/teacher/submissions/${id}/`)).data,
    enabled: !!id,
  })

  const [band, setBand] = useState<string>('6.0')
  const [feedback, setFeedback] = useState<string>('')

  useEffect(() => {
    if (q.data) {
      setBand(q.data.teacher_band ?? '6.0')
      setFeedback(q.data.teacher_feedback ?? '')
    }
  }, [q.data])

  const grade = useMutation({
    mutationFn: async () =>
      (await api.post(`/teacher/submissions/${id}/grade/`, {
        band: Number(band),
        feedback,
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-queue'] })
      qc.invalidateQueries({ queryKey: ['teacher-submission', id] })
      toast.success('Baholandi')
      navigate('/teacher')
    },
    onError: (err) => {
      const data = (err as { response?: { data?: { detail?: string } } })?.response?.data
      toast.error(data?.detail || 'Saqlashda xatolik')
    },
  })

  return (
    <TeacherLayout>
      <header className="flex items-center gap-3 border-b bg-white px-8 py-5">
        <Link to="/teacher">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Navbat
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">
            {q.data?.student_name ?? 'Yuklanmoqda…'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {q.data?.test_name} · {q.data?.word_count ?? '—'} so‘z
          </p>
        </div>
      </header>

      {q.isLoading && <p className="p-8 text-muted-foreground">Yuklanmoqda…</p>}
      {q.isError && (
        <p className="p-8 text-destructive">
          Topshirilgan ishni yuklab bo‘lmadi (sizning shogirdingiz emasmikan?)
        </p>
      )}
      {q.data && (
        <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-2">
          {/* Left — task */}
          <section className="rounded-lg border bg-white p-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vazifa
            </h2>
            <div className="mb-4 rounded-md bg-slate-100 p-4 text-center text-xs text-slate-500">
              [chart / image placeholder]
            </div>
            <div className="prose prose-slate max-w-none whitespace-pre-line text-sm text-slate-800">
              {q.data.task_prompt}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Minimal: {q.data.min_words ?? 150} so‘z · Vaqt: {q.data.duration_minutes} daq
            </p>
          </section>

          {/* Right — essay + grading */}
          <section className="space-y-6">
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Talabaning insheasi
              </h2>
              <div className="whitespace-pre-wrap rounded-md border bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                {q.data.essay_text}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Baholash
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="band">
                    Band (4.0 – 9.0):{' '}
                    <span className="font-mono text-base">{band}</span>
                  </Label>
                  <input
                    id="band"
                    type="range"
                    min={4}
                    max={9}
                    step={0.5}
                    value={band}
                    onChange={(e) => setBand(e.target.value)}
                    className="w-full accent-[var(--accent)]"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={9}
                    step={0.5}
                    value={band}
                    onChange={(e) => setBand(e.target.value)}
                    className="w-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback">Izoh</Label>
                  <textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={6}
                    placeholder="Strong points, areas to improve…"
                    className="w-full rounded-md border bg-white p-3 text-sm"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => grade.mutate()}
                  disabled={grade.isPending}
                >
                  {grade.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </TeacherLayout>
  )
}
