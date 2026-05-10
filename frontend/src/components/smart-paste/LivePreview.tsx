import { Loader2 } from 'lucide-react'

export interface PreviewQuestion {
  order: number
  qtype: string
  payload: Record<string, unknown>
  answer_key: Record<string, unknown>
  raw_text: string
  detection: {
    qtype: string
    confidence: number
    reason: string
    needs_confirm: boolean
  } | null
}

export interface PreviewSection {
  instructions: string
  warnings: string[]
  questions: PreviewQuestion[]
}

export interface PreviewData {
  passage_html: string
  passage_word_count: number
  paragraphs: string[]
  question_count: number
  warnings: string[]
  errors: string[]
  sections: PreviewSection[]
}

export function LivePreview({
  preview,
  loading,
}: {
  preview?: PreviewData | null
  loading: boolean
}) {
  if (loading && !preview) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Tahlil qilinmoqda…
      </div>
    )
  }
  if (!preview) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Live preview chap tomondagi maydonlarga kontent yopishtirgach paydo
        bo'ladi.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {preview.errors?.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="font-semibold text-red-900">Xatolar</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
            {preview.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-900">Xulosa</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li>
            Passage so'z soni:{' '}
            <strong>{preview.passage_word_count}</strong>
          </li>
          <li>
            Aniqlangan paragraflar:{' '}
            <strong>{preview.paragraphs.join(', ') || '—'}</strong>
          </li>
          <li>
            Savollar soni: <strong>{preview.question_count}</strong>
          </li>
          <li>
            Bo'limlar: <strong>{preview.sections.length}</strong>
          </li>
        </ul>
      </div>

      {preview.warnings?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">Ogohlantirishlar</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {preview.sections.map((s, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 className="font-semibold text-slate-900">
            {s.instructions || `Section ${i + 1}`}
          </h3>
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-10 text-left">#</th>
                <th className="text-left">Tur</th>
                <th className="text-left">Savol</th>
                <th className="text-left">Javob</th>
                <th className="w-16 text-right">Aniqlik</th>
              </tr>
            </thead>
            <tbody>
              {s.questions.map((q) => {
                const conf = q.detection?.confidence ?? 0
                const confColor =
                  conf > 0.85
                    ? 'text-emerald-600'
                    : conf > 0.5
                      ? 'text-amber-600'
                      : 'text-red-600'
                const ansShort = JSON.stringify(q.answer_key).slice(0, 40)
                return (
                  <tr key={q.order} className="border-t border-slate-100">
                    <td className="py-1.5 font-mono text-xs text-slate-500">
                      {q.order}
                    </td>
                    <td className="font-mono text-xs text-slate-700">
                      {q.qtype}
                    </td>
                    <td className="text-slate-700">
                      {q.raw_text.slice(0, 60)}
                      {q.raw_text.length > 60 ? '…' : ''}
                    </td>
                    <td className="font-mono text-xs text-slate-600">
                      {ansShort}
                    </td>
                    <td
                      className={`text-right text-xs font-semibold ${confColor}`}
                      title={q.detection?.reason ?? ''}
                    >
                      {Math.round(conf * 100)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {s.warnings?.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
              {s.warnings.map((w, j) => (
                <li key={j}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
