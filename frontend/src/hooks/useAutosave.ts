import { useEffect, useRef, useState } from 'react'

import { api } from '@/lib/api'

type Status = 'idle' | 'saving' | 'saved' | 'error'

type Options<T> = {
  /** Endpoint URL — receives PATCH with the serialised payload. */
  url: string | null
  /** The current draft. Pass null to disable autosave (e.g., before id is known). */
  data: T | null
  /** Map the draft to the JSON body the backend expects. */
  serialize: (data: T) => unknown
  /** Debounce in ms (default 1500). */
  debounceMs?: number
  /** Disable autosave (e.g., until first manual save creates the resource). */
  enabled?: boolean
}

/**
 * Debounced autosave that PATCHes a JSON body to the given URL whenever
 * the serialised draft changes. Also fires on tab close via fetch keepalive
 * so an unsaved-on-refresh window stays under ~1.5s.
 */
export function useAutosave<T>({
  url,
  data,
  serialize,
  debounceMs = 1500,
  enabled = true,
}: Options<T>) {
  const lastSerialized = useRef<string>('')
  const initial = useRef<boolean>(true)
  const [status, setStatus] = useState<Status>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Track the latest serialised body for the beforeunload handler.
  const latestBody = useRef<string>('')

  useEffect(() => {
    if (!enabled || !url || data == null) return
    const body = JSON.stringify(serialize(data))
    latestBody.current = body
    if (body === lastSerialized.current) return
    if (initial.current) {
      // First call after data loads — record the baseline, don't fire.
      initial.current = false
      lastSerialized.current = body
      return
    }
    const t = setTimeout(async () => {
      setStatus('saving')
      setError(null)
      try {
        await api.patch(url, JSON.parse(body))
        lastSerialized.current = body
        setStatus('saved')
        setSavedAt(new Date())
      } catch (e: unknown) {
        setStatus('error')
        const detail = (e as { response?: { data?: unknown } })?.response?.data
        setError(typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 160))
      }
    }, debounceMs)
    return () => clearTimeout(t)
  }, [url, data, serialize, debounceMs, enabled])

  // Best-effort save on tab close. fetch keepalive is more reliable than
  // sendBeacon for JSON+credentials in modern browsers.
  useEffect(() => {
    if (!enabled || !url) return
    const handler = () => {
      if (latestBody.current === lastSerialized.current) return
      try {
        fetch(url.startsWith('http') ? url : `/api/v1${url}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: latestBody.current,
          keepalive: true,
        })
      } catch {
        /* swallowed — best effort */
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [enabled, url])

  return { status, savedAt, error }
}
