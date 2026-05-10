import { ArrowLeft, FileText, Headphones, Loader2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { PageHeader, PageShell, SurfaceCard, btnOutline, btnPrimary } from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Module = 'reading' | 'listening'
type Difficulty = 'easy' | 'medium' | 'hard'

type Files = {
  pdf: File | null
  audio_part1: File | null
  audio_part2: File | null
  audio_part3: File | null
  audio_part4: File | null
}

type AudioKey = 'audio_part1' | 'audio_part2' | 'audio_part3' | 'audio_part4'

export default function PDFTestCreate() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = !!editId

  const [name, setName] = useState('')
  const [module, setModule] = useState<Module>('reading')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [duration, setDuration] = useState(60)
  const [answerKey, setAnswerKey] = useState('')
  const [files, setFiles] = useState<Files>({
    pdf: null,
    audio_part1: null,
    audio_part2: null,
    audio_part3: null,
    audio_part4: null,
  })
  const [creating, setCreating] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(isEdit)

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    api
      .get(`/pdf-tests/${editId}/`)
      .then((res) => {
        if (cancelled) return
        const t = res.data.test
        setName(t.name)
        setModule(t.module)
        setDifficulty(t.difficulty ?? 'medium')
        setDuration(t.duration_minutes ?? 60)
      })
      .catch(() => toast.error('Failed to load test'))
      .finally(() => {
        if (!cancelled) setLoadingExisting(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter test name')
      return
    }
    if (!isEdit && !files.pdf) {
      toast.error('Please upload PDF file')
      return
    }
    if (!isEdit && !answerKey.trim()) {
      toast.error('Please paste answer key')
      return
    }
    if (!isEdit && module === 'listening' && !files.audio_part1) {
      toast.error('Please upload at least Part 1 audio')
      return
    }

    setCreating(true)
    try {
      const fd = new FormData()
      fd.append('name', name.trim())
      if (!isEdit) fd.append('module', module)
      fd.append('difficulty', difficulty)
      fd.append('duration_minutes', String(duration))
      if (answerKey.trim()) fd.append('answer_key', answerKey)
      if (files.pdf) fd.append('pdf_file', files.pdf)
      if (module === 'listening') {
        ;(['audio_part1', 'audio_part2', 'audio_part3', 'audio_part4'] as AudioKey[]).forEach((k) => {
          const f = files[k]
          if (f) fd.append(k, f)
        })
      }

      const url = isEdit ? `/pdf-tests/${editId}/update/` : '/pdf-tests/create/'
      const method = isEdit ? 'patch' : 'post'
      const res = await api.request({
        url,
        method,
        data: fd,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(res.data.message ?? (isEdit ? 'Test updated' : 'Test created'))
      navigate(`/${slug}/admin/tests`)
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error ?? (isEdit ? 'Failed to update test' : 'Failed to create test'))
    } finally {
      setCreating(false)
    }
  }

  const setAudio = (key: AudioKey, f: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: f }))
  }

  return (
    <PageShell>
      <PageHeader
        title={isEdit ? '✏️ Edit PDF Test' : '⚡ Quick Test — PDF + Answer Key'}
        subtitle={
          isEdit
            ? 'Change metadata or replace files. Leave file inputs empty to keep existing files.'
            : 'Upload PDF, audio files (for Listening) and paste an answer key. Test ready in 2 minutes.'
        }
        actions={
          <Link to={`/${slug}/admin/tests`} className={btnOutline}>
            <ArrowLeft size={16} /> Back
          </Link>
        }
      />
      {loadingExisting && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <Loader2 size={14} className="mr-2 inline-block animate-spin" />
          Loading existing test…
        </div>
      )}

      <SurfaceCard className="mb-6 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Test Information</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Test Name <span className="text-cta-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cambridge IELTS 19 — Reading Test 1"
              className="w-full rounded-xl border border-slate-200 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Module</label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value as Module)}
                disabled={isEdit}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 focus:border-brand-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="reading">Reading</option>
                <option value="listening">Listening</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 focus:border-brand-500 focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Duration (min)</label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value || '0', 10) || 60)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="mb-6 p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <FileText size={18} className="text-brand-600" />
          PDF File <span className="text-cta-600">*</span>
        </h2>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFiles((prev) => ({ ...prev, pdf: e.target.files?.[0] ?? null }))}
          className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {files.pdf && (
          <p className="mt-2 text-sm text-slate-600">
            ✓ {files.pdf.name} ({(files.pdf.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </SurfaceCard>

      {module === 'listening' && (
        <SurfaceCard className="mb-6 p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Headphones size={18} className="text-brand-600" />
            Audio Files <span className="text-cta-600">*</span>
          </h2>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((p) => {
              const key = `audio_part${p}` as AudioKey
              const file = files[key]
              return (
                <div key={p}>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Part {p} {p === 1 && <span className="text-cta-600">*</span>}
                  </label>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a"
                    onChange={(e) => setAudio(key, e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                  />
                  {file && (
                    <p className="mt-1 text-xs text-slate-600">
                      ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </SurfaceCard>
      )}

      <SurfaceCard className="mb-6 p-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Answer Key {!isEdit && <span className="text-cta-600">*</span>}
          {isEdit && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              (leave blank to keep existing)
            </span>
          )}
        </h2>
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 font-mono text-xs text-blue-800">
          <div className="mb-1 font-semibold">Format: QuestionNumber|Answer (one per line)</div>
          <div>1|C</div>
          <div>2|B</div>
          <div>3|NOT GIVEN</div>
          <div>4|TRUE</div>
          <div>5|library</div>
        </div>
        <textarea
          value={answerKey}
          onChange={(e) => setAnswerKey(e.target.value)}
          placeholder={'1|C\n2|B\n3|NOT GIVEN\n...'}
          rows={14}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </SurfaceCard>

      <div className="flex items-center justify-between">
        <Link to={`/${slug}/admin/tests`} className={btnOutline}>
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={creating}
          className={btnPrimary + ' disabled:opacity-60'}
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {creating
            ? isEdit
              ? 'Updating…'
              : 'Creating…'
            : isEdit
              ? 'Update Test'
              : 'Create Test'}
        </button>
      </div>
    </PageShell>
  )
}
