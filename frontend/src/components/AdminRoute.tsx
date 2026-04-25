import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/stores/auth'

export function AdminRoute({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const initialised = useAuth((s) => s.initialised)

  if (!initialised) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  const isAdmin = user.role === 'admin' || user.role === 'super_admin'
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
