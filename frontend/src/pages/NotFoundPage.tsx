import { Link, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/stores/auth'

function pickHome(
  pathname: string,
  user: ReturnType<typeof useAuth.getState>['user'],
): { to: string; label: string } {
  // 1) Slug-li markaz panelidan kelgan bo'lsa — markaz dashboardiga
  const slugMatch = pathname.match(/^\/([^/]+)\/admin(\/|$)/)
  if (slugMatch && user) {
    return { to: `/${slugMatch[1]}/admin`, label: 'Back to center panel' }
  }

  // 2) /super/* dan — superadmin dashboardiga
  if (pathname.startsWith('/super') && user) {
    return { to: '/super', label: 'Super Admin paneliga qaytish' }
  }

  // 3) /admin/* (legacy) dan — admin dashboardiga
  if (pathname.startsWith('/admin') && user) {
    return { to: '/admin', label: 'Admin paneliga qaytish' }
  }

  // 4) /teacher/* dan — teacher paneliga
  if (pathname.startsWith('/teacher') && user) {
    return { to: '/teacher', label: 'Back to teacher panel' }
  }

  // 5) Auth bo'lgan oddiy user — talaba dashboardiga
  if (user) {
    if (user.role === 'superadmin' || user.role === 'super_admin') {
      return { to: '/super', label: 'Super Admin paneliga qaytish' }
    }
    if (user.role === 'org_admin' || user.role === 'admin') {
      return user.org_slug
        ? { to: `/${user.org_slug}/admin`, label: 'Back to center panel' }
        : { to: '/admin', label: 'Admin paneliga qaytish' }
    }
    if (user.role === 'teacher') {
      return { to: '/teacher', label: 'Back to teacher panel' }
    }
    return { to: '/dashboard', label: 'Dashboard ga qaytish' }
  }

  // 6) Mehmon — public homega
  return { to: '/', label: 'Homega qaytish' }
}

export default function NotFoundPage() {
  const location = useLocation()
  const user = useAuth((s) => s.user)
  const { to, label } = pickHome(location.pathname, user)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-6 text-center">
      <p className="text-7xl font-bold text-[var(--muted)]">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-[var(--muted)]">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to={to}>
        <Button>{label}</Button>
      </Link>
    </div>
  )
}
