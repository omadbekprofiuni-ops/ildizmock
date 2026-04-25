import type { QuestionProps } from './types'

export function MatchingQuestion({
  question,
  value,
  onChange,
  number,
  readOnly,
}: QuestionProps) {
  return (
    <div className="grid grid-cols-[40px_1fr_minmax(200px,280px)] items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
      <span className="font-semibold text-slate-900">{number}.</span>
      <p className="text-slate-800">{question.text}</p>
      <select
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={readOnly}
        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
      >
        <option value="">— tanlang —</option>
        {question.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}
