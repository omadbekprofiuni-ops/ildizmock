import { useCallback, useEffect, useMemo, useState } from 'react'

import type { HighlightRange } from '@/components/test-runner/Highlightable'

type HighlightMap = Record<number, HighlightRange[]>

const KEY_PREFIX = 'cdielts:highlights:'

function readStorage(attemptId: string): HighlightMap {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + attemptId)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStorage(attemptId: string, map: HighlightMap) {
  try {
    sessionStorage.setItem(KEY_PREFIX + attemptId, JSON.stringify(map))
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function useHighlights(attemptId: string) {
  const [map, setMap] = useState<HighlightMap>(() => readStorage(attemptId))

  useEffect(() => {
    writeStorage(attemptId, map)
  }, [attemptId, map])

  const get = useCallback(
    (passageId: number): HighlightRange[] => map[passageId] ?? [],
    [map],
  )

  const set = useCallback((passageId: number, ranges: HighlightRange[]) => {
    setMap((prev) => ({ ...prev, [passageId]: ranges }))
  }, [])

  const clearAll = useCallback(() => setMap({}), [])

  return useMemo(() => ({ get, set, clearAll }), [get, set, clearAll])
}
