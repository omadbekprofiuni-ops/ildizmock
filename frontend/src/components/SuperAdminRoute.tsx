import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/stores/auth'

export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const initialised = useAuth((s) => s.initialised)

  if (!initialised) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Yuklanmoqda…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'superadmin' && user.role !== 'super_admin') {
    return <Navigate to="/home" replace />
  }
  return <>{children}</>
}
