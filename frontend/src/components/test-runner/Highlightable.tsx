import { useEffect, useMemo, useRef, useState } from 'react'

export interface HighlightRange {
  start: number
  end: number
}

interface HighlightableProps {
  text: string
  ranges: HighlightRange[]
  onChange: (ranges: HighlightRange[]) => void
  className?: string
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length === 0) return []
  const sorted = ranges
    .slice()
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)
  const out: HighlightRange[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
    } else {
      out.push({ ...r })
    }
  }
  return out
}

function subtractRange(
  ranges: HighlightRange[],
  target: HighlightRange,
): HighlightRange[] {
  const out: HighlightRange[] = []
  for (const r of ranges) {
    if (r.end <= target.start || r.start >= target.end) {
      out.push(r)
      continue
    }
    if (r.start < target.start) out.push({ start: r.start, end: target.start })
    if (r.end > target.end) out.push({ start: target.end, end: r.end })
  }
  return out
}

function rangeIntersects(ranges: HighlightRange[], target: HighlightRange): boolean {
  return ranges.some((r) => r.start < target.end && r.end > target.start)
}

function getCharOffset(container: HTMLElement, node: Node, offset: number): number {
  let total = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let cur = walker.nextNode()
  while (cur) {
    if (cur === node) return total + offset
    total += (cur.textContent ?? '').length
    cur = walker.nextNode()
  }
  return total
}

interface MenuState {
  x: number
  y: number
  range: HighlightRange
  alreadyHighlighted: boolean
}

export function Highlightable({
  text,
  ranges,
  onChange,
  className,
}: HighlightableProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  const segments = useMemo(() => {
    const merged = mergeRanges(ranges)
    const out: { start: number; end: number; highlighted: boolean }[] = []
    let cursor = 0
    for (const r of merged) {
      if (r.start > cursor) {
        out.push({ start: cursor, end: r.start, highlighted: false })
      }
      out.push({
        start: Math.max(r.start, cursor),
        end: r.end,
        highlighted: true,
      })
      cursor = r.end
    }
    if (cursor < text.length) {
      out.push({ start: cursor, end: text.length, highlighted: false })
    }
    return out
  }, [ranges, text])

  // Close menu on outside click / scroll / Escape
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const getSelectionRange = (): HighlightRange | null => {
    const root = ref.current
    if (!root) return null
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const r = sel.getRangeAt(0)
    if (r.collapsed) return null
    if (
      !root.contains(r.startContainer) ||
      !root.contains(r.endContainer)
    ) {
      return null
    }
    const start = getCharOffset(root, r.startContainer, r.startOffset)
    const end = getCharOffset(root, r.endContainer, r.endOffset)
    if (end <= start) return null
    return { start, end }
  }

  const applyHighlight = (range: HighlightRange) => {
    onChange(mergeRanges([...ranges, range]))
    window.getSelection()?.removeAllRanges()
    setMenu(null)
  }

  const removeHighlight = (range: HighlightRange) => {
    onChange(subtractRange(ranges, range))
    window.getSelection()?.removeAllRanges()
    setMenu(null)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Browser already selected the word at this position. Convert to highlight.
    const range = getSelectionRange()
    if (!range) return
    e.preventDefault()
    if (rangeIntersects(ranges, range)) {
      removeHighlight(range)
    } else {
      applyHighlight(range)
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    // Open the floating menu next to the selection.
    const range = getSelectionRange()
    if (!range) {
      setMenu(null)
      return
    }
    if (range.end - range.start < 1) return
    const intersects = rangeIntersects(ranges, range)
    setMenu({
      x: e.clientX,
      y: e.clientY,
      range,
      alreadyHighlighted: intersects,
    })
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    const range = getSelectionRange()
    if (!range) return
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      range,
      alreadyHighlighted: rangeIntersects(ranges, range),
    })
  }

  return (
    <>
      <div
        ref={ref}
        className={className}
        onDoubleClick={handleDoubleClick}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        style={{ userSelect: 'text' }}
      >
        {segments.map((seg, i) => {
          const slice = text.slice(seg.start, seg.end)
          if (seg.highlighted) {
            return (
              <mark
                key={i}
                className="rounded-sm bg-yellow-200 px-0 text-inherit"
                style={{ backgroundColor: '#FEF08A' }}
              >
                {slice}
              </mark>
            )
          }
          return <span key={i}>{slice}</span>
        })}
      </div>

      {menu && (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 text-xs shadow-lg"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y + 8, window.innerHeight - 50),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menu.alreadyHighlighted ? (
            <button
              type="button"
              onClick={() => removeHighlight(menu.range)}
              className="rounded px-2 py-1 hover:bg-slate-100"
            >
              Clear highlight
            </button>
          ) : (
            <button
              type="button"
              onClick={() => applyHighlight(menu.range)}
              className="rounded bg-yellow-100 px-2 py-1 font-medium text-slate-900 hover:bg-yellow-200"
            >
              Highlight
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenu(null)}
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  )
}
