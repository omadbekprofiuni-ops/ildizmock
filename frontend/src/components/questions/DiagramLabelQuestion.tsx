import type { QuestionProps } from './types'

interface Label {
  id: number | string
  x: number
  y: number
}

interface Option {
  id: string
  text: string
}

interface DiagramPayload {
  image_url?: string
  labels?: Label[]
  options?: Option[]
}

function readMatches(value: QuestionProps['value']): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>
  }
  return {}
}

export function DiagramLabelQuestion({
  question,
  value,
  onChange,
  number,
  readOnly,
}: QuestionProps) {
  const payload = (question.payload ?? {}) as DiagramPayload
  const imageUrl = payload.image_url || question.image_url || null
  const labels = payload.labels ?? []
  const options = payload.options ?? []
  const matches = readMatches(value)

  if (!imageUrl || labels.length === 0) {
    // Fallback: legacy single-row matching
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Diagram payload incomplete — image or pin coordinates missing.
      </div>
    )
  }

  const setMatch = (labelId: string, optionId: string) => {
    if (readOnly) return
    const next = { ...matches }
    if (optionId) next[labelId] = optionId
    else delete next[labelId]
    onChange(Object.keys(next).length > 0 ? next : null)
  }

  return (
    <div className="space-y-4">
      <div className="relative inline-block max-w-full overflow-hidden rounded-md border border-slate-200">
        <img
          src={imageUrl}
          alt="Diagram"
          className="block max-h-[420px] w-auto max-w-full object-contain"
          draggable={false}
        />
        {labels.map((l) => (
          <div
            key={l.id}
            style={{ left: l.x, top: l.y }}
            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brand-600 bg-white text-xs font-bold text-brand-700 shadow-sm"
            aria-hidden
          >
            {l.id}
          </div>
        ))}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {labels.map((l, i) => {
            const labelId = String(l.id)
            return (
              <tr key={labelId} className="border-b border-slate-100">
                <td className="w-20 py-2 font-semibold text-slate-900">
                  {number + i}.
                </td>
                <td className="py-2 text-slate-800">Label {labelId}</td>
                <td className="w-56 py-2 text-right">
                  <select
                    value={matches[labelId] || ''}
                    onChange={(e) => setMatch(labelId, e.target.value)}
                    disabled={readOnly}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
                  >
                    <option value="">— Choose —</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id}. {o.text}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
