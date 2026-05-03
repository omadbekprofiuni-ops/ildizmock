import { useEffect, useState } from 'react'

/**
 * Test bo'limi to'liq ekran (fullscreen) rejimida bo'lishini majburlaydi.
 * Foydalanuvchi tugmani bosmaguncha test ko'rinmaydi.
 * Fullscreen'dan chiqsa qayta overlay ko'rsatadi.
 */
export function FullscreenGate({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' && !!document.fullscreenElement,
  )
  const [error, setError] = useState('')

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const enter = async () => {
    setError('')
    try {
      const el = document.documentElement
      // Safari nomli `webkitRequestFullscreen` ham bor — type-cast qilamiz
      const req =
        el.requestFullscreen ||
        (el as unknown as { webkitRequestFullscreen?: () => Promise<void> })
          .webkitRequestFullscreen
      if (req) await req.call(el)
    } catch {
      setError(
        'Your browser refused fullscreen mode. Please check your browser settings.',
      )
    }
  }

  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 p-4 text-white">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">🖥️</div>
          <h1 className="mb-2 text-2xl font-bold">{title}</h1>
          <p className="mb-6 text-slate-300">
            The test runs only in <strong>fullscreen</strong> mode.
            Press the button to expand the screen and start the test.
          </p>
          <button
            type="button"
            onClick={enter}
            className="rounded-full bg-orange-500 px-8 py-3 text-lg font-semibold hover:bg-orange-600"
          >
            ▶ Enter fullscreen
          </button>
          {error && (
            <p className="mt-4 rounded bg-red-900/50 p-3 text-sm text-red-200">
              {error}
            </p>
          )}
          <p className="mt-6 text-xs text-slate-400">
            <strong>Note:</strong> ESC or F11 will exit fullscreen.
            If you exit, the test timer keeps running and the page stays
            hidden until you re-enter fullscreen.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
