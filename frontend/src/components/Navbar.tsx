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
        <Link to="/" className="text-xl font-bold tracking-tight">
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
              <Button variant="ghost" size="sm">Kirish</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Sign Up</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
