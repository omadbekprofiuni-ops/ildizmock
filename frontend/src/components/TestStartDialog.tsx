import { AlertTriangle, Clock, Headphones, Maximize2, ShieldX } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  open: boolean
  module: 'listening' | 'reading' | 'writing' | 'speaking'
  onConfirm: () => void
  onCancel: () => void
}

export function TestStartDialog({ open, module, onConfirm, onCancel }: Props) {
  const [agreed, setAgreed] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">IELTS Test rules</DialogTitle>
          <DialogDescription>
            Read carefully before starting.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm">
          <Rule Icon={Clock} text="Time is strict — the test auto-submits when it ends." />
          <Rule Icon={Maximize2} text="Test runs in fullscreen mode. If you exit, it will return." />
          <Rule
            Icon={ShieldX}
            text="Tab almashtirish, F12 (DevTools), copy/paste, right-click bloklangan."
          />
          <Rule
            Icon={AlertTriangle}
            text="If the tab changes 3 times — test auto-submits as cheating."
          />
          {module === 'listening' && (
            <Rule
              Icon={Headphones}
              text="Audio plays once. No pause and no replay."
            />
          )}
        </ul>

        <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border bg-slate-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            I have read the rules and agree to start the test. Once the test
            Once I start, I cannot go back.
          </span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={!agreed}
            className="bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:bg-slate-300 disabled:text-white"
          >
            Start →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Rule({
  Icon, text,
}: {
  Icon: React.ComponentType<{ className?: string }>
  text: string
}) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
      <span className="text-slate-800">{text}</span>
    </li>
  )
}
