import { useCallback, useEffect, useMemo, useState } from 'react'

const KEY_PREFIX = 'cdielts:flags:'

function read(attemptId: string): Set<number> {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + attemptId)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((n): n is number => typeof n === 'number'))
  } catch {
    return new Set()
  }
}

function write(attemptId: string, flags: Set<number>) {
  try {
    sessionStorage.setItem(KEY_PREFIX + attemptId, JSON.stringify([...flags]))
  } catch {
    /* ignore */
  }
}

export function useReviewFlags(attemptId: string) {
  const [flags, setFlags] = useState<Set<number>>(() => read(attemptId))

  useEffect(() => {
    write(attemptId, flags)
  }, [attemptId, flags])

  const has = useCallback(
    (qid: number) => flags.has(qid),
    [flags],
  )

  const toggle = useCallback((qid: number) => {
    setFlags((prev) => {
      const next = new Set(prev)
      if (next.has(qid)) next.delete(qid)
      else next.add(qid)
      return next
    })
  }, [])

  const clearAll = useCallback(() => setFlags(new Set()), [])

  return useMemo(
    () => ({ flags, has, toggle, clearAll }),
    [flags, has, toggle, clearAll],
  )
}
