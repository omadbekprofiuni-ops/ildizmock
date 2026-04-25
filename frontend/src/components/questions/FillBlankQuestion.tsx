import { Fragment } from 'react'

import type { QuestionProps } from './types'

const BLANK_RE = /_{3,}/

export function FillBlankQuestion({
  question,
  value,
  onChange,
  number,
  readOnly,
}: QuestionProps) {
  const parts = question.text.split(BLANK_RE)
  const hasBlank = parts.length > 1

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-slate-900">{number}.</span>
        {hasBlank ? (
          parts.map((part, i) => (
            <Fragment key={i}>
              <span className="text-slate-800">{part}</span>
              {i < parts.length - 1 && (
                <input
                  type="text"
                  value={(value as string) ?? ''}
                  onChange={(e) => onChange(e.target.value || null)}
                  readOnly={readOnly}
                  className={`inline-block w-40 border-b-2 border-slate-400 bg-transparent px-1 py-0.5 text-slate-900 focus:border-slate-900 focus:outline-none ${readOnly ? 'pointer-events-none' : ''}`}
                  placeholder="..."
                />
              )}
            </Fragment>
          ))
        ) : (
          <>
            <p className="text-slate-800">{question.text}</p>
            <input
              type="text"
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value || null)}
              readOnly={readOnly}
              className={`ml-2 w-40 border-b-2 border-slate-400 bg-transparent px-1 py-0.5 text-slate-900 focus:border-slate-900 focus:outline-none ${readOnly ? 'pointer-events-none' : ''}`}
              placeholder="..."
            />
          </>
        )}
      </div>
    </div>
  )
}
