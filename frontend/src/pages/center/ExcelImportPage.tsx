import { ArrowLeft, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  PageHeader,
  PageShell,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

export default function ExcelImportPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [file, setFile] = useState<File | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    module: 'reading' as 'reading' | 'listening' | 'writing',
    difficulty: 'intermediate' as 'beginner' | 'intermediate' | 'advanced' | 'expert',
    duration_minutes: 60,
  })

  useEffect(() => {
    document.title = 'ILDIZmock — Excel Import'
  }, [])

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const res = await api.get(
        `/center/${slug}/tests/excel-template/`,
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'ielts_test_template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Template downloaded')
    } catch {
      toast.error('Failed to download template')
    } finally {
      setDownloading(false)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select an .xlsx file first')
      return
    }
    if (!form.name.trim()) {
      toast.error('Please enter a test name')
      return
    }
    setUploading(true)
    const data = new FormData()
    data.append('file', file)
    data.append('name', form.name)
    data.append('module', form.module)
    data.append('difficulty', form.difficulty)
    data.append('duration_minutes', String(form.duration_minutes))

    try {
      const res = await api.post<{
        test_id: string
        passages: number
        questions: number
      }>(`/center/${slug}/tests/excel-import/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(
        `Imported ${res.data.passages} passage(s) and ${res.data.questions} question(s)`,
      )
      navigate(`/${slug}/admin/tests`)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(detail ?? 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <PageShell maxWidth="max-w-4xl">
      <Link
        to={`/${slug}/admin/tests`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Tests
      </Link>

      <PageHeader
        title="Import test from Excel"
        subtitle="Download the template, fill in passages and questions, then upload."
      />

      {/* Step 1: download template */}
      <SurfaceCard className="mb-4">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          1. Download the template
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          One row per question. Group rows by <code className="rounded bg-slate-100 px-1">Passage Title</code> —
          repeat the title for every question in the same passage. The template
          includes sample data and an Instructions sheet.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          disabled={downloading}
          className={btnOutline + ' disabled:opacity-50'}
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {downloading ? 'Downloading…' : 'Download template (.xlsx)'}
        </button>
      </SurfaceCard>

      {/* Step 2: metadata */}
      <SurfaceCard className="mb-4">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          2. Test details
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Test name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Cambridge IELTS 19 — Reading Test 1"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Module
            </label>
            <select
              value={form.module}
              onChange={(e) =>
                setForm({ ...form, module: e.target.value as typeof form.module })
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
              <option value="writing">Writing</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Difficulty
            </label>
            <select
              value={form.difficulty}
              onChange={(e) =>
                setForm({
                  ...form,
                  difficulty: e.target.value as typeof form.difficulty,
                })
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={180}
              value={form.duration_minutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  duration_minutes: Number(e.target.value) || 60,
                })
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </SurfaceCard>

      {/* Step 3: upload */}
      <SurfaceCard className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          3. Upload the filled file
        </h2>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/40 p-8 hover:border-brand-300 hover:bg-brand-50/40">
          <FileSpreadsheet size={32} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {file ? file.name : 'Click to select an .xlsx file'}
          </span>
          {file && (
            <span className="text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(`/${slug}/admin/tests`)}
            className={btnOutline}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file || !form.name.trim()}
            className={btnPrimary + ' disabled:opacity-50'}
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload size={14} />
                Import test
              </>
            )}
          </button>
        </div>
      </SurfaceCard>
    </PageShell>
  )
}
