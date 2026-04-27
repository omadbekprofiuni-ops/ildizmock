export interface Question {
  id: number
  question_number: number
  question_type: string
  prompt: string
  text: string
  options: string[]
  instruction?: string
  order: number
}

export function QuestionRenderer({
  question,
  index,
  value,
  onChange,
}: {
  question: Question
  index: number
  value: unknown
  onChange: (v: unknown) => void
}) {
  const label =
    question.question_number > 0 ? question.question_number : index + 1
  const text = question.prompt || question.text

  if (question.question_type === 'mcq') {
    return (
      <div>
        <p className="mb-2 font-medium">
          <span className="mr-2 inline-block min-w-[24px] rounded-full bg-slate-200 px-2 text-center text-sm font-bold">
            {label}
          </span>
          {text}
        </p>
        <div className="space-y-1 pl-8">
          {(question.options || []).map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-slate-50"
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (
    question.question_type === 'tfng' ||
    question.question_type === 'ynng'
  ) {
    const opts =
      question.question_type === 'tfng'
        ? ['TRUE', 'FALSE', 'NOT GIVEN']
        : ['YES', 'NO', 'NOT GIVEN']
    return (
      <div>
        <p className="mb-2 font-medium">
          <span className="mr-2 inline-block min-w-[24px] rounded-full bg-slate-200 px-2 text-center text-sm font-bold">
            {label}
          </span>
          {text}
        </p>
        <div className="flex flex-wrap gap-3 pl-8">
          {opts.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              <span className="text-sm font-medium">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (
    question.question_type === 'matching' ||
    question.question_type === 'matching_headings'
  ) {
    return (
      <div>
        <p className="mb-2 font-medium">
          <span className="mr-2 inline-block min-w-[24px] rounded-full bg-slate-200 px-2 text-center text-sm font-bold">
            {label}
          </span>
          {text}
        </p>
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="ml-8 rounded border border-slate-300 px-3 py-1.5"
        >
          <option value="">— Tanlang —</option>
          {(question.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // Default: fill / gap_fill / short_answer / form_completion / etc.
  return (
    <div>
      <p className="mb-2 font-medium">
        <span className="mr-2 inline-block min-w-[24px] rounded-full bg-slate-200 px-2 text-center text-sm font-bold">
          {label}
        </span>
        {text}
      </p>
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Javobni kiriting"
        className="ml-8 w-full max-w-md rounded border border-slate-300 px-3 py-1.5"
      />
    </div>
  )
}
