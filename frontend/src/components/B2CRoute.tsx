import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/stores/auth'

/**
 * ETAP 14 — Faqat B2C (`role='b2c_user'`) foydalanuvchilarni o'tkazadi.
 * Anon foydalanuvchi → `/b2c/login`, B2B foydalanuvchi → home sahifasi.
 */
export function B2CRoute({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const initialised = useAuth((s) => s.initialised)

  if (!initialised) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/b2c/login" replace />
  if (user.role !== 'b2c_user') return <Navigate to="/home" replace />
  return <>{children}</>
}
