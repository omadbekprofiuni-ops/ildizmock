import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function WritingSentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold">Your essay has been submitted ✓</h1>
        <p className="text-[var(--muted)]">
          Your teacher will review it (within 1–2 days).
          <br />
          You will see the result in the <strong>"My Writings"</strong> section.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link to="/home">
            <Button variant="outline">Home</Button>
          </Link>
          <Link to="/my-writings">
            <Button className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
              My writings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
