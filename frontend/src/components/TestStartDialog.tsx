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
          <DialogTitle className="text-xl">IELTS Test qoidalari</DialogTitle>
          <DialogDescription>
            Startdan oldin diqqat bilan o‘qib chiqing.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm">
          <Rule Icon={Clock} text="Vaqt qat'iy — tugagach test avto-submit qilinadi." />
          <Rule Icon={Maximize2} text="Test fullscreen rejimida bo'ladi. Chiqsangiz qaytaradi." />
          <Rule
            Icon={ShieldX}
            text="Tab almashtirish, F12 (DevTools), copy/paste, right-click bloklangan."
          />
          <Rule
            Icon={AlertTriangle}
            text="Tab 3 marta o'zgarsa — test cheating sifatida avto-submit qilinadi."
          />
          {module === 'listening' && (
            <Rule
              Icon={Headphones}
              text="Audio bir marta eshitiladi. Pause va replay yo'q."
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
            Men qoidalarni o‘qib chiqdim va test boshlashga roziman. Test
            boshlasam, qaytib bo‘lmaydi.
          </span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={!agreed}
            className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]"
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
