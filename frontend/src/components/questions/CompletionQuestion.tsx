import { Fragment } from 'react'

import type { QuestionProps } from './types'

const PLACEHOLDER_RE = /\{\{(\d+)\}\}/g
const TRIPLE_UNDERSCORE_RE = /_{3,}/

interface CompletionPayload {
  template?: string
  template_html?: string
  word_limit?: number
}

function readBlanks(value: QuestionProps['value']): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') return [value]
  return []
}

export function CompletionQuestion({
  question,
  value,
  onChange,
  number,
  readOnly,
}: QuestionProps) {
  const payload = (question.payload ?? {}) as CompletionPayload
  const template = payload.template ?? payload.template_html ?? question.text ?? ''
  const wordLimit = payload.word_limit ?? 2
  const blanks = readBlanks(value)

  const setBlank = (idx: number, val: string) => {
    if (readOnly) return
    const next = [...blanks]
    while (next.length <= idx) next.push('')
    next[idx] = val
    // Trim trailing empties.
    while (next.length > 0 && !next[next.length - 1]) next.pop()
    onChange(next.length > 0 ? next : null)
  }

  // Prefer {{1}}-style placeholders when present.
  const hasNumeric = PLACEHOLDER_RE.test(template)
  PLACEHOLDER_RE.lastIndex = 0

  let nodes: React.ReactNode[]
  if (hasNumeric) {
    const parts = template.split(PLACEHOLDER_RE)
    nodes = parts.map((part, i) => {
      if (i % 2 === 0) {
        return (
          <span key={i} className="whitespace-pre-line text-slate-800">
            {part}
          </span>
        )
      }
      const blankIdx = Number(part) - 1
      return (
        <input
          key={i}
          type="text"
          value={blanks[blankIdx] ?? ''}
          onChange={(e) => setBlank(blankIdx, e.target.value)}
          readOnly={readOnly}
          className={`mx-1 inline-block w-32 rounded-sm border-b-2 border-slate-400 bg-amber-50 px-1 py-0.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none ${
            readOnly ? 'pointer-events-none' : ''
          }`}
          placeholder=""
        />
      )
    })
  } else if (TRIPLE_UNDERSCORE_RE.test(template)) {
    const parts = template.split(TRIPLE_UNDERSCORE_RE)
    nodes = parts.flatMap((part, i) => {
      const arr: React.ReactNode[] = [
        <span key={`t-${i}`} className="text-slate-800">
          {part}
        </span>,
      ]
      if (i < parts.length - 1) {
        arr.push(
          <input
            key={`b-${i}`}
            type="text"
            value={blanks[i] ?? ''}
            onChange={(e) => setBlank(i, e.target.value)}
            readOnly={readOnly}
            className={`mx-1 inline-block w-32 border-b-2 border-slate-400 bg-transparent px-1 py-0.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none ${
              readOnly ? 'pointer-events-none' : ''
            }`}
            placeholder="..."
          />,
        )
      }
      return arr
    })
  } else {
    nodes = [
      <Fragment key="single">
        <span className="text-slate-800">{template}</span>
        <input
          type="text"
          value={blanks[0] ?? ''}
          onChange={(e) => setBlank(0, e.target.value)}
          readOnly={readOnly}
          className={`ml-2 w-40 rounded-sm border-b-2 border-slate-400 bg-amber-50 px-1 py-0.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none ${
            readOnly ? 'pointer-events-none' : ''
          }`}
          placeholder="..."
        />
      </Fragment>,
    ]
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-slate-900">{number}.</span>
        {nodes}
      </div>
      <p className="ml-7 text-xs text-slate-500">
        NO MORE THAN {wordLimit} WORD{wordLimit > 1 ? 'S' : ''} per blank.
      </p>
    </div>
  )
}
