import { Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface Props {
  violationLimit: number
  onAccept: () => void
  onCancel: () => void
}

export function StrictModeConsent({ violationLimit, onAccept, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-2xl rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <Lock className="h-7 w-7 text-brand-600" />
          <h2 className="text-2xl font-bold text-slate-900">Strict Test Mode</h2>
        </div>
        <p className="mb-4 text-slate-700">
          This test enforces strict anti-cheating rules. Once you click{' '}
          <strong>Start</strong>:
        </p>
        <ul className="mb-6 space-y-2 text-sm text-slate-800">
          <li className="flex items-start gap-2">
            <span className="text-brand-600">•</span>
            <span>The page enters <strong>fullscreen</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-600">•</span>
            <span>
              Switching tabs, exiting fullscreen, opening DevTools, copying text,
              printing, or right-clicking is <strong>logged as a violation</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-600">•</span>
            <span>
              You are allowed <strong>{violationLimit} violations</strong> total.
              After that, the test is <strong>auto-submitted</strong> and flagged.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-600">•</span>
            <span>Your teacher will see the full violation report.</span>
          </li>
        </ul>
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="mb-2 font-semibold text-amber-900">Before you start:</p>
          <ul className="list-disc space-y-0.5 pl-5 text-amber-900">
            <li>Close all other apps and browser tabs.</li>
            <li>Mute notifications (system, Telegram, email).</li>
            <li>Keep your phone away from your desk.</li>
            <li>Plug in your charger.</li>
          </ul>
        </div>
        <p className="mb-6 text-xs text-slate-500">
          Note: Cmd+Tab / Alt+Tab cannot be blocked at the browser level —
          but using them <strong>will be detected and counted</strong>.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onAccept}>I understand — Start test</Button>
        </div>
      </div>
    </div>
  )
}
