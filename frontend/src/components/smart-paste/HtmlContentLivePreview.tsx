import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { HtmlPartRenderer } from '@/components/test-runner/HtmlPartRenderer'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api } from '@/lib/api'

interface Props {
  /** DSL manba matni (admin tahrir qilayotgan). */
  source: string
  /** Answer key (validation uchun). Optional. */
  answerKey?: Record<number, unknown>
}

interface PreviewResponse {
  html: string
  validation: {
    ok: boolean
    declared_questions: number[]
    answered_questions: number[]
    errors: string[]
    warnings: string[]
  }
}

/**
 * ETAP 30 — admin DSL manba'ni 800ms debounce bilan backend'ga yuboradi
 * va parse qilingan HTML'ni jonli ko'rsatadi.
 */
export function HtmlContentLivePreview({ source, answerKey }: Props) {
  const debounced = useDebouncedValue(source, 800)
  const [data, setData] = useState<PreviewResponse | null>(null)

  const previewMutation = useMutation({
    mutationFn: async (payload: {
      source: string
      answer_key?: Record<number, unknown>
    }) =>
      (await api.post<PreviewResponse>('/admin/html-content/preview/', payload))
        .data,
    onSuccess: (resp) => setData(resp),
  })

  useEffect(() => {
    if (!debounced.trim()) {
      setData(null)
      return
    }
    previewMutation.mutate({
      source: debounced,
      answer_key: answerKey,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, JSON.stringify(answerKey ?? {})])

  if (!debounced.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Manba matnni yozing — preview shu yerda ko'rinadi.
      </div>
    )
  }

  if (!data && previewMutation.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Tahlil qilinmoqda…
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-4">
      {data.validation.errors.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-semibold text-rose-800">
            <AlertTriangle className="h-4 w-4" /> Validatsiya xatolari
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-rose-800">
            {data.validation.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {data.validation.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Ogohlantirishlar
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-amber-800">
            {data.validation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {data.validation.errors.length === 0
        && data.validation.warnings.length === 0
        && data.validation.declared_questions.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {data.validation.declared_questions.length} ta savol parsed —
          hammasi mos.
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Talaba ko'radigan HTML preview
        </p>
        <HtmlPartRenderer
          html={data.html}
          answers={{}}
          onAnswer={() => {
            /* preview-only, javoblar saqlanmaydi */
          }}
          readOnly
        />
      </div>
    </div>
  )
}
