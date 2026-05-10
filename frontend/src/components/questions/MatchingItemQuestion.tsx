import type { QuestionProps } from './types'

interface Item {
  id: number | string
  text: string
}

interface Option {
  id: string
  text: string
}

interface MatchingItemPayload {
  items?: Item[]
  options?: Option[]
  options_can_repeat?: boolean
}

function readPayload(question: QuestionProps['question']): MatchingItemPayload {
  return (question.payload ?? {}) as MatchingItemPayload
}

function readMatches(value: QuestionProps['value']): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>
  }
  return {}
}

export function MatchingItemQuestion({
  question,
  value,
  onChange,
  number,
  readOnly,
}: QuestionProps) {
  const payload = readPayload(question)
  const items = payload.items ?? []
  const options = payload.options ?? []
  const matches = readMatches(value)
  const canRepeat = payload.options_can_repeat ?? true

  // Single-row fallback — older format used items=[{id:1, text:'…'}] with one row.
  if (items.length <= 1 && options.length > 0) {
    const itemId = String(items[0]?.id ?? 1)
    const stem = items[0]?.text || question.text || question.prompt || ''
    return (
      <div className="grid grid-cols-[40px_1fr_minmax(200px,280px)] items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
        <span className="font-semibold text-slate-900">{number}.</span>
        <p className="text-slate-800">{stem}</p>
        <select
          value={matches[itemId] || ''}
          onChange={(e) => {
            const next = { ...matches }
            if (e.target.value) next[itemId] = e.target.value
            else delete next[itemId]
            onChange(Object.keys(next).length > 0 ? next : null)
          }}
          disabled={readOnly}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
        >
          <option value="">— Choose —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id}. {o.text.slice(0, 50)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const usedCounts: Record<string, number> = {}
  for (const v of Object.values(matches)) {
    usedCounts[v] = (usedCounts[v] ?? 0) + 1
  }

  const setMatch = (itemId: string, optionId: string) => {
    if (readOnly) return
    const next = { ...matches }
    if (optionId) next[itemId] = optionId
    else delete next[itemId]
    onChange(Object.keys(next).length > 0 ? next : null)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="mb-2 font-semibold text-slate-900">Options</p>
        <ul className="space-y-1 text-slate-800">
          {options.map((o) => (
            <li key={o.id}>
              <strong className="mr-1">{o.id}</strong> {o.text}
            </li>
          ))}
        </ul>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {items.map((item, i) => {
            const itemId = String(item.id)
            return (
              <tr key={itemId} className="border-b border-slate-100">
                <td className="w-12 py-2 align-top font-semibold text-slate-900">
                  {number + i}.
                </td>
                <td className="py-2 pr-3 align-top text-slate-800">{item.text}</td>
                <td className="w-44 py-2 text-right align-top">
                  <select
                    value={matches[itemId] || ''}
                    onChange={(e) => setMatch(itemId, e.target.value)}
                    disabled={readOnly}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
                  >
                    <option value="">— Choose —</option>
                    {options.map((o) => {
                      const used = (usedCounts[o.id] ?? 0) > 0
                      const isThisRow = matches[itemId] === o.id
                      const disabled = !canRepeat && used && !isThisRow
                      return (
                        <option key={o.id} value={o.id} disabled={disabled}>
                          {o.id}
                        </option>
                      )
                    })}
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
