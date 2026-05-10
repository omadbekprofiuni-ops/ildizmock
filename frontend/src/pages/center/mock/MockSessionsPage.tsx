import { Archive, ArchiveRestore, ArrowRight, CalendarPlus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StateCard,
  TableCard,
  adminTable,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { useConfirm } from '@/components/ConfirmDialog'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

interface SessionRow {
  id: number
  name: string
  date: string
  status: string
  access_code: string
  participants_count: number
  created_at: string
  is_archived?: boolean
  archived_at?: string | null
}

type Tab = 'active' | 'archive'

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  finished: 'Finished',
  cancelled: 'Cancelled',
}

const STATUS_TONE: Record<string, 'slate' | 'blue' | 'amber' | 'rose' | 'emerald' | 'indigo'> = {
  waiting: 'slate',
  listening: 'indigo',
  reading: 'blue',
  writing: 'amber',
  finished: 'emerald',
  cancelled: 'rose',
}

export default function MockSessionsPage() {
  const { slug } = useParams<{ slug: string }>()
  const confirm = useConfirm()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<Tab>('active')

  const load = () => {
    if (!slug) return
    setLoading(true)
    const url =
      tab === 'archive'
        ? `/center/${slug}/mock/?archived=true`
        : `/center/${slug}/mock/`
    api
      .get<SessionRow[]>(url)
      .then((r) => setSessions(Array.isArray(r.data) ? r.data : []))
      .finally(() => setLoading(false))
    // Refresh archive badge count separately
    api
      .get<SessionRow[]>(`/center/${slug}/mock/?archived=true`)
      .then((r) =>
        setArchivedCount(Array.isArray(r.data) ? r.data.length : 0),
      )
      .catch(() => undefined)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tab])

  const handleDelete = async (s: SessionRow) => {
    if (tab === 'archive') {
      const ok = await confirm({
        title: 'Permanently delete session?',
        description: `"${s.name}" will be removed forever, along with student answers. This cannot be undone.`,
        confirmText: 'Delete forever',
        tone: 'danger',
      })
      if (!ok) return
      try {
        await api.delete(`/center/${slug}/mock/${s.id}/`)
        toast.success('Session permanently deleted')
        load()
      } catch (err: unknown) {
        toast.error(extractError(err, 'Could not delete session'))
      }
      return
    }
    const ok = await confirm({
      title: 'Move to archive?',
      description: `"${s.name}" will be moved to the Archive tab. From there you can restore it or delete it permanently.`,
      confirmText: 'Move to archive',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/center/${slug}/mock/${s.id}/`)
      toast.success(
        'Moved to archive — open the Archive tab to permanently delete it later.',
      )
      load()
    } catch (err: unknown) {
      toast.error(extractError(err, 'Could not archive session'))
    }
  }

  const handleRestore = async (s: SessionRow) => {
    try {
      await api.post(`/center/${slug}/mock/${s.id}/restore/`)
      toast.success('Session restored')
      load()
    } catch (err: unknown) {
      toast.error(extractError(err, 'Could not restore session'))
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Mock sessions"
        subtitle="Synchronous mock tests — students join via a single link and start together."
        actions={
          tab === 'active' ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className={btnPrimary}
            >
              <Plus size={16} /> New session
            </button>
          ) : null
        }
      />

      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`rounded-lg px-4 py-1.5 font-medium transition ${
            tab === 'active'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setTab('archive')}
          className={`inline-flex items-center gap-1 rounded-lg px-4 py-1.5 font-medium transition ${
            tab === 'archive'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Archive size={14} /> Archive
          {archivedCount > 0 && (
            <span
              className={`ml-1 rounded-full px-1.5 text-xs ${
                tab === 'archive'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {archivedCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'archive' && archivedCount > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          These sessions are archived. Restore them to make them active again,
          or delete them permanently to free up space.
        </div>
      )}

      {!loading && sessions.length === 0 ? (
        <StateCard
          Icon={tab === 'archive' ? Archive : CalendarPlus}
          tone="indigo"
          title={tab === 'archive' ? 'Archive is empty' : 'No sessions yet'}
          description={
            tab === 'archive'
              ? 'Sessions you archive will appear here.'
              : 'Click “New session” to schedule your first mock session.'
          }
        />
      ) : (
        <TableCard>
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th className={adminTable.th}>Session</th>
                <th className={adminTable.th}>Date</th>
                <th className={adminTable.th}>Code</th>
                <th className={adminTable.th}>Students</th>
                <th className={adminTable.th}>Status</th>
                <th className={adminTable.th + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody className={adminTable.tbody}>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className={adminTable.trHover}>
                    <td className={adminTable.td + ' font-semibold text-slate-900'}>
                      {s.name}
                    </td>
                    <td className={adminTable.td + ' text-slate-600'}>{s.date}</td>
                    <td className={adminTable.td + ' font-mono text-xs'}>
                      {s.access_code}
                    </td>
                    <td className={adminTable.td}>{s.participants_count}</td>
                    <td className={adminTable.td}>
                      <Chip tone={STATUS_TONE[s.status] ?? 'slate'}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Chip>
                    </td>
                    <td className={adminTable.td + ' text-right'}>
                      <div className="inline-flex items-center gap-2">
                        {tab === 'archive' && (
                          <button
                            type="button"
                            onClick={() => handleRestore(s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                            title="Restore session to the active list"
                          >
                            <ArchiveRestore size={12} /> Restore
                          </button>
                        )}
                        {(s.status === 'finished' ||
                          s.status === 'cancelled' ||
                          s.status === 'waiting') && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-cta-100 px-2 py-1 text-xs text-cta-600 hover:bg-cta-50"
                            title={
                              tab === 'archive'
                                ? 'Delete session forever'
                                : 'Move session to archive'
                            }
                          >
                            <Trash2 size={12} />
                            {tab === 'archive' ? 'Delete forever' : 'Archive'}
                          </button>
                        )}
                        {tab === 'active' && (
                          <Link
                            to={`/${slug}/admin/mock/${s.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                          >
                            Manage <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableCard>
      )}

      {showCreate && (
        <CreateSessionDialog
          slug={slug!}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </PageShell>
  )
}

void btnOutline

function extractError(err: unknown, fallback: string): string {
  const e = err as {
    response?: { status?: number; data?: { detail?: string } }
    message?: string
  }
  return (
    e.response?.data?.detail ||
    (e.response?.status ? `Request failed (HTTP ${e.response.status})` : e.message) ||
    fallback
  )
}

interface TestPick {
  id: string
  name: string
  module: string
  difficulty: string
  kind?: 'regular' | 'pdf'
  is_published?: boolean
  status?: 'draft' | 'published' | 'archived'
  is_library?: boolean
  is_own_center?: boolean
}

function CreateSessionDialog({
  slug,
  onClose,
  onCreated,
}: {
  slug: string
  onClose: () => void
  onCreated: () => void
}) {
  const [tests, setTests] = useState<{
    listening: TestPick[]
    reading: TestPick[]
    writing: TestPick[]
  }>({ listening: [], reading: [], writing: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    name: '',
    date: today,
    listening_test: '',
    reading_test: '',
    writing_test: '',
    listening_duration: 30,
    reading_duration: 60,
    writing_duration: 60,
  })

  useEffect(() => {
    // HOTFIX — yangi yagona endpoint org-owned + library testlarni
    // birlashtirib qaytaradi. Har modul uchun alohida so'rov.
    // include_drafts=1 — draft testlarni ham qaytaradi (disabled holda
    // ko'rsatamiz, admin "mening testim qayerda?" deb adashmasligi uchun).
    const modules = ['listening', 'reading', 'writing'] as const
    Promise.all(
      modules.map((mod) =>
        api
          .get(`/admin/available-for-mock/?type=${mod}&include_drafts=1`)
          .then((r) => {
            const arr = (r.data?.results ?? []) as Array<{
              id: string
              name: string
              module: string
              difficulty: string
              is_published?: boolean
              status?: 'draft' | 'published' | 'archived'
              is_library?: boolean
              is_own_center?: boolean
            }>
            return [mod, arr.map((t) => ({ ...t, kind: 'regular' as const }))] as const
          })
          .catch(() => [mod, [] as TestPick[]] as const),
      ),
    )
      .then((entries) => {
        const next: Record<'listening' | 'reading' | 'writing', TestPick[]> = {
          listening: [],
          reading: [],
          writing: [],
        }
        for (const [mod, arr] of entries) {
          next[mod] = arr as TestPick[]
        }
        setTests(next)
      })
      .finally(() => setLoading(false))
  }, [slug])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Kamida bitta test biriktirilishi shart — backend qaysi modul
    // tanlangan bo'lsa o'shandan boshlaydi (Writing-only ham mumkin).
    if (!form.listening_test && !form.reading_test && !form.writing_test) {
      setError('Pick at least one test (Listening, Reading or Writing).')
      return
    }
    setBusy(true)
    try {
      await api.post(`/center/${slug}/mock/`, {
        name: form.name,
        date: form.date,
        listening_test: form.listening_test || null,
        reading_test: form.reading_test || null,
        writing_test: form.writing_test || null,
        listening_duration: Number(form.listening_duration),
        reading_duration: Number(form.reading_duration),
        writing_duration: Number(form.writing_duration),
      })
      onCreated()
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: unknown }
        message?: string
      }
      const status = err.response?.status
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const first = Object.values(data as Record<string, unknown>)[0]
        setError(Array.isArray(first) ? String(first[0]) : String(first))
      } else if (status && status >= 500) {
        setError(
          `Server error (${status}). Tell the admin to run ` +
          "'python manage.py migrate' on the backend and restart gunicorn.",
        )
      } else if (status) {
        setError(`Request failed (HTTP ${status}). Please try again.`)
      } else {
        setError(err.message || "Network error. Check your internet connection.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-semibold text-slate-900">New mock session</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading tests…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Session name">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. 2026-04-27 Evening group"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </Field>

            <Field label="Date">
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </Field>

            <TestSelect
              label="Listening test"
              moduleLabel="Listening"
              value={form.listening_test}
              onChange={(v) => setForm({ ...form, listening_test: v })}
              tests={tests.listening}
            />
            <TestSelect
              label="Reading test"
              moduleLabel="Reading"
              value={form.reading_test}
              onChange={(v) => setForm({ ...form, reading_test: v })}
              tests={tests.reading}
            />
            <TestSelect
              label="Writing test"
              moduleLabel="Writing"
              value={form.writing_test}
              onChange={(v) => setForm({ ...form, writing_test: v })}
              tests={tests.writing}
            />

            <div className="grid grid-cols-3 gap-3">
              <Field label="Listening (min)">
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={form.listening_duration}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      listening_duration: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
              <Field label="Reading (min)">
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.reading_duration}
                  onChange={(e) =>
                    setForm({ ...form, reading_duration: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
              <Field label="Writing (min)">
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.writing_duration}
                  onChange={(e) =>
                    setForm({ ...form, writing_duration: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </Field>
            </div>

            {error && (
              <div className="rounded-xl border border-cta-100 bg-cta-50 p-3 text-sm text-cta-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className={btnOutline}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}

function TestSelect({
  label,
  moduleLabel,
  value,
  onChange,
  tests,
}: {
  label: string
  moduleLabel: string
  value: string
  onChange: (v: string) => void
  tests: TestPick[]
}) {
  const published = tests.filter((t) => t.is_published !== false)
  const drafts = tests.filter((t) => t.is_published === false)

  const renderName = (t: TestPick) => {
    const prefix = t.kind === 'pdf' ? '[PDF] ' : ''
    const suffix = t.is_library
      ? '  (Library)'
      : t.is_own_center
        ? '  (Your center)'
        : ''
    return `${prefix}${t.name}${suffix}`
  }

  return (
    <Field
      label={
        <>
          {label}{' '}
          <span className="font-normal text-slate-400">(optional)</span>
        </>
      }
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">— None (skip {moduleLabel}) —</option>
        {published.map((t) => (
          <option key={t.id} value={t.id}>
            {renderName(t)}
          </option>
        ))}
        {drafts.length > 0 && (
          <optgroup label="── Your drafts (publish them first) ──">
            {drafts.map((t) => (
              <option key={t.id} value={t.id} disabled>
                [DRAFT] {t.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {published.length === 0 && drafts.length === 0 && (
        <p className="mt-1 text-xs text-amber-700">
          No published {moduleLabel} tests yet. Go to the{' '}
          <strong>Tests</strong> page to create one, or wait for ILDIZ to add
          tests to the Library.
        </p>
      )}
      {published.length === 0 && drafts.length > 0 && (
        <p className="mt-1 text-xs text-amber-700">
          You have {drafts.length} draft {moduleLabel} test
          {drafts.length === 1 ? '' : 's'}. Go to the <strong>Tests</strong>{' '}
          page and click the green <strong>Nashr</strong> button to publish —
          they will appear here after that.
        </p>
      )}
    </Field>
  )
}
