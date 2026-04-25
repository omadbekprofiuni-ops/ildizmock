import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

const PHONE_RE = /^\+998\d{9}$/
const schema = z.object({
  phone: z
    .string()
    .min(13, 'Username is required (min 2 chars)')
    .regex(PHONE_RE, 'Use lowercase letters and digits only'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const login = useAuth((s) => s.login)
  const loading = useAuth((s) => s.loading)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', password: '' },
  })

  if (user) return <Navigate to="/home" replace />

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.phone, values.password)
      toast.success('Signed in')
      // Role-based redirect
      const me = useAuth.getState().user
      const role = me?.role
      if (role === 'superadmin' || role === 'super_admin') {
        navigate('/super')
      } else if (role === 'org_admin' || role === 'admin') {
        navigate('/admin')
      } else if (role === 'teacher') {
        navigate('/teacher')
      } else {
        navigate('/home')
      }
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg =
        (data && typeof data === 'object' && (data.detail as string | undefined)) ||
        (data && Object.values(data).flat().join(' ')) ||
        'Wrong username or password'
      toast.error(String(msg))
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-[#0A0A0A] p-12 text-white md:flex">
        <div className="text-2xl font-bold">
          ILDIZ<span className="font-normal">mock</span>
        </div>
        <div className="space-y-6">
          <h1 className="text-5xl font-extrabold leading-[1.05] md:text-6xl">
            Real IELTS<br />sinov muhiti
          </h1>
          <p className="max-w-md text-xl leading-relaxed text-white/70">
            Computer-delivered test interfeysi. Avtomatik baholash.
            O‘zbek tilida yo‘riqnoma.
          </p>
        </div>
        <div className="text-sm text-white/40">
          © 2026 ILDIZmock · Tashkent, Uzbekistan
        </div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Kirish</h2>
            <p className="text-sm text-muted-foreground">
              Usernameingiz bilan hisobingizga kiring
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Username</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+998901234567"
                autoComplete="tel"
                {...form.register('phone')}
              />
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.phone.message}
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
              {loading ? 'Kirilmoqda…' : 'Kirish'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link
              to="/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Ro‘yxatdan o‘ting
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
