import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, FileText, Layers } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { B2CLayout } from '@/components/B2CLayout'
import { api } from '@/lib/api'

interface CatalogTestDetail {
  id: string
  name: string
  module: string
  module_label: string
  difficulty: string
  difficulty_label: string
  duration_minutes: number
  description: string
  b2c_description: string
  b2c_published_at: string | null
  category: string
  questions_count: number
  source: string
  source_display: string
}

const MODULE_BADGE: Record<string, string> = {
  listening: 'bg-blue-50 text-blue-700',
  reading: 'bg-rose-50 text-rose-700',
  writing: 'bg-emerald-50 text-emerald-700',
  full_mock: 'bg-violet-50 text-violet-700',
  speaking: 'bg-amber-50 text-amber-700',
}

const DIFFICULTY_LABEL: Record<string, { label: string; cls: string }> = {
  easy: { label: 'Oson', cls: 'text-green-600' },
  medium: { label: "O'rta", cls: 'text-amber-600' },
  hard: { label: 'Qiyin', cls: 'text-red-600' },
  beginner: { label: 'Boshlang\'ich', cls: 'text-green-600' },
  intermediate: { label: "O'rta", cls: 'text-amber-600' },
  advanced: { label: 'Yuqori', cls: 'text-red-600' },
  expert: { label: 'Mahoratli', cls: 'text-rose-700' },
}

export default function B2CCatalogDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [showStartModal, setShowStartModal] = useState(false)

  const { data, isLoading, isError } = useQuery<CatalogTestDetail>({
    queryKey: ['b2c-catalog-detail', id],
    queryFn: async () =>
      (await api.get<CatalogTestDetail>(`/b2c/catalog/${id}`)).data,
    enabled: !!id,
  })

  return (
    <B2CLayout active="catalog">
      <div className="max-w-3xl">
        <Link
          to="/b2c/catalog"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Katalogga qaytish
        </Link>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Yuklanmoqda…
          </div>
        ) : isError || !data ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Test topilmadi yoki katalogdan olib tashlangan.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Hero */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    MODULE_BADGE[data.module] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {data.module_label}
                </span>
                {data.source_display && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="font-medium text-slate-600">
                      {data.source_display}
                    </span>
                  </>
                )}
                {DIFFICULTY_LABEL[data.difficulty] && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span
                      className={`font-semibold ${
                        DIFFICULTY_LABEL[data.difficulty].cls
                      }`}
                    >
                      {DIFFICULTY_LABEL[data.difficulty].label}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {data.name}
              </h1>
              {data.category && (
                <p className="mt-1 text-sm text-slate-500">{data.category}</p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> Davomiyligi
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    {data.duration_minutes} daqiqa
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <FileText className="h-3.5 w-3.5" /> Savollar
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    {data.questions_count} ta
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Layers className="h-3.5 w-3.5" /> Bo'lim
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    {data.module_label}
                  </p>
                </div>
              </div>

              {(data.b2c_description || data.description) && (
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-bold text-slate-700">
                    Test haqida
                  </h3>
                  <p className="whitespace-pre-line text-sm text-slate-600">
                    {data.b2c_description || data.description}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowStartModal(true)}
                className="mt-6 w-full rounded-xl bg-brand-600 py-3 font-bold text-white transition-colors hover:bg-brand-700"
              >
                Testni boshlash
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                Hozir bepul ro'yxatdan o'ting va kredit tizimi ochilganda birinchilardan bo'ling
              </p>
            </div>
          </div>
        )}

        {showStartModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setShowStartModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                ⏳
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Kredit tizimi tez orada
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Testlarni boshlash uchun kreditlar kerak bo'ladi. Kredit tizimi va
                to'lov integratsiyasi yaqin orada ishga tushadi. Ro'yxatdan
                o'tganligingiz uchun rahmat — birinchilardan bo'lib xabardor
                bo'lasiz.
              </p>
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="mt-4 w-full rounded-xl bg-slate-100 py-2 font-bold text-slate-700 hover:bg-slate-200"
              >
                Tushunarli
              </button>
            </div>
          </div>
        )}
      </div>
    </B2CLayout>
  )
}
