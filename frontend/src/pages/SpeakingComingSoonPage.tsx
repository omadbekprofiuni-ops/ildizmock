import { ArrowLeft, Mail, Mic } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { toast } from '@/components/ui/toaster'

export default function SpeakingComingSoonPage() {
  const [email, setEmail] = useState('')

  const onSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Added to reminders (planned)')
    setEmail('')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-8">
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" /> Other modules
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-xl px-8 py-20 text-center">
        <div className="hero-bg" />
        <div className="relative">
          <div
            className="icon-tile icon-tile--cta mx-auto"
            style={{ width: 64, height: 64, borderRadius: 20 }}
          >
            <Mic className="h-8 w-8" />
          </div>
          <div className="mt-5">
            <span className="eyebrow">
              <span className="eyebrow__dot" />
              Coming Soon
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            Speaking module <span className="gradient-text">coming soon</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            AI conversation and Cambridge-format analysis — launches in{' '}
            <strong className="text-slate-900">May 2026</strong>.
          </p>

          <form onSubmit={onSubscribe} className="mx-auto mt-8 flex max-w-md gap-2">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 transition-all placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700"
            >
              <Mail className="h-4 w-4" /> Notify
            </button>
          </form>

          <Link
            to="/home"
            className="mt-6 inline-block text-sm font-semibold text-slate-500 transition-colors hover:text-brand-600 hover:underline"
          >
            ← Other modules
          </Link>
        </div>
      </main>
    </div>
  )
}
