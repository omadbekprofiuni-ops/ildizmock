import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import brandLogo from '@/assets/brand-logo.png'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

const schema = z.object({
  email: z.string().email("To'g'ri email kiriting"),
  password: z.string().min(1, 'Parolni kiriting'),
})
type FormValues = z.infer<typeof schema>

export default function B2CLoginPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const loginB2C = useAuth((s) => s.loginB2C)
  const loading = useAuth((s) => s.loading)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (user?.role === 'b2c_user') return <Navigate to="/b2c/dashboard" replace />
  if (user) return <Navigate to="/home" replace />

  const onSubmit = async (values: FormValues) => {
    try {
      await loginB2C(values.email, values.password)
      toast.success('Xush kelibsiz!')
      navigate('/b2c/dashboard')
    } catch (err) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      const data = e?.response?.data
      const msg =
        (data && typeof data === 'object' && (data.detail as string | undefined)) ||
        (data && Object.values(data).flat().join(' ')) ||
        "Email yoki parol noto'g'ri"
      toast.error(String(msg))
    }
  }

  const errors = form.formState.errors

  return (
    <main
      className="flex min-h-screen items-center justify-center px-6 py-16"
      style={{
        background:
          'linear-gradient(135deg, var(--brand-50), white 50%, var(--accent-50))',
      }}
    >
      <Link
        to="/"
        className="fixed left-6 top-6 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-bold text-slate-700 backdrop-blur transition-colors hover:border-brand-300 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Bosh sahifa
      </Link>
      <div className="w-full max-w-md">
        <div
          className="rounded-[24px] border border-slate-100 bg-white p-10"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          <div className="mb-8 text-center">
            <div
              className="mx-auto flex items-center justify-center"
              style={{ width: 56, height: 56, borderRadius: 16, overflow: 'hidden' }}
            >
              <img src={brandLogo} alt="ILDIZmock" className="h-full w-full object-contain" />
            </div>
            <h1 className="mt-5 text-[28px] font-extrabold tracking-tight text-slate-900">
              Yana xush kelibsiz
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              IELTS tayyorgarligini davom ettiring
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-[13px] font-bold text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...form.register('email')}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs font-semibold text-cta-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="password" className="block text-[13px] font-bold text-slate-700">
                  Parol
                </label>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...form.register('password')}
                className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              {errors.password && (
                <p className="mt-1.5 text-xs font-semibold text-cta-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-cta-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.30)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? 'Tekshirilmoqda…' : 'Kirish'}
            </button>

            {/* ETAP 15 — bu yerda "Google bilan kirish" tugmasi qo'shiladi. */}
            <div className="mt-2 text-center text-[11px] uppercase tracking-wider text-slate-400">
              Google bilan kirish · Tez orada
            </div>
          </form>

          <p className="mt-7 text-center text-sm text-slate-600">
            Akkauntingiz yo'qmi?{' '}
            <Link to="/b2c/signup" className="font-bold text-brand-600 hover:text-brand-700">
              Ro'yxatdan o'ting
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-slate-500">
            O'quv markaz a'zosimisiz?{' '}
            <Link to="/login" className="font-semibold text-slate-700 hover:underline">
              Markaz logini
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
