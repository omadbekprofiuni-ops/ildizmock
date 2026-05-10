import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ViolationInfo } from '@/hooks/useStrictTestMode'

const TYPE_LABEL: Record<string, string> = {
  tab_switched: 'You switched tabs',
  window_blurred: 'The window lost focus',
  fullscreen_exited: 'You exited fullscreen',
  devtools_attempt: 'You tried to open DevTools',
  copy_attempt: 'You tried to copy text',
  paste_attempt: 'You tried to paste text',
  print_attempt: 'You tried to print',
  save_attempt: 'You tried to save the page',
  right_click: 'You right-clicked',
  view_source: 'You tried to view source',
  select_all: 'You tried to select all',
  other: 'Suspicious activity detected',
}

interface Props {
  violation: ViolationInfo | null
}

export function ViolationBanner({ violation }: Props) {
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (violation && violation.counted) {
      setHidden(false)
      const t = setTimeout(() => setHidden(true), 4000)
      return () => clearTimeout(t)
    }
  }, [violation])

  if (!violation || !violation.counted || hidden) return null

  const remaining = Math.max(0, violation.limit - violation.totalCounted)

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[55] -translate-x-1/2 transform">
      <div className="flex items-center gap-3 rounded-lg bg-rose-600 px-5 py-3 shadow-2xl">
        <AlertTriangle className="h-6 w-6 text-white" />
        <div className="text-white">
          <div className="font-bold">
            Violation {violation.totalCounted} of {violation.limit}
          </div>
          <div className="text-sm opacity-90">
            {TYPE_LABEL[violation.type] || 'Violation detected'} —{' '}
            {remaining} {remaining === 1 ? 'attempt' : 'attempts'} remaining
          </div>
        </div>
      </div>
    </div>
  )
}
