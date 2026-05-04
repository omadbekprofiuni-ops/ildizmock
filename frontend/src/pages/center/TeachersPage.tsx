import { GraduationCap, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StateCard,
  TableCard,
  adminTable,
  btnGhost,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { CredentialsModal } from '@/components/center/CredentialsModal'
import { api } from '@/lib/api'

interface Teacher {
  id: number
  username: string
  first_name: string
  last_name: string
  phone?: string | null
  is_active: boolean
  students_count: number
  created_at: string
}

interface Credentials {
  username: string
  password?: string
  new_password?: string
  login_url: string
}

export default function TeachersPage() {
  const { slug } = useParams<{ slug: string }>()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [filter, setFilter] = useState('')

  const load = () => {
    if (!slug) return
    setLoading(true)
    api
      .get<Teacher[]>(`/center/${slug}/teachers/`)
      .then((r) => setTeachers(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [slug])

  const filtered = useMemo(() => {
    if (!filter.trim()) return teachers
    const q = filter.trim().toLowerCase()
    return teachers.filter((t) =>
      `${t.first_name} ${t.last_name} ${t.username}`.toLowerCase().includes(q),
    )
  }, [teachers, filter])

  const resetPassword = async (id: number) => {
    if (!slug || !window.confirm('Parolni tiklamoqchimisiz?')) return
    const r = await api.post(`/center/${slug}/teachers/${id}/reset-password/`)
    setCredentials({ ...r.data, login_url: `/${slug}/login` })
  }

  const deactivate = async (id: number) => {
    if (!slug || !window.confirm("Delete this teacher?")) return
    await api.post(`/center/${slug}/teachers/${id}/deactivate/`)
    load()
  }

  return (
    <PageShell>
      <PageHeader
        title="Teachers"
        subtitle="Teachers working at the center and their activity"
        actions={
          <button type="button" onClick={() => setShowAdd(true)} className={btnPrimary}>
            <Plus size={16} /> New teacher
          </button>
        }
      />

      {!loading && teachers.length === 0 ? (
        <StateCard
          Icon={GraduationCap}
          tone="emerald"
          title="No teachers added yet"
          description="Add the first teacher for the center — you'll then be able to assign students."
        />
      ) : (
        <TableCard
          toolbar={
            <div className="relative w-full sm:w-64">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                placeholder="Search by name or login..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          }
        >
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th className={adminTable.th}>Teacher</th>
                <th className={adminTable.th}>Login</th>
                <th className={adminTable.th}>Talabalari</th>
                <th className={adminTable.th}>Status</th>
                <th className={adminTable.th + ' text-right'}>Amal</th>
              </tr>
            </thead>
            <tbody className={adminTable.tbody}>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                    Nothing matched the search.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const initials =
                    `${t.first_name?.[0] ?? ''}${t.last_name?.[0] ?? ''}`.toUpperCase() || '?'
                  return (
                    <tr key={t.id} className={adminTable.trHover}>
                      <td className={adminTable.td}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                            {initials}
                          </div>
                          <div className="font-semibold text-slate-900">
                            {t.first_name} {t.last_name}
                          </div>
                        </div>
                      </td>
                      <td className={adminTable.td + ' font-mono text-xs text-slate-600'}>
                        {t.username}
                      </td>
                      <td className={adminTable.td}>{t.students_count} ta</td>
                      <td className={adminTable.td}>
                        {t.is_active ? <Chip tone="emerald">Active</Chip> : <Chip>Deleted</Chip>}
                      </td>
                      <td className={adminTable.td + ' text-right'}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(t)}
                            className={btnGhost}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => resetPassword(t.id)}
                            className={btnGhost}
                          >
                            Parolni tiklash
                          </button>
                          {t.is_active && (
                            <button
                              type="button"
                              onClick={() => deactivate(t.id)}
                              className="rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </TableCard>
      )}

      {showAdd && (
        <AddTeacherModal
          slug={slug!}
          onClose={() => setShowAdd(false)}
          onCreated={(creds) => {
            setShowAdd(false)
            setCredentials(creds)
            load()
          }}
        />
      )}

      {credentials && (
        <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      )}

      {editing && slug && (
        <EditTeacherModal
          slug={slug}
          teacher={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </PageShell>
  )
}

function EditTeacherModal({
  slug,
  teacher,
  onClose,
  onSaved,
}: {
  slug: string
  teacher: Teacher
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    first_name: teacher.first_name ?? '',
    last_name: teacher.last_name ?? '',
    phone: teacher.phone ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      await api.patch(`/center/${slug}/teachers/${teacher.id}/`, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
      })
      onSaved()
    } catch (e: unknown) {
      const err = e as { response?: { data?: Record<string, unknown> } }
      const data = err.response?.data
      setError(
        (data?.detail as string | undefined) ||
          JSON.stringify(data || {}).slice(0, 200) ||
          'Xatolik',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          O‘qituvchini tahrirlash
        </h2>
        <div className="space-y-3">
          <FormInput
            label="Ism"
            value={form.first_name}
            onChange={(v) => setForm({ ...form, first_name: v })}
          />
          <FormInput
            label="Familiya"
            value={form.last_name}
            onChange={(v) => setForm({ ...form, last_name: v })}
          />
          <FormInput
            label="Telefon"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
        </div>
        {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={btnOutline + ' flex-1 justify-center'}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className={btnPrimary + ' flex-1 justify-center'}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddTeacherModal({
  slug,
  onClose,
  onCreated,
}: {
  slug: string
  onClose: () => void
  onCreated: (c: Credentials) => void
}) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const r = await api.post(`/center/${slug}/teachers/`, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim().toLowerCase(),
      })
      onCreated(r.data.credentials)
    } catch (e: unknown) {
      const err = e as { response?: { data?: Record<string, unknown> } }
      const data = err.response?.data
      const firstError =
        (data?.username as string[] | undefined)?.[0] ??
        (data?.detail as string | undefined) ??
        'Xatolik yuz berdi'
      setError(firstError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">New teacher</h2>
        <div className="space-y-3">
          <FormInput
            label="Ism"
            value={form.first_name}
            onChange={(v) => setForm({ ...form, first_name: v })}
          />
          <FormInput
            label="Familiya"
            value={form.last_name}
            onChange={(v) => setForm({ ...form, last_name: v })}
          />
          <FormInput
            label="Login (username)"
            value={form.username}
            onChange={(v) => setForm({ ...form, username: v })}
            hint="Faqat lotin harflari va raqamlar"
          />
        </div>
        {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          💡 Parol avtomatik yaratiladi va keyingi ekranda shown.
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={btnOutline + ' flex-1 justify-center'}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={btnPrimary + ' flex-1 justify-center'}
          >
            {submitting ? 'Saving…' : 'Save and get password'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
      />
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
