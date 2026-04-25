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
        <h1 className="text-2xl font-bold">Insheyingiz yuborildi ✓</h1>
        <p className="text-[var(--muted)]">
          Ustozingiz tekshirib chiqadi (1–2 kun ichida).
          <br />
          Natijani <strong>"Mening yozma ishlarim"</strong> bo‘limida ko‘rasiz.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link to="/home">
            <Button variant="outline">Bosh sahifa</Button>
          </Link>
          <Link to="/my-writings">
            <Button className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]">
              Mening ishlarim
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
