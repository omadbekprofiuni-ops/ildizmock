import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  storageKey?: string
  defaultRatio?: number
  minRatio?: number
  maxRatio?: number
  left: ReactNode
  right: ReactNode
}

export function SplitPane({
  storageKey,
  defaultRatio = 0.5,
  minRatio = 0.3,
  maxRatio = 0.7,
  left,
  right,
}: Props) {
  const [ratio, setRatio] = useState<number>(() => {
    if (!storageKey) return defaultRatio
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return defaultRatio
    const n = Number(raw)
    if (!Number.isFinite(n) || n < minRatio || n > maxRatio) return defaultRatio
    return n
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (!storageKey) return
    sessionStorage.setItem(storageKey, String(ratio))
  }, [ratio, storageKey])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const r = (e.clientX - rect.left) / rect.width
      const clamped = Math.min(maxRatio, Math.max(minRatio, r))
      setRatio(clamped)
    }
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [maxRatio, minRatio])

  const startDrag = () => {
    draggingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
      <div
        className="min-w-0 overflow-y-auto border-r border-slate-200 bg-white"
        style={{ width: `${ratio * 100}%` }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startDrag}
        onDoubleClick={() => setRatio(defaultRatio)}
        className="group relative w-1.5 shrink-0 cursor-col-resize bg-slate-100 transition-colors hover:bg-brand-300 active:bg-brand-500"
        title="Drag to resize · Double-click to reset"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 group-hover:bg-white" />
      </div>
      <div
        className="min-w-0 flex-1 overflow-y-auto bg-white"
        style={{ width: `${(1 - ratio) * 100}%` }}
      >
        {right}
      </div>
    </div>
  )
}
