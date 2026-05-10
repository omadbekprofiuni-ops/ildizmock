import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface Props {
  visible: boolean
  countdown: number
  onReturn: () => void
}

export function FullscreenReturnModal({ visible, countdown, onReturn }: Props) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-rose-900/85 p-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mb-3 flex justify-center">
          <AlertTriangle className="h-12 w-12 text-rose-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-rose-700">
          Return to fullscreen
        </h2>
        <p className="mb-6 text-slate-700">
          You have left fullscreen mode. Click below within{' '}
          <strong className="mx-1">{countdown}</strong> second
          {countdown === 1 ? '' : 's'}, or this will count as a violation.
        </p>
        <Button
          onClick={onReturn}
          className="w-full bg-rose-600 hover:bg-rose-700"
        >
          Return to test
        </Button>
      </div>
    </div>
  )
}
