import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import brandLogo from '@/assets/brand-logo.png'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

const schema = z.object({
  username: z.string().min(2, 'Username is required'),
  password: z.string().min(4, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <div
      className="mx-auto flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}
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

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuth((s) => s.user)
  const login = useAuth((s) => s.login)
  const loading = useAuth((s) => s.loading)

  const idleNotified = useRef(false)
  useEffect(() => {
    const state = location.state as { idle?: boolean } | null
    if (state?.idle && !idleNotified.current) {
      idleNotified.current = true
      toast.info('You were signed out automatically after 10 minutes of inactivity. Please sign in again.')
    }
  }, [location.state])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  if (user) return <Navigate to="/home" replace />

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.username, values.password)
      toast.success('Signed in')

      const me = useAuth.getState().user
      if (me?.must_change_password) {
        navigate('/change-password?required=true')
        return
      }
      const role = me?.role
      if (role === 'superadmin' || role === 'super_admin') navigate('/super')
      else if (role === 'org_admin' || role === 'admin') {
        navigate(me?.org_slug ? `/${me.org_slug}/admin` : '/admin')
      } else if (role === 'teacher') navigate('/teacher')
      else navigate('/home')
    } catch (err) {
      const e = err as {
        response?: { status?: number; data?: Record<string, unknown> }
        code?: string
        message?: string
      }
      const data = e?.response?.data
      const status = e?.response?.status

      if (!e?.response && (e?.code === 'ERR_NETWORK' || /Network/i.test(e?.message || ''))) {
        toast.error('Could not reach the server. Check your internet connection.')
        return
      }
      if (status && status >= 500) {
        toast.error('Unexpected server error. Please contact your center administrator.')
        return
      }
      const msg =
        (data && typeof data === 'object' && (data.detail as string | undefined)) ||
        (data && Object.values(data).flat().join(' ')) ||
        'Incorrect username or password'
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
            <BrandMark size={56} />
            <h1 className="mt-5 text-[28px] font-extrabold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Login to continue your IELTS practice
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-[13px] font-bold text-slate-700"
              >
                Username
              </label>
              <input
                id="username"
                placeholder="e.g. jasmina"
                autoComplete="username"
                {...form.register('username')}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] text-slate-900 transition-all placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              {errors.username && (
                <p className="mt-1.5 text-xs font-semibold text-cta-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[13px] font-bold text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...form.register('password')}
                className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] text-slate-900 transition-all placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              {errors.password && (
                <p className="mt-1.5 text-xs font-semibold text-cta-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-cta-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.30)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} ILDIZmock · <a className="hover:text-slate-700">Privacy</a> ·{' '}
          <a className="hover:text-slate-700">Terms</a>
        </p>
      </div>
    </main>
  )
}
