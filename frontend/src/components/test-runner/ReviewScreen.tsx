import { CheckCircle2, Circle, Flag } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface ReviewQuestion {
  id: number
  number: number
  partNumber: number
  answered: boolean
  flagged: boolean
}

interface Props {
  questions: ReviewQuestion[]
  onJumpTo: (qid: number) => void
  onContinue: () => void
  onSubmit: () => void
  submitting?: boolean
}

export function ReviewScreen({
  questions,
  onJumpTo,
  onContinue,
  onSubmit,
  submitting,
}: Props) {
  const total = questions.length
  const answered = questions.filter((q) => q.answered).length
  const flagged = questions.filter((q) => q.flagged).length
  const unanswered = total - answered

  // Group by part
  const byPart: Record<number, ReviewQuestion[]> = {}
  for (const q of questions) {
    ;(byPart[q.partNumber] ??= []).push(q)
  }
  const partNumbers = Object.keys(byPart)
    .map((n) => Number(n))
    .sort((a, b) => a - b)

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="text-2xl font-bold text-slate-900">Review your answers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Click any question number below to go back and edit it. Submit when
          you are ready.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Answered: {answered} / {total}
          </span>
          <span className="inline-flex items-center gap-2 rounded-md bg-rose-50 px-3 py-1.5 font-medium text-rose-700">
            <Circle className="h-4 w-4" />
            Unanswered: {unanswered}
          </span>
          <span className="inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
            <Flag className="h-4 w-4" />
            Flagged for review: {flagged}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="space-y-6">
          {partNumbers.map((part) => {
            const partQs = byPart[part]
            return (
              <section key={part}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Part {part}
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
                  {partQs.map((q) => {
                    const base =
                      'relative flex h-10 items-center justify-center rounded-md border text-sm font-medium transition-colors'
                    const state = q.answered
                      ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50'
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => onJumpTo(q.id)}
                        className={`${base} ${state}`}
                        aria-label={`Question ${q.number}`}
                      >
                        {q.number}
                        {q.flagged && (
                          <Flag
                            className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-amber-500 p-0.5 text-white"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-8 py-4">
        <Button variant="outline" onClick={onContinue}>
          ← Continue editing
        </Button>
        <div className="flex items-center gap-3">
          {unanswered > 0 && (
            <span className="text-sm text-rose-600">
              {unanswered} question{unanswered === 1 ? '' : 's'} not yet answered
            </span>
          )}
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? 'Submitting…' : 'Submit final answers'}
          </Button>
        </div>
      </div>
    </div>
  )
}
