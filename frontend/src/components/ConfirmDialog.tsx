import { AlertTriangle } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { Button } from '@/components/ui/button'

type Tone = 'default' | 'danger'

type ConfirmOptions = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  tone?: Tone
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({})
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    const normalized: ConfirmOptions =
      typeof options === 'string' ? { description: options } : options
    setOpts(normalized)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const decide = (value: boolean) => {
    setOpen(false)
    if (resolverRef.current) {
      resolverRef.current(value)
      resolverRef.current = null
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') decide(false)
      if (e.key === 'Enter') decide(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const tone = opts.tone ?? 'default'
  const confirmLabel = opts.confirmText ?? 'Confirm'
  const cancelLabel = opts.cancelText ?? 'Cancel'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => decide(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex gap-3 px-6 pt-6">
              <div
                className={
                  tone === 'danger'
                    ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600'
                    : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600'
                }
              >
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                {opts.title && (
                  <h2 className="text-base font-semibold text-slate-900">
                    {opts.title}
                  </h2>
                )}
                {opts.description && (
                  <p className="mt-1 text-sm text-slate-600">
                    {opts.description}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => decide(false)}
                autoFocus
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                onClick={() => decide(true)}
                className={
                  tone === 'danger'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : ''
                }
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within <ConfirmProvider>')
  }
  return ctx
}
