import { useEffect, useState } from 'react'

export function Timer({
  initialSeconds,
  onExpire,
}: {
  initialSeconds: number
  onExpire: () => void
}) {
  const [secs, setSecs] = useState(initialSeconds)

  useEffect(() => {
    setSecs(initialSeconds)
  }, [initialSeconds])

  useEffect(() => {
    if (secs <= 0) {
      onExpire()
      return
    }
    const id = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secs, onExpire])

  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  const danger = secs <= 60
  return (
    <div
      className={`font-mono text-3xl font-bold ${
        danger ? 'text-red-600' : 'text-slate-900'
      }`}
    >
      {m}:{s}
    </div>
  )
}
