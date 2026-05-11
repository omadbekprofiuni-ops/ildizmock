import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

const schema = z.object({
  first_name: z.string().min(1, 'Ismni kiriting'),
  last_name: z.string().min(1, 'Familiyani kiriting'),
  phone_number: z.string().optional(),
  preferred_language: z.enum(['uz', 'ru', 'en']),
  target_exam: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const LANGUAGES = [
  { value: 'uz', label: "O'zbek" },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
] as const

const EXAMS = [
  { value: '', label: '— tanlanmagan —' },
  { value: 'IELTS', label: 'IELTS' },
  { value: 'CEFR', label: 'CEFR' },
  { value: 'TOEFL', label: 'TOEFL' },
  { value: 'OTHER', label: 'Boshqa' },
]

export default function B2CProfilePage() {
  const user = useAuth((s) => s.user)
  const updateB2CProfile = useAuth((s) => s.updateB2CProfile)
  const loading = useAuth((s) => s.loading)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone_number: '',
      preferred_language: 'uz',
      target_exam: '',
    },
  })

  useEffect(() => {
    if (user) {
      form.reset({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        phone_number: user.phone_number ?? '',
        preferred_language: (user.preferred_language as 'uz' | 'ru' | 'en') ?? 'uz',
        target_exam: user.target_exam ?? '',
      })
    }
  }, [user, form])

  const onSubmit = async (values: FormValues) => {
    try {
      await updateB2CProfile(values)
      toast.success('Profil yangilandi')
    } catch (err) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      const data = e?.response?.data
      const msg =
        (data && typeof data === 'object' && (data.detail as string | undefined)) ||
        (data && Object.values(data).flat().join(' ')) ||
        'Saqlashda xatolik'
      toast.error(String(msg))
    }
  }

  const errors = form.formState.errors

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            to="/b2c/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="text-sm font-extrabold text-slate-900">Profil</span>
          <span />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <div
          className="rounded-[20px] border border-slate-100 bg-white p-8"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">
            Profilni tahrirlash
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Email: <span className="font-semibold text-slate-800">{user?.email ?? '—'}</span>
          </p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className="mb-2 block text-[13px] font-bold text-slate-700">
                  Ism
                </label>
                <input
                  id="first_name"
                  {...form.register('first_name')}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
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
                  {...form.register('last_name')}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
                {errors.last_name && (
                  <p className="mt-1.5 text-xs font-semibold text-cta-600">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="phone_number" className="mb-2 block text-[13px] font-bold text-slate-700">
                Telefon (ixtiyoriy)
              </label>
              <input
                id="phone_number"
                placeholder="+998 ..."
                {...form.register('phone_number')}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="preferred_language" className="mb-2 block text-[13px] font-bold text-slate-700">
                  Til
                </label>
                <select
                  id="preferred_language"
                  {...form.register('preferred_language')}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="target_exam" className="mb-2 block text-[13px] font-bold text-slate-700">
                  Maqsadli imtihon
                </label>
                <select
                  id="target_exam"
                  {...form.register('target_exam')}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                >
                  {EXAMS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-cta-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cta-600 hover:shadow-[0_8px_20px_rgba(20,184,152,0.30)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
