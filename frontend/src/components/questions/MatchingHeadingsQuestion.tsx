import type { QuestionProps } from './types'

interface Heading {
  id: string
  text: string
}

interface MatchingHeadingsPayload {
  headings?: Heading[]
  paragraphs?: string[]
  example?: { paragraph: string; heading: string }
}

function getPayload(
  question: QuestionProps['question'],
): MatchingHeadingsPayload {
  return (question.payload ?? {}) as MatchingHeadingsPayload
}

function readMatches(value: QuestionProps['value']): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>
  }
  return {}
}

export function MatchingHeadingsQuestion({
  question,
  value,
  onChange,
  number,
  readOnly,
}: QuestionProps) {
  const payload = getPayload(question)
  const headings = payload.headings ?? []
  const paragraphs = payload.paragraphs ?? []
  const example = payload.example
  const matches = readMatches(value)

  const setMatch = (paragraph: string, heading: string) => {
    if (readOnly) return
    const next = { ...matches }
    if (heading) next[paragraph] = heading
    else delete next[paragraph]
    onChange(Object.keys(next).length > 0 ? next : null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="mb-2 font-semibold text-slate-900">List of Headings</p>
        <ul className="space-y-1 text-slate-800">
          {headings.map((h) => (
            <li key={h.id}>
              <strong className="mr-1">{h.id}</strong> {h.text}
            </li>
          ))}
        </ul>
      </div>

      {example && (
        <p className="text-xs italic text-slate-500">
          Example: Paragraph <strong>{example.paragraph}</strong> →{' '}
          <strong>{example.heading}</strong>
        </p>
      )}

      <table className="w-full text-sm">
        <tbody>
          {paragraphs.map((para, i) => (
            <tr key={para} className="border-b border-slate-100">
              <td className="py-2 font-medium text-slate-900">
                {number + i}. Paragraph {para}
              </td>
              <td className="py-2 text-right">
                <select
                  value={matches[para] || ''}
                  onChange={(e) => setMatch(para, e.target.value)}
                  disabled={readOnly}
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
                >
                  <option value="">— Choose —</option>
                  {headings.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.id}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
