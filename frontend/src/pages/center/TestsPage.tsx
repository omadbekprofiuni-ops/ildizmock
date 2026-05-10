import { Archive, CheckCircle, Copy, Edit2, Eye, FileText, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  TableCard,
  adminTable,
  btnPrimary,
} from '@/components/admin-shell'
import { useConfirm } from '@/components/ConfirmDialog'
import { api } from '@/lib/api'

interface TestRow {
  id: string
  name: string
  module: string
  difficulty: string
  test_type: string
  status: string
  description: string
  category: string
  duration_minutes: number
  is_global: boolean
  organization: number | null
  cloned_from: string | null
  questions_count: number
  is_cloned: boolean
  created_at: string
  published_at: string | null
  already_cloned?: boolean
  is_pdf?: boolean
  pdf_id?: string
}

interface PDFTestRow {
  id: string
  name: string
  module: string
  difficulty: string
  total_questions: number
  duration_minutes: number
  created_at: string
}

const MODULE_LABEL: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  full_mock: 'Full Mock',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
}

export default function TestsPage() {
  const { slug } = useParams<{ slug: string }>()
  const confirm = useConfirm()
  const [tab, setTab] = useState<'mine' | 'catalog' | 'archived'>('mine')
  const [mine, setMine] = useState<TestRow[]>([])
  const [archived, setArchived] = useState<TestRow[]>([])
  const [catalog, setCatalog] = useState<TestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{ module: string; difficulty: string }>({
    module: '',
    difficulty: '',
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const loadMine = () => {
    if (!slug) return
    setLoading(true)
    Promise.all([
      api.get<TestRow[]>(`/center/${slug}/tests/`),
      api
        .get<{ tests: PDFTestRow[] }>(`/pdf-tests/`)
        .then((r) => r.data.tests ?? [])
        .catch(() => [] as PDFTestRow[]),
    ])
      .then(([reg, pdfs]) => {
        const pdfRows: TestRow[] = pdfs.map((p) => ({
          id: `pdf:${p.id}`,
          pdf_id: p.id,
          name: p.name,
          module: p.module,
          difficulty: p.difficulty,
          test_type: 'academic',
          status: 'published',
          description: '',
          category: '',
          duration_minutes: p.duration_minutes,
          is_global: false,
          organization: null,
          cloned_from: null,
          questions_count: p.total_questions,
          is_cloned: false,
          created_at: p.created_at,
          published_at: p.created_at,
          is_pdf: true,
        }))
        const merged = [...reg.data, ...pdfRows].sort((a, b) =>
          (b.created_at ?? '').localeCompare(a.created_at ?? ''),
        )
        setMine(merged)
      })
      .finally(() => setLoading(false))
  }

  const loadArchived = () => {
    if (!slug) return
    setLoading(true)
    api
      .get<TestRow[]>(`/center/${slug}/tests/?archived=1`)
      .then((r) => setArchived(r.data))
      .finally(() => setLoading(false))
  }

  const archiveTest = async (id: string, name: string) => {
    if (!slug) return
    if (!window.confirm(`"${name}" testini arxivga o'tkazasizmi? Keyinchalik qayta tiklash mumkin.`)) return
    setBusy(id)
    try {
      await api.delete(`/center/${slug}/tests/${id}/`)
      setMessage('Test arxivga o\'tkazildi.')
      loadMine()
    } finally {
      setBusy(null)
    }
  }

  const restoreTest = async (id: string) => {
    if (!slug) return
    setBusy(id)
    try {
      await api.post(`/center/${slug}/tests/${id}/restore/`)
      setMessage('Test restored from archive.')
      loadArchived()
    } finally {
      setBusy(null)
    }
  }

  const extractError = (e: unknown): string => {
    const err = e as {
      response?: { data?: { detail?: string } | string; status?: number }
      message?: string
    }
    const data = err.response?.data
    if (typeof data === 'string') return data.slice(0, 200)
    if (data?.detail) return data.detail
    if (err.response?.status === 404) return "Test not found (404)."
    if (err.response?.status === 403) return "Sizda bu amalga ruxsat yo'q."
    if (err.response?.status === 500) return 'Server error (500). Please contact the admin.'
    return err.message ?? 'Xatolik yuz berdi.'
  }

  const publishTest = async (id: string, name: string) => {
    if (!slug) return
    if (!window.confirm(`Publish "${name}"? Students will be able to see it.`)) return
    setBusy(id)
    try {
      await api.post(`/center/${slug}/tests/${id}/publish/`)
      setMessage('Test nashr qilindi.')
      loadMine()
    } catch (e: unknown) {
      setMessage(extractError(e))
    } finally {
      setBusy(null)
    }
  }

  const unpublishTest = async (id: string, name: string) => {
    if (!slug) return
    if (!window.confirm(`Move "${name}" back to draft? It will be hidden from students.`)) return
    setBusy(id)
    try {
      await api.post(`/center/${slug}/tests/${id}/unpublish/`)
      setMessage('Test moved back to draft.')
      loadMine()
    } catch (e: unknown) {
      setMessage(extractError(e))
    } finally {
      setBusy(null)
    }
  }

  const hardDeleteTest = async (id: string, name: string) => {
    if (!slug) return
    if (!window.confirm(`"${name}" will be permanently deleted! This cannot be undone. Continue?`)) return
    if (!window.confirm("Once more: all questions and attempts will also be deleted. Are you sure?")) return
    setBusy(id)
    try {
      await api.delete(`/center/${slug}/tests/${id}/hard-delete/`)
      setMessage('Test doimiy o\'chirildi.')
      loadArchived()
    } finally {
      setBusy(null)
    }
  }

  const loadCatalog = () => {
    if (!slug) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filter.module) params.set('module', filter.module)
    if (filter.difficulty) params.set('difficulty', filter.difficulty)
    api
      .get<TestRow[]>(
        `/center/${slug}/tests/global-catalog/?${params.toString()}`,
      )
      .then((r) => setCatalog(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (tab === 'mine') loadMine()
    else if (tab === 'archived') loadArchived()
    else loadCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, slug, filter])

  const deletePdfTest = async (pdfId: string, name: string) => {
    const ok = await confirm({
      title: 'Delete PDF test?',
      description: `"${name}" — barcha urinishlar ham CASCADE bilan o'chiriladi. Bu amalni qaytarib bo'lmaydi.`,
      confirmText: "O'chirish",
      tone: 'danger',
    })
    if (!ok) return
    setBusy(`pdf:${pdfId}`)
    try {
      await api.delete(`/pdf-tests/${pdfId}/delete/`)
      setMessage('PDF test deleted.')
      loadMine()
    } catch (e: unknown) {
      setMessage(extractError(e))
    } finally {
      setBusy(null)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const cloneTest = async (testId: string) => {
    if (!slug) return
    setBusy(testId)
    setMessage('')
    try {
      await api.post(`/center/${slug}/tests/clone-from-global/${testId}/`)
      setMessage('✅ Test muvaffaqiyatli nusxalandi')
      loadCatalog()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setMessage(`❌ ${err.response?.data?.detail ?? 'Xatolik yuz berdi'}`)
    } finally {
      setBusy(null)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const cloneOwnTest = async (testId: string) => {
    if (!slug) return
    if (!confirm('Clone this test?')) return
    setBusy(testId)
    setMessage('')
    try {
      await api.post(`/center/${slug}/tests/${testId}/clone/`)
      setMessage('✅ Clone created')
      loadMine()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setMessage(`❌ ${err.response?.data?.detail ?? 'Xatolik yuz berdi'}`)
    } finally {
      setBusy(null)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const rows =
    tab === 'mine' ? mine : tab === 'archived' ? archived : catalog

  return (
    <PageShell>
      <PageHeader
        title="Testlar"
        subtitle="Tests in the center's database and the global catalog prepared by SuperAdmin"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/${slug}/admin/tests/pdf-create`}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              <FileText size={16} /> PDF Test (Quick)
            </Link>
            <Link to={`/${slug}/admin/tests/new`} className={btnPrimary}>
              <Plus size={16} /> New test
            </Link>
          </div>
        }
      />

      {/* Pill tabs */}
      <div className="mb-6 inline-flex rounded-xl bg-slate-100 p-1">
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          Mening testlarim ({mine.length})
        </TabButton>
        <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')}>
          Global katalog
        </TabButton>
        <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>
          Arxiv
        </TabButton>
      </div>

      {tab === 'catalog' && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Select
            value={filter.module}
            onChange={(v) => setFilter({ ...filter, module: v })}
            options={[
              { value: '', label: 'All modules' },
              { value: 'listening', label: 'Listening' },
              { value: 'reading', label: 'Reading' },
              { value: 'writing', label: 'Writing' },
              { value: 'full_mock', label: 'Full Mock' },
            ]}
          />
          <Select
            value={filter.difficulty}
            onChange={(v) => setFilter({ ...filter, difficulty: v })}
            options={[
              { value: '', label: 'All difficulties' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
          {message}
        </div>
      )}

      <TableCard
        title={
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileText size={18} className="text-brand-600" />
            {tab === 'mine' ? 'Mening testlarim' : 'Global katalog'}
          </div>
        }
      >
        <table className={adminTable.table}>
          <thead className={adminTable.thead}>
            <tr>
              <th className={adminTable.th}>Test</th>
              <th className={adminTable.th}>Modul</th>
              <th className={adminTable.th}>Difficulty</th>
              <th className={adminTable.th}>Savollar</th>
              <th className={adminTable.th}>Status</th>
              <th className={adminTable.th + ' text-right'}>Amal</th>
            </tr>
          </thead>
          <tbody className={adminTable.tbody}>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                  {tab === 'mine'
                    ? "You don't have any tests yet. Clone one from the global catalog."
                    : "No tests in the catalog yet."}
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className={adminTable.trHover}>
                  <td className={adminTable.td}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{t.name}</span>
                      {t.is_pdf && (
                        <Chip tone="violet">PDF</Chip>
                      )}
                    </div>
                    {t.category && (
                      <div className="text-xs text-slate-500">{t.category}</div>
                    )}
                    {tab === 'mine' && t.is_cloned && (
                      <Chip tone="blue" className="mt-1">Klon</Chip>
                    )}
                  </td>
                  <td className={adminTable.td}>
                    <Chip tone="indigo">{MODULE_LABEL[t.module] ?? t.module}</Chip>
                  </td>
                  <td className={adminTable.td + ' text-slate-700'}>
                    {DIFFICULTY_LABEL[t.difficulty] ?? t.difficulty}
                  </td>
                  <td className={adminTable.td + ' text-slate-700'}>{t.questions_count}</td>
                  <td className={adminTable.td}>
                    {t.status === 'published' ? (
                      <Chip tone="emerald">published</Chip>
                    ) : t.status === 'archived' ? (
                      <Chip>archived</Chip>
                    ) : (
                      <Chip tone="amber">draft</Chip>
                    )}
                  </td>
                  <td className={adminTable.td + ' text-right'}>
                    {tab === 'catalog' ? (
                      t.already_cloned ? (
                        <span className="text-xs text-slate-400">
                          Already cloned
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => cloneTest(t.id)}
                          className={btnPrimary + ' !py-1.5 !px-3 text-xs'}
                        >
                          <Copy size={14} />
                          {busy === t.id ? 'Cloning…' : 'Clone'}
                        </button>
                      )
                    ) : tab === 'archived' ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => restoreTest(t.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <RotateCcw size={14} /> Qaytarish
                        </button>
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => hardDeleteTest(t.id, t.name)}
                          className="inline-flex items-center gap-1 rounded-xl border border-cta-100 px-3 py-1.5 text-xs font-medium text-cta-600 hover:bg-cta-50 disabled:opacity-50"
                          title="Permanently delete"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    ) : t.is_pdf ? (
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to={`/pdf-test/${t.pdf_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-2 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                          title="Open"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link
                          to={`/${slug}/admin/tests/pdf-create?edit=${t.pdf_id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </Link>
                        <button
                          type="button"
                          disabled={busy === `pdf:${t.pdf_id}`}
                          onClick={() => t.pdf_id && deletePdfTest(t.pdf_id, t.name)}
                          className="inline-flex items-center gap-1 rounded-xl border border-cta-100 px-2 py-1.5 text-xs font-medium text-cta-600 hover:bg-cta-50 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex flex-wrap items-center gap-1">
                        <Link
                          to={`/${slug}/admin/tests/${t.id}/preview`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link
                          to={`/${slug}/admin/tests/${t.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </Link>
                        {t.status === 'draft' ? (
                          <button
                            type="button"
                            disabled={busy === t.id}
                            onClick={() => publishTest(t.id, t.name)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            title="Publish"
                          >
                            <CheckCircle size={14} /> Nashr
                          </button>
                        ) : t.status === 'published' ? (
                          <button
                            type="button"
                            disabled={busy === t.id}
                            onClick={() => unpublishTest(t.id, t.name)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            title="Draftga qaytarish"
                          >
                            <XCircle size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => cloneOwnTest(t.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          title="Clone"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => archiveTest(t.id, t.name)}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          title="Arxivga o'tkazish"
                        >
                          <Archive size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </PageShell>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-white text-brand-700 shadow-sm'
          : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
