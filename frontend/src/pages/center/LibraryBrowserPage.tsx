import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Library, Loader2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

interface LibraryTest {
  id: string
  name: string
  module: 'listening' | 'reading' | 'writing' | 'speaking' | 'full_mock'
  test_type: 'academic' | 'general'
  difficulty: string
  duration_minutes: number
  description: string
  category: string
  created_at: string
}

const MODULE_LABEL: Record<LibraryTest['module'], string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  full_mock: 'Full Mock',
}

export default function LibraryBrowserPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { slug } = useParams<{ slug?: string }>()
  const adminBase = slug ? `/${slug}/admin` : '/admin'

  const { data, isLoading, error } = useQuery({
    queryKey: ['library-tests'],
    queryFn: async () =>
      (await api.get<LibraryTest[]>('/library/tests/')).data,
  })

  const cloneMutation = useMutation({
    mutationFn: async (testId: string) => {
      const r = await api.post<{ test_id: string; edit_url: string }>(
        `/library/tests/${testId}/clone-to-org/`,
      )
      return r.data
    },
    onSuccess: (data) => {
      toast.success('Test markazingizga klon qilindi')
      queryClient.invalidateQueries({ queryKey: ['admin-tests'] })
      navigate(`${adminBase}/tests/${data.test_id}/edit`)
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(detail || 'Clone failed')
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="px-6 py-8 text-sm text-rose-600">
        Library yuklanmadi.
      </div>
    )
  }

  const tests = Array.isArray(data) ? data : (data as { results?: LibraryTest[] }).results ?? []

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Library className="h-5 w-5 text-brand-600" />
        <h1 className="text-2xl font-bold text-slate-900">Test Library</h1>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
          {tests.length} ta test
        </span>
      </div>
      <p className="mb-6 text-sm text-slate-600">
        Bu yerdagi testlarni "Clone" tugmasi orqali o'z markazingizga
        nusxalashingiz mumkin. Klon draft sifatida yaratiladi —
        publish qilishdan oldin tahrir qilishingiz mumkin.
      </p>

      {tests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          Library hozircha bo'sh. Superadmin global test yaratganda shu yerda
          paydo bo'ladi.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <div
              key={t.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                  {MODULE_LABEL[t.module] ?? t.module}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  {t.test_type}
                </span>
              </div>
              <h2 className="mb-1 line-clamp-2 text-base font-semibold text-slate-900">
                {t.name}
              </h2>
              {t.category && (
                <p className="mb-2 text-xs text-slate-500">{t.category}</p>
              )}
              {t.description && (
                <p className="mb-3 line-clamp-3 text-xs text-slate-600">
                  {t.description}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between pt-3 text-xs text-slate-500">
                <span>{t.duration_minutes} min</span>
                <Button
                  size="sm"
                  onClick={() => cloneMutation.mutate(t.id)}
                  disabled={cloneMutation.isPending}
                  className="gap-1.5"
                >
                  {cloneMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Clone
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
