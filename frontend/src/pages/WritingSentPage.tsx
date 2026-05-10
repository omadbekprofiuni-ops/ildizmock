import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function WritingSentPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-16 text-center"
      style={{
        background: 'linear-gradient(135deg, var(--brand-50), white 50%, var(--accent-50))',
      }}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-slate-100 bg-white p-10"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <div
          className="icon-tile icon-tile--accent mx-auto"
          style={{ width: 64, height: 64, borderRadius: 20 }}
        >
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
          Your essay has been submitted ✓
        </h1>
        <p className="mt-3 text-slate-600">
          Your teacher will review it (within 1–2 days).
          <br />
          You will see the result in the{' '}
          <strong className="text-slate-900">"My Writings"</strong> section.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            to="/home"
            className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Home
          </Link>
          <Link
            to="/my-writings"
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700"
          >
            My writings
          </Link>
        </div>
      </div>
    </div>
  )
}
