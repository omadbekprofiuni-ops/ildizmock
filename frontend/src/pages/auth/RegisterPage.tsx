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
  first_name: z.string().min(1, 'Ism kiritilmagan'),
  last_name: z.string().min(1, 'Familiya kiritilmagan'),
  phone: z
    .string()
    .min(13, 'Telefon raqam +998 va 9 raqamdan iborat bo‘lsin')
    .regex(PHONE_RE, 'Format: +998XXXXXXXXX (jami 13 ta belgi)'),
  password: z.string().min(6, 'Parol kamida 6 ta belgi bo‘lsin'),
})
type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const register = useAuth((s) => s.register)
  const loading = useAuth((s) => s.loading)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: '', last_name: '', phone: '', password: '' },
  })

  if (user) return <Navigate to="/home" replace />

  const onSubmit = async (values: FormValues) => {
    try {
      await register(values)
      toast.success('Ro‘yxatdan o‘tdingiz')
      navigate('/home')
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })
        ?.response?.data
      // Backend may return { phone: ['...'] } | { password: ['...'] } | { detail: '...' }
      let msg = 'Ro‘yxatdan o‘tishda xatolik'
      if (data && typeof data === 'object') {
        if (typeof (data.detail as unknown) === 'string') {
          msg = data.detail as string
        } else {
          const flat: string[] = []
          for (const [field, val] of Object.entries(data)) {
            const arr = Array.isArray(val) ? val : [val]
            for (const item of arr) flat.push(`${field}: ${item}`)
          }
          if (flat.length) msg = flat.join(' · ')
        }
      }
      toast.error(msg)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 to-slate-700 p-10 text-white md:flex">
        <h1 className="text-3xl font-bold">IELTSation</h1>
        <div>
          <p className="text-2xl font-semibold leading-tight">
            Hisob yarating — dastlabki mock testlar bepul
          </p>
          <p className="mt-3 text-slate-300">
            Reading va Listening modullarini hoziroq sinab ko‘ring.
          </p>
        </div>
        <p className="text-sm text-slate-400">© 2026 IELTSation</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Ro‘yxatdan o‘tish</h2>
            <p className="text-sm text-muted-foreground">Bepul hisob yarating</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first_name">Ism</Label>
                <Input id="first_name" {...form.register('first_name')} />
                {form.formState.errors.first_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.first_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Familiya</Label>
                <Input id="last_name" {...form.register('last_name')} />
                {form.formState.errors.last_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.last_name.message}
                  </p>
                )}
              </div>
            </div>

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
                autoComplete="new-password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ro‘yxatdan o‘tilmoqda…' : 'Ro‘yxatdan o‘tish'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Hisobingiz bormi?{' '}
            <Link
              to="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Kiring
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
