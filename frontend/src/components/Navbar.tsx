import { History } from 'lucide-react'
import { Link } from 'react-router-dom'

import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/stores/auth'

export function Navbar() {
  const user = useAuth((s) => s.user)

  return (
    <header className="border-b border-[var(--border)] bg-white">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <img
            src="/ildizmock-logo.png"
            alt="ILDIZmock"
            className="h-9 w-9 object-contain"
          />
          ILDIZmock
        </Link>
        {user ? (
          <div className="flex items-center gap-2">
            <Link to="/history">
              <Button variant="ghost" size="sm">
                <History className="mr-2 h-4 w-4" /> My History
              </Button>
            </Link>
            <UserMenu />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button size="sm">Kirish</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
