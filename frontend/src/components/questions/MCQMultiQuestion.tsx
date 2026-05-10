import type { QuestionProps } from './types'

interface PayloadOption {
  id: string
  text: string
}

function getOptions(question: QuestionProps['question']): PayloadOption[] {
  const payload = question.payload as
    | { options?: PayloadOption[]; select_count?: number }
    | undefined
  if (payload?.options?.length) return payload.options
  return question.options.map((text, i) => ({
    id: String.fromCharCode(65 + i),
    text,
  }))
}

function getSelectCount(question: QuestionProps['question']): number {
  const payload = question.payload as { select_count?: number } | undefined
  return payload?.select_count && payload.select_count > 0 ? payload.select_count : 2
}

export function MCQMultiQuestion({
  question,
  value,
  onChange,
  number,
  readOnly,
}: QuestionProps) {
  const options = getOptions(question)
  const max = getSelectCount(question)

  const selected: string[] = Array.isArray(value)
    ? (value as string[])
    : typeof value === 'string' && value
      ? value.split(/\s*,\s*/).filter(Boolean)
      : []

  const toggle = (id: string) => {
    if (readOnly) return
    let next: string[]
    if (selected.includes(id)) {
      next = selected.filter((x) => x !== id)
    } else {
      next = [...selected, id]
      if (next.length > max) next = next.slice(-max)
    }
    next.sort()
    onChange(next.length > 0 ? next : null)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <span className="font-semibold text-slate-900">{number}.</span>
        <p className="text-slate-800">{question.text || question.prompt}</p>
      </div>
      <p className="pl-7 text-xs font-medium text-slate-500">
        Choose {max} answers
      </p>
      <div className="space-y-2 pl-7">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id)
          return (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors ${
                isSelected
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:bg-slate-50'
              } ${readOnly ? 'pointer-events-none opacity-90' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(opt.id)}
                disabled={readOnly}
                className="mt-1 h-4 w-4 accent-slate-900"
              />
              <span className="font-medium text-slate-700">{opt.id}</span>
              <span className="text-slate-800">{opt.text}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
