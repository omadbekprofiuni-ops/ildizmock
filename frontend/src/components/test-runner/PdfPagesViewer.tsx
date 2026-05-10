import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Aylantirilgan PDF sahifalarning to'liq URL'lari ro'yxati. */
  pages: string[]
  className?: string
}

/**
 * HOTFIX — PDF iframe Brave/Chrome shield bloklayotganligi uchun
 * sahifa rasmlari (PNG) galereya sifatida ko'rsatiladi.
 *
 * Xususiyatlari:
 * - Hech qanday iframe — `<img>` tagi hech qachon shield tomonidan bloklanmaydi
 * - O'ng tugma bloklanadi (oddiy anti-cheat)
 * - Drag bloklanadi (rasmni desktopga sudrab tashlab bo'lmaydi)
 * - `user-select: none` — matn tanlash/nusxalash bloklanadi
 * - Zoom +/- nazorati (50%–200%)
 * - "Page N of M" indikatori
 */
export function PdfPagesViewer({ pages, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [activePage, setActivePage] = useState(1)

  // Eng ko'rinadigan sahifani aniqlash uchun IntersectionObserver.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.page)
          if (idx) setActivePage(idx)
        }
      },
      { root: container, threshold: [0.3, 0.5, 0.7] },
    )

    container
      .querySelectorAll('[data-page]')
      .forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pages])

  if (!pages || pages.length === 0) {
    return (
      <div className={`flex items-center justify-center text-slate-400 ${className}`}>
        Bu bo'lim uchun kontent mavjud emas.
      </div>
    )
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 text-sm">
        <span className="text-slate-600">
          Sahifa <span className="font-semibold">{activePage}</span> /{' '}
          {pages.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
            className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="w-12 text-center font-mono text-slate-600">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
            className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setZoom(1)}
            className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Sahifalar */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 p-4">
        <div className="mx-auto flex flex-col items-center gap-4">
          {pages.map((src, i) => (
            <img
              key={src}
              data-page={i + 1}
              src={src}
              alt={`Sahifa ${i + 1}`}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                userSelect: 'none',
              }}
              className="max-w-full bg-white shadow"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
