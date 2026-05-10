import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  LivePreview,
  type PreviewData,
} from '@/components/smart-paste/LivePreview'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

export default function ExcelImportPage() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug?: string }>()
  const backPath = slug ? `/${slug}/admin/tests/new` : '/admin/tests/new'
  const [file, setFile] = useState<File | null>(null)

  const importMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file!)
      const r = await api.post<PreviewData>(
        '/admin/smart-paste/import-excel/',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return r.data
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { error?: string } } })
        ?.response?.data
      toast.error(data?.error ?? 'Excel parse qilinmadi')
    },
  })

  const preview = importMutation.data ?? null

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(backPath)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          Excel'dan import qilish
        </h1>
      </div>
      <p className="mb-2 text-sm text-slate-600">
        Ustun tartibi to'g'ri bo'lishi uchun rasmiy shablondan foydalaning.
      </p>
      <a
        href="/api/v1/admin/smart-paste/excel-template.xlsx"
        className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
      >
        <Download className="h-4 w-4" /> Shablonni yuklab olish
      </a>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          onClick={() => importMutation.mutate()}
          disabled={!file || importMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-slate-300"
        >
          {importMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {importMutation.isPending ? 'Tahlil qilinmoqda…' : 'Tahlil qilish'}
        </button>
      </div>

      <LivePreview preview={preview} loading={importMutation.isPending} />
    </div>
  )
}
