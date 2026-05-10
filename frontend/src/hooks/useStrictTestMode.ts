import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '@/lib/api'

export type ViolationType =
  | 'tab_switched'
  | 'window_blurred'
  | 'fullscreen_exited'
  | 'devtools_attempt'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'print_attempt'
  | 'save_attempt'
  | 'right_click'
  | 'view_source'
  | 'select_all'
  | 'other'

export interface ViolationInfo {
  type: ViolationType
  counted: boolean
  totalCounted: number
  limit: number
}

interface UseStrictTestModeOptions {
  attemptId: string
  enabled: boolean
  violationLimit: number
  /** Called whenever the backend reports auto_submitted=true. */
  onAutoSubmit: () => void
  /** Called when a violation is registered (counted or not). */
  onViolation?: (info: ViolationInfo) => void
}

/** Time (ms) the student is allowed to be out of focus before a violation
 *  is counted. Helps with OS notifications and focus flicker. */
const GRACE_MS = 500

/** Time (ms) to show the "return to fullscreen" countdown before counting. */
const FS_RETURN_GRACE_MS = 5000

function isInputLike(t: HTMLElement | null): boolean {
  if (!t) return false
  const tag = t.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (t.isContentEditable) return true
  return false
}

export function useStrictTestMode(opts: UseStrictTestModeOptions) {
  const {
    attemptId,
    enabled,
    violationLimit,
    onAutoSubmit,
    onViolation,
  } = opts

  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => !!document.fullscreenElement,
  )
  const [violationCount, setViolationCount] = useState(0)
  const [showFsReturnModal, setShowFsReturnModal] = useState(false)
  const [fsCountdown, setFsCountdown] = useState(0)
  const [latestViolation, setLatestViolation] = useState<ViolationInfo | null>(null)
  const blurStartRef = useRef<number | null>(null)
  const fsExitTimerRef = useRef<number | null>(null)
  const fsCountdownTimerRef = useRef<number | null>(null)

  // ─── record() — backend'ga POST qiladi, count yangilaydi, auto-submit chaqiradi
  const record = useCallback(
    async (
      type: ViolationType,
      durationMs?: number,
      metadata?: Record<string, unknown>,
    ) => {
      if (!enabled) return
      try {
        const resp = await api.post(
          `/student/attempts/${attemptId}/violations/`,
          {
            type,
            duration_ms: durationMs,
            metadata: {
              user_agent: navigator.userAgent,
              viewport: `${window.innerWidth}x${window.innerHeight}`,
              ...(metadata ?? {}),
            },
          },
        )
        const data = resp.data as {
          counted: boolean
          violations_total: number
          violation_limit: number
          auto_submitted: boolean
        }
        setViolationCount(data.violations_total)
        const info: ViolationInfo = {
          type,
          counted: data.counted,
          totalCounted: data.violations_total,
          limit: data.violation_limit,
        }
        setLatestViolation(info)
        onViolation?.(info)
        if (data.auto_submitted) onAutoSubmit()
      } catch (e) {
        // Silent — strict mode'ni serverga yozolmasak ham UX'ni buzmasin.
        // eslint-disable-next-line no-console
        console.error('Violation report failed:', e)
      }
    },
    [attemptId, enabled, onAutoSubmit, onViolation],
  )

  // ─── Fullscreen kirish
  const enterFullscreen = useCallback(async () => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>
      msRequestFullscreen?: () => Promise<void>
    }
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      else if (el.msRequestFullscreen) await el.msRequestFullscreen()
      setIsFullscreen(true)
      setShowFsReturnModal(false)
      if (fsExitTimerRef.current) {
        clearTimeout(fsExitTimerRef.current)
        fsExitTimerRef.current = null
      }
      if (fsCountdownTimerRef.current) {
        clearInterval(fsCountdownTimerRef.current)
        fsCountdownTimerRef.current = null
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Fullscreen request failed:', e)
    }
  }, [])

  // ─── Listenerlar
  useEffect(() => {
    if (!enabled) return

    const onFsChange = () => {
      const fs = !!(
        document.fullscreenElement
        || (document as Document & { webkitFullscreenElement?: Element })
          .webkitFullscreenElement
      )
      setIsFullscreen(fs)
      if (!fs) {
        // 5-soniyali grace period: agar talaba qaytmasa — violation
        setShowFsReturnModal(true)
        setFsCountdown(Math.floor(FS_RETURN_GRACE_MS / 1000))
        const start = Date.now()
        if (fsCountdownTimerRef.current) clearInterval(fsCountdownTimerRef.current)
        fsCountdownTimerRef.current = window.setInterval(() => {
          const remain = Math.max(0, FS_RETURN_GRACE_MS - (Date.now() - start))
          setFsCountdown(Math.ceil(remain / 1000))
          if (remain <= 0 && fsCountdownTimerRef.current) {
            clearInterval(fsCountdownTimerRef.current)
            fsCountdownTimerRef.current = null
          }
        }, 250)
        if (fsExitTimerRef.current) clearTimeout(fsExitTimerRef.current)
        fsExitTimerRef.current = window.setTimeout(() => {
          if (!document.fullscreenElement) {
            record('fullscreen_exited')
          }
          setShowFsReturnModal(false)
        }, FS_RETURN_GRACE_MS)
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)

    // Visibility change — tab switch
    const onVis = () => {
      if (document.hidden) {
        blurStartRef.current = Date.now()
      } else if (blurStartRef.current) {
        const dur = Date.now() - blurStartRef.current
        blurStartRef.current = null
        if (dur >= GRACE_MS) record('tab_switched', dur)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    // Window blur (Cmd+Tab, click outside, etc.)
    const onBlur = () => {
      if (blurStartRef.current === null) blurStartRef.current = Date.now()
    }
    const onFocus = () => {
      if (blurStartRef.current) {
        const dur = Date.now() - blurStartRef.current
        blurStartRef.current = null
        if (dur >= GRACE_MS && !document.hidden) {
          record('window_blurred', dur)
        }
      }
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    // Klaviatura shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey

      if (e.key === 'F12') {
        e.preventDefault()
        record('devtools_attempt')
        return
      }
      if (ctrl && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) {
        e.preventDefault()
        record('devtools_attempt')
        return
      }
      if (ctrl && k === 'u') {
        e.preventDefault()
        record('view_source')
        return
      }
      if (ctrl && k === 'p') {
        e.preventDefault()
        record('print_attempt')
        return
      }
      if (ctrl && k === 's') {
        e.preventDefault()
        record('save_attempt')
        return
      }
      if (ctrl && k === 'a') {
        const t = e.target as HTMLElement
        if (!isInputLike(t)) {
          e.preventDefault()
          record('select_all')
        }
        return
      }
      if (ctrl && k === 'c') {
        const t = e.target as HTMLElement
        if (!isInputLike(t)) {
          e.preventDefault()
          record('copy_attempt')
        }
        return
      }
      if (ctrl && k === 'v') {
        const t = e.target as HTMLElement
        if (!isInputLike(t)) {
          e.preventDefault()
          record('paste_attempt')
        }
        return
      }
      if (ctrl && k === 'x') {
        const t = e.target as HTMLElement
        if (!isInputLike(t)) {
          e.preventDefault()
          record('copy_attempt')
        }
        return
      }
    }
    document.addEventListener('keydown', onKeyDown)

    // Right-click
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      record('right_click')
    }
    document.addEventListener('contextmenu', onContextMenu)

    // Drag — PDF rasmlarni tortib chiqarishni bloklaymiz
    const onDragStart = (e: DragEvent) => e.preventDefault()
    document.addEventListener('dragstart', onDragStart)

    // Browser print menu
    const onBeforePrint = () => record('print_attempt')
    window.addEventListener('beforeprint', onBeforePrint)

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('dragstart', onDragStart)
      window.removeEventListener('beforeprint', onBeforePrint)
      if (fsExitTimerRef.current) clearTimeout(fsExitTimerRef.current)
      if (fsCountdownTimerRef.current) clearInterval(fsCountdownTimerRef.current)
    }
  }, [enabled, record])

  return {
    enterFullscreen,
    isFullscreen,
    violationCount,
    violationLimit,
    showFsReturnModal,
    fsCountdown,
    latestViolation,
  }
}
