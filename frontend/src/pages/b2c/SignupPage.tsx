import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import brandLogo from '@/assets/brand-logo.png'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

const schema = z
  .object({
    first_name: z.string().min(1, 'Ismni kiriting'),
    last_name: z.string().min(1, 'Familiyani kiriting'),
    email: z.string().email("To'g'ri email kiriting"),
    password: z.string().min(6, "Parol kamida 6 belgi bo'lsin"),
    password_confirm: z.string().min(6, 'Parolni takrorlang'),
  })
  .refine((v) => v.password === v.password_confirm, {
    path: ['password_confirm'],
    message: 'Parollar mos kelmadi',
  })

type FormValues = z.infer<typeof schema>

export default function B2CSignupPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const signupB2C = useAuth((s) => s.signupB2C)
  const loading = useAuth((s) => s.loading)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      password_confirm: '',
    },
  })

  if (user?.role === 'b2c_user') return <Navigate to="/b2c/dashboard" replace />
  if (user) return <Navigate to="/home" replace />

  const onSubmit = async (values: FormValues) => {
    try {
      await signupB2C(values)
      toast.success("Xush kelibsiz! Ro'yxatdan o'tdingiz.")
      navigate('/b2c/dashboard')
    } catch (err) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      const data = e?.response?.data
      const msg =
        (data && typeof data === 'object' && (data.detail as string | undefined)) ||
        (data && Object.values(data).flat().join(' ')) ||
        "Ro'yxatdan o'tishda xatolik. Qaytadan urinib ko'ring."
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
            <h1 className="mt-5 text-[26px] font-extrabold tracking-tight text-slate-900">
              Akkaunt yaratish
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Individual foydalanuvchi sifatida boshlash
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className="mb-2 block text-[13px] font-bold text-slate-700">
                  Ism
                </label>
                <input
                  id="first_name"
                  autoComplete="given-name"
                  {...form.register('first_name')}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
                {errors.first_name && (
                  <p className="mt-1.5 text-xs font-semibold text-cta-600">{errors.first_name.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="last_name" className="mb-2 block text-[13px] font-bold text-slate-700">
                  Familiya
                </label>
                <input
                  id="last_name"
                  autoComplete="family-name"
                  {...form.register('last_name')}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
                {errors.last_name && (
                  <p className="mt-1.5 text-xs font-semibold text-cta-600">{errors.last_name.message}</p>
                )}
              </div>
            </div>

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
              <label htmlFor="password" className="mb-2 block text-[13px] font-bold text-slate-700">
                Parol
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...form.register('password')}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              {errors.password && (
                <p className="mt-1.5 text-xs font-semibold text-cta-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password_confirm" className="mb-2 block text-[13px] font-bold text-slate-700">
                Parolni takrorlang
              </label>
              <input
                id="password_confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...form.register('password_confirm')}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              {errors.password_confirm && (
                <p className="mt-1.5 text-xs font-semibold text-cta-600">{errors.password_confirm.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-cta-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.30)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? 'Yaratilmoqda…' : "Ro'yxatdan o'tish"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-600">
            Akkauntingiz bormi?{' '}
            <Link to="/b2c/login" className="font-bold text-brand-600 hover:text-brand-700">
              Kiring
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
