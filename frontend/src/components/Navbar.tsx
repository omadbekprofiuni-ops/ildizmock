import { History } from 'lucide-react'
import { Link } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'
import { UserMenu } from '@/components/UserMenu'
import { useAuth } from '@/stores/auth'

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.3, overflow: 'hidden' }}
    >
      <img
        src={brandLogo}
        alt="Mock Exam"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  )
}

export function Navbar() {
  const user = useAuth((s) => s.user)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
        <Link to="/" className="flex items-center gap-3">
          <BrandMark size={36} />
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-brand-900">ILDIZ</span>
            <span className="text-teal-600">mock</span>
          </span>
        </Link>
        {user ? (
          <div className="flex items-center gap-2">
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <History className="h-4 w-4" /> My History
            </Link>
            <UserMenu />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-cta-500 px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(239,68,68,0.25)]"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
