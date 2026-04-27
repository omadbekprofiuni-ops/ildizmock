import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

const PHONE_RE = /^\+998\d{9}$/
const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().regex(PHONE_RE, 'Format: +998XXXXXXXXX'),
  password: z.string().min(8, 'Password kamida 8 ta belgi'),
  agreed: z.boolean().refine((v) => v, 'Roziligingizni tasdiqlang'),
})
type FormValues = z.infer<typeof schema>

type Org = { name: string; slug: string; primary_color: string; logo: string | null }

export default function OrgRegisterPage() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuth((s) => s.user)
  const fetchMe = useAuth((s) => s.fetchMe)
  const navigate = useNavigate()

  const q = useQuery({
    queryKey: ['org', slug],
    queryFn: async () => (await api.get<Org>(`/public/organizations/${slug}/`)).data,
    enabled: !!slug,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: '', last_name: '', phone: '+998', password: '', agreed: false },
  })

  useEffect(() => {
    if (q.data?.primary_color) {
      document.documentElement.style.setProperty('--accent', q.data.primary_color)
    }
    return () => {
      document.documentElement.style.setProperty('--accent', '#DC2626')
    }
  }, [q.data])

  if (user) return <Navigate to="/home" replace />
  if (q.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Loading…</p></div>
  }
  if (q.isError || !q.data) return <Navigate to="/" replace />
  const org = q.data

  const onSubmit = async (values: FormValues) => {
    try {
      await api.post('/public/register/', {
        org_slug: slug,
        phone: values.phone,
        password: values.password,
        first_name: values.first_name,
        last_name: values.last_name,
      })
      await fetchMe()
      toast.success(`${org.name} — successfully joined`)
      navigate('/home')
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg = data
        ? Object.values(data).map((v) => Array.isArray(v) ? v.join(' ') : v).join(' · ')
        : 'Sign Upda xatolik'
      toast.error(String(msg))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span
            className="mx-auto mb-3 inline-block h-10 w-10 rounded"
            style={{ background: org.primary_color }}
          />
          <p className="text-sm text-[var(--muted)]">{org.name}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Sign up for free</h1>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input {...form.register('first_name')} />
              {form.formState.errors.first_name && (
                <p className="text-sm text-destructive">{form.formState.errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input {...form.register('last_name')} />
              {form.formState.errors.last_name && (
                <p className="text-sm text-destructive">{form.formState.errors.last_name.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input type="tel" {...form.register('phone')} />
            {form.formState.errors.phone && (
              <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" {...form.register('password')} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" {...form.register('agreed')} className="mt-0.5 h-4 w-4" />
            <span>Men <strong>{org.name}</strong> talabasiman</span>
          </label>
          {form.formState.errors.agreed && (
            <p className="text-sm text-destructive">{form.formState.errors.agreed.message}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            style={{ background: org.primary_color, color: '#fff' }}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Submitting…' : 'Sign Up'}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--muted)]">
          Have an account? <Link to="/login" className="font-medium text-foreground hover:underline">Kirish</Link>
        </p>
      </div>
    </div>
  )
}
