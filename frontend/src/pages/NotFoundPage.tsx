import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-6 text-center">
      <p className="text-7xl font-bold text-[var(--muted)]">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-[var(--muted)]">The page you are looking for does not exist or has been moved.</p>
      <Link to="/">
        <Button>Homega qaytish</Button>
      </Link>
    </div>
  )
}
