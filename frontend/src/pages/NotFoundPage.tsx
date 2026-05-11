import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '@/stores/auth'

function pickHome(
  pathname: string,
  user: ReturnType<typeof useAuth.getState>['user'],
): { to: string; label: string } {
  const slugMatch = pathname.match(/^\/([^/]+)\/admin(\/|$)/)
  if (slugMatch && user) {
    return { to: `/${slugMatch[1]}/admin`, label: 'Back to center panel' }
  }
  if (pathname.startsWith('/super') && user) {
    return { to: '/super', label: 'Back to Super Admin' }
  }
  if (pathname.startsWith('/admin') && user) {
    return { to: '/admin', label: 'Back to Admin panel' }
  }
  if (pathname.startsWith('/teacher') && user) {
    return { to: '/teacher', label: 'Back to teacher panel' }
  }
  if (user) {
    if (user.role === 'superadmin' || user.role === 'super_admin') {
      return { to: '/super', label: 'Back to Super Admin' }
    }
    if (user.role === 'org_admin' || user.role === 'admin') {
      return user.org_slug
        ? { to: `/${user.org_slug}/admin`, label: 'Back to center panel' }
        : { to: '/admin', label: 'Back to Admin panel' }
    }
    if (user.role === 'teacher') {
      return { to: '/teacher', label: 'Back to teacher panel' }
    }
    return { to: '/dashboard', label: 'Back to Dashboard' }
  }
  return { to: '/', label: 'Back to Home' }
}

export default function NotFoundPage() {
  const location = useLocation()
  const user = useAuth((s) => s.user)
  const { to, label } = pickHome(location.pathname, user)

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 py-16 text-center"
      style={{
        background: 'linear-gradient(135deg, var(--brand-50), white 50%, var(--accent-50))',
      }}
    >
      <p
        className="text-[120px] font-extrabold leading-none tracking-tight md:text-[160px]"
        style={{
          background: 'var(--gradient-brand)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        404
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
        Page not found
      </h1>
      <p className="max-w-md text-slate-600">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to={to}
        className="mt-2 inline-flex items-center justify-center rounded-2xl bg-cta-500 px-7 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.30)]"
      >
        {label}
      </Link>
    </div>
  )
}
