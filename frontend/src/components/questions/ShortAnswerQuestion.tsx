import type { QuestionProps } from './types'

export function ShortAnswerQuestion({
  question,
  value,
  onChange,
  number,
  readOnly,
}: QuestionProps) {
  const payload = (question.payload ?? {}) as {
    stem?: string
    word_limit?: number
  }
  const stem = payload.stem || question.text || question.prompt || ''
  const wordLimit = payload.word_limit ?? 3

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <span className="font-semibold text-slate-900">{number}.</span>
        <p className="text-slate-800">{stem}</p>
      </div>
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
        readOnly={readOnly}
        placeholder="Your answer…"
        className={`ml-7 w-72 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
          readOnly ? 'pointer-events-none bg-slate-50' : ''
        }`}
      />
      <p className="ml-7 text-xs text-slate-500">
        NO MORE THAN {wordLimit} WORDS.
      </p>
    </div>
  )
}
