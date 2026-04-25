import type { QuestionProps } from './types'

export function MCQQuestion({ question, value, onChange, number, readOnly }: QuestionProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <span className="font-semibold text-slate-900">{number}.</span>
        <p className="text-slate-800">{question.text}</p>
      </div>
      <div className="space-y-2 pl-7">
        {question.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i)
          const selected = value === opt
          return (
            <label
              key={i}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors ${
                selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
              } ${readOnly ? 'pointer-events-none' : ''}`}
            >
              <input
                type="radio"
                name={`mcq-${question.id}`}
                value={opt}
                checked={selected}
                onChange={() => onChange(opt)}
                disabled={readOnly}
                className="mt-1 h-4 w-4 accent-slate-900"
              />
              <span className="font-medium text-slate-700">{letter}</span>
              <span className="text-slate-800">{opt}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
