import type { WizardQuestion } from '../types'

export function McqEditor({
  q,
  setQ,
}: {
  q: WizardQuestion
  setQ: (q: WizardQuestion) => void
}) {
  const choices = ((q.options as { choices?: string[] }).choices ?? ['', '', '', ''])
  const correct = ((q.correct_answer as { value?: string }).value ?? '')

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-widest text-slate-500">
        Variantlar
      </div>
      {['A', 'B', 'C', 'D'].map((letter, i) => (
        <label
          key={letter}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
            correct === letter
              ? 'border-green-500 bg-green-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <input
            type="radio"
            checked={correct === letter}
            onChange={() => setQ({ ...q, correct_answer: { value: letter } })}
          />
          <span className="font-bold text-slate-700">{letter}</span>
          <input
            value={choices[i] ?? ''}
            onChange={(e) => {
              const next = [...choices]
              while (next.length < 4) next.push('')
              next[i] = e.target.value
              setQ({ ...q, options: { ...q.options, choices: next } })
            }}
            placeholder={`${letter} variant matni…`}
            className="flex-1 bg-transparent outline-none"
          />
        </label>
      ))}
    </div>
  )
}
