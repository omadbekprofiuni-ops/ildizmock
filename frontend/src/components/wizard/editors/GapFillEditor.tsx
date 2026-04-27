import type { WizardQuestion } from '../types'

export function GapFillEditor({
  q,
  setQ,
}: {
  q: WizardQuestion
  setQ: (q: WizardQuestion) => void
}) {
  const value = ((q.correct_answer as { value?: string }).value ?? '')
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-xs uppercase tracking-widest text-slate-500">
          To'g'ri javob
        </div>
        <input
          value={value}
          onChange={(e) => setQ({ ...q, correct_answer: { value: e.target.value } })}
          placeholder="Masalan: 450"
          className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-slate-900"
        />
      </div>
      <div>
        <div className="mb-1 text-xs uppercase tracking-widest text-slate-500">
          Muqobil javoblar (vergul bilan)
        </div>
        <input
          value={(q.alt_answers ?? []).join(', ')}
          onChange={(e) =>
            setQ({
              ...q,
              alt_answers: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="four hundred fifty, 450 pounds"
          className="w-full rounded-lg border border-slate-300 p-2 outline-none focus:border-slate-900"
        />
      </div>
    </div>
  )
}
