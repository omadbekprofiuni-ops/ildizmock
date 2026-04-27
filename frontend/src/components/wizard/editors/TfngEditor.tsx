import type { WizardQuestion } from '../types'

const VALUES = ['TRUE', 'FALSE', 'NOT GIVEN'] as const

export function TfngEditor({
  q,
  setQ,
}: {
  q: WizardQuestion
  setQ: (q: WizardQuestion) => void
}) {
  const correct = ((q.correct_answer as { value?: string }).value ?? '')
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">
        To'g'ri javob
      </div>
      <div className="flex flex-wrap gap-2">
        {VALUES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setQ({ ...q, correct_answer: { value: v } })}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              correct === v
                ? 'border-green-500 bg-green-100 text-green-700'
                : 'border-slate-300 text-slate-600'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

export function YnngEditor(props: {
  q: WizardQuestion
  setQ: (q: WizardQuestion) => void
}) {
  const correct = ((props.q.correct_answer as { value?: string }).value ?? '')
  const VALS = ['YES', 'NO', 'NOT GIVEN']
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">
        To'g'ri javob
      </div>
      <div className="flex flex-wrap gap-2">
        {VALS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => props.setQ({ ...props.q, correct_answer: { value: v } })}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              correct === v
                ? 'border-green-500 bg-green-100 text-green-700'
                : 'border-slate-300 text-slate-600'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
