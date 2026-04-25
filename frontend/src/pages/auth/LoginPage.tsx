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
    .min(13, 'Telefon raqam +998 va 9 raqamdan iborat bo‘lsin')
    .regex(PHONE_RE, 'Format: +998XXXXXXXXX (jami 13 ta belgi)'),
  password: z.string().min(6, 'Parol kamida 6 ta belgi bo‘lsin'),
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
      toast.success('Tizimga kirdingiz')
      navigate('/')
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg =
        (data && typeof data === 'object' && (data.detail as string | undefined)) ||
        (data && Object.values(data).flat().join(' ')) ||
        'Telefon yoki parol noto‘g‘ri'
      toast.error(String(msg))
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 to-slate-700 p-10 text-white md:flex">
        <h1 className="text-3xl font-bold">IELTSation</h1>
        <div>
          <p className="text-2xl font-semibold leading-tight">
            O‘zbekistonning birinchi IELTS kompyuter-delivered mock platformasi
          </p>
          <p className="mt-3 text-slate-300">
            Haqiqiy testdagi kabi interfeys. Avtomatik band hisobi.
          </p>
        </div>
        <p className="text-sm text-slate-400">© 2026 IELTSation</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Kirish</h2>
            <p className="text-sm text-muted-foreground">
              Telefon raqamingiz bilan hisobingizga kiring
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
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
              <Label htmlFor="password">Parol</Label>
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
            Hisobingiz yo‘qmi?{' '}
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
