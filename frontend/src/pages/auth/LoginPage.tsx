import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

const schema = z.object({
  username: z.string().min(2, 'Username is required'),
  password: z.string().min(4, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuth((s) => s.user)
  const login = useAuth((s) => s.login)
  const loading = useAuth((s) => s.loading)

  // Idle bo'lib avto-logout bo'lganda xabar ko'rsatamiz (history state'dan).
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
      }
      else if (role === 'teacher') navigate('/teacher')
      else navigate('/home')
    } catch (err) {
      const e = err as {
        response?: { status?: number; data?: Record<string, unknown> }
        code?: string
        message?: string
      }
      const data = e?.response?.data
      const status = e?.response?.status

      // Network error — distinct message
      if (!e?.response && (e?.code === 'ERR_NETWORK' || /Network/i.test(e?.message || ''))) {
        toast.error("Could not reach the server. Check your internet connection.")
        return
      }

      // 5xx — server error
      if (status && status >= 500) {
        toast.error('Unexpected server error. Please contact your center administrator.')
        return
      }

      // 4xx — surface the backend's specific reason
      const msg =
        (data && typeof data === 'object' && (data.detail as string | undefined)) ||
        (data && Object.values(data).flat().join(' ')) ||
        "Incorrect username or password"
      toast.error(String(msg))
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-[#0A0A0A] p-12 text-white md:flex">
        <div className="text-2xl font-bold tracking-tight">
          ILDIZ<span className="font-normal text-white/80">mock</span>
        </div>
        <div className="space-y-8">
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Real IELTS<br />exam<br />environment
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-white/60">
            Computer-delivered test interface. Automatic scoring.
            Practice with real IELTS rules and timing.
          </p>
        </div>
        <div className="text-xs text-white/40">
          © 2026 ILDIZmock · Made in Tashkent, Uzbekistan
        </div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Sign In</h2>
            <p className="text-sm text-muted-foreground">Sign in with your username</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="e.g. jasmina"
                autoComplete="username"
                {...form.register('username')}
              />
              {form.formState.errors.username && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Forgot password? Contact your education center.
          </p>
        </div>
      </main>
    </div>
  )
}
