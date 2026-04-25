import type { QuestionProps } from './types'

const CHOICES = ['True', 'False', 'Not Given'] as const

export function TFNGQuestion({ question, value, onChange, number, readOnly }: QuestionProps) {
  const opts = question.options.length > 0 ? question.options : [...CHOICES]
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <span className="font-semibold text-slate-900">{number}.</span>
        <p className="text-slate-800">{question.text}</p>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">
        {opts.map((opt) => {
          const selected = value === opt
          return (
            <button
              key={opt}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(opt)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              } ${readOnly ? 'pointer-events-none opacity-70' : ''}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
