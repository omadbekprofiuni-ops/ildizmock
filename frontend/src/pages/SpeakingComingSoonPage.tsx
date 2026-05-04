import { ArrowLeft, Mail, Mic } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'

export default function SpeakingComingSoonPage() {
  const [email, setEmail] = useState('')

  const onSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    // Endpoint hali yo'q — Phase 2'da ulanadi
    toast.success('Added to reminders (planned)')
    setEmail('')
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/home">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Other modules
            </Button>
          </Link>
        </div>
      </header>
      <main className="container max-w-lg py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
          <Mic className="h-8 w-8 text-purple-700" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Speaking module coming soon</h1>
        <p className="mt-3 text-[var(--muted)]">
          AI conversation and Cambridge-format analysis — launches in <strong>May 2026</strong>.
        </p>
        <form onSubmit={onSubscribe} className="mt-8 flex gap-2">
          <Input
            type="email"
            placeholder="Email manzil"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit">
            <Mail className="mr-2 h-4 w-4" /> Eslatma
          </Button>
        </form>
        <Link to="/home" className="mt-6 inline-block text-sm text-[var(--muted)] hover:underline">
          ← Other modules
        </Link>
      </main>
    </div>
  )
}
