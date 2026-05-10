import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

interface Violation {
  id: number
  type: string
  occurred_at: string
  duration_ms: number | null
  metadata: Record<string, unknown>
  counted: boolean
}

const TYPE_LABEL: Record<string, string> = {
  tab_switched: 'Tab switched',
  window_blurred: 'Window lost focus',
  fullscreen_exited: 'Exited fullscreen',
  devtools_attempt: 'DevTools attempted',
  copy_attempt: 'Copy attempted',
  paste_attempt: 'Paste attempted',
  print_attempt: 'Print attempted',
  save_attempt: 'Save attempted',
  right_click: 'Right-click attempted',
  view_source: 'View source attempted',
  select_all: 'Select-all attempted',
  other: 'Other',
}

const TYPE_SEVERITY: Record<string, 'low' | 'med' | 'high'> = {
  right_click: 'low',
  select_all: 'low',
  copy_attempt: 'med',
  paste_attempt: 'med',
  print_attempt: 'med',
  save_attempt: 'med',
  view_source: 'med',
  fullscreen_exited: 'high',
  tab_switched: 'high',
  window_blurred: 'high',
  devtools_attempt: 'high',
}

export default function AttemptViolationReport() {
  const { attemptId } = useParams<{ attemptId: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['attempt-violations', attemptId],
    queryFn: async () =>
      (await api.get<Violation[]>(`/admin/attempts/${attemptId}/violations/`)).data,
    enabled: !!attemptId,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="px-6 py-8 text-sm text-rose-600">
        Could not load violation report.
      </div>
    )
  }

  const list = Array.isArray(data) ? data : []
  const counted = list.filter((v) => v.counted)

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        to={-1 as unknown as string}
        onClick={(e) => {
          e.preventDefault()
          window.history.back()
        }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Violation Report</h1>
      <p className="mt-2 text-sm text-slate-600">
        Total events logged: <strong>{list.length}</strong> ·{' '}
        Counted toward limit: <strong>{counted.length}</strong>
      </p>

      {list.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 rounded-xl border bg-emerald-50 p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          <p className="font-medium text-emerald-800">
            No violations detected. Clean attempt.
          </p>
        </div>
      ) : (
        <table className="mt-6 w-full">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr className="border-b">
              <th className="py-2 text-left">When</th>
              <th className="py-2 text-left">Event</th>
              <th className="py-2 text-left">Severity</th>
              <th className="py-2 text-right">Duration</th>
              <th className="py-2 text-right">Counted</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => {
              const sev = TYPE_SEVERITY[v.type] || 'med'
              return (
                <tr key={v.id} className="border-b text-sm">
                  <td className="py-2">
                    {new Date(v.occurred_at).toLocaleTimeString()}
                  </td>
                  <td className="py-2 font-medium text-slate-900">
                    {TYPE_LABEL[v.type] || v.type}
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        sev === 'high'
                          ? 'bg-rose-100 text-rose-700'
                          : sev === 'med'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sev}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-xs">
                    {v.duration_ms ? `${(v.duration_ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="py-2 text-right">
                    {v.counted ? (
                      <span className="text-rose-600">✓</span>
                    ) : (
                      <span className="text-slate-300">— debounced</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
