import { useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'

import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

export function RequireCenterAdmin() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuth((s) => s.user)
  const initialised = useAuth((s) => s.initialised)
  const [isMember, setIsMember] = useState<boolean | null>(null)

  useEffect(() => {
    if (!initialised || !user || !slug) return
    if (user.role === 'superadmin' || user.role === 'super_admin') {
      setIsMember(true)
      return
    }
    let cancelled = false
    api
      .get(`/center/${slug}/students/`)
      .then(() => {
        if (!cancelled) setIsMember(true)
      })
      .catch(() => {
        if (!cancelled) setIsMember(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, slug, initialised])

  if (!initialised || (user && isMember === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }
  if (!user) return <Navigate to={`/${slug}/login`} replace />
  if (!isMember) return <Navigate to="/" replace />

  return <Outlet />
}
