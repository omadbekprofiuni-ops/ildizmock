import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/stores/auth'

const IDLE_LIMIT_MS = 10 * 60 * 1000 // 10 daqiqa

// Test paytida foydalanuvchi sukutda passage o'qiyotgan bo'lishi mumkin —
// bu sahifalarda idle-logout o'chirilgan.
const SKIP_PATH_PREFIXES = ['/take/', '/mock/']

export function useIdleLogout() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    // Login bo'lmagan — yoki test sahifasida — taymer kerak emas.
    if (!user) return
    const onTestPage = SKIP_PATH_PREFIXES.some((p) =>
      location.pathname.startsWith(p),
    )
    if (onTestPage) return

    const triggerLogout = async () => {
      try {
        await logout()
      } finally {
        navigate('/login', { replace: true, state: { idle: true } })
      }
    }

    const reset = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(triggerLogout, IDLE_LIMIT_MS)
    }

    const events: (keyof DocumentEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      events.forEach((e) => document.removeEventListener(e, reset))
    }
  }, [user, location.pathname, logout, navigate])
}
