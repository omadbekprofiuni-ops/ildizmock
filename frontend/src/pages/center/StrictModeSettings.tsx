import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

interface Settings {
  test_strict_mode_enabled: boolean
  test_violation_limit: number
}

const PRESETS = [0, 1, 3, 5, 10] as const

export default function StrictModeSettings() {
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['strict-mode-settings'],
    queryFn: async () =>
      (await api.get<Settings>('/admin/strict-mode-settings/')).data,
  })

  const [enabled, setEnabled] = useState(true)
  const [limit, setLimit] = useState(3)

  useEffect(() => {
    if (data) {
      setEnabled(data.test_strict_mode_enabled)
      setLimit(data.test_violation_limit)
    }
  }, [data])

  const save = useMutation({
    mutationFn: async () =>
      (await api.patch<Settings>('/admin/strict-mode-settings/', {
        test_strict_mode_enabled: enabled,
        test_violation_limit: limit,
      })).data,
    onSuccess: () => {
      toast.success('Strict mode settings saved')
      qc.invalidateQueries({ queryKey: ['strict-mode-settings'] })
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(detail || 'Save failed')
    },
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
        Could not load settings.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Lock className="h-6 w-6 text-brand-600" />
        <h1 className="text-2xl font-bold text-slate-900">
          Strict Test Mode Settings
        </h1>
      </div>
      <p className="text-sm text-slate-600">
        These settings apply to all tests in your center.
      </p>

      <div className="mt-8 space-y-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-slate-900">Enable strict mode</h3>
            <p className="text-sm text-slate-600">
              Students see fullscreen lockdown, blocked shortcuts, and
              tab-switch detection.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`h-7 w-12 rounded-full transition-colors ${
              enabled ? 'bg-brand-600' : 'bg-slate-300'
            }`}
            aria-pressed={enabled}
          >
            <span
              className={`block h-5 w-5 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <h3 className="font-medium text-slate-900">Violation limit</h3>
          <p className="mb-2 text-sm text-slate-600">
            Auto-submit after this many violations. Set 0 to disable
            auto-submit (events are still logged).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={20}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-24 rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <span className="text-sm text-slate-500">violations</span>
          </div>
          <div className="mt-2 flex gap-2">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLimit(n)}
                className={`rounded border px-3 py-1 text-sm transition-colors ${
                  limit === n
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {n === 0 ? 'Off' : n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-6"
      >
        {save.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          'Save settings'
        )}
      </Button>

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <h4 className="mb-2 font-semibold text-slate-800">
          ⚠️ Honest note for admins
        </h4>
        <p>
          Strict mode is a deterrent, not a guarantee. A determined cheater
          with a second device or someone in the room can still cheat. For
          high-stakes mock tests, combine strict mode with:
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          <li>In-person test rooms</li>
          <li>Live video proctoring (Zoom / Google Meet)</li>
          <li>A second device camera pointed at the student</li>
        </ul>
      </div>
    </div>
  )
}
