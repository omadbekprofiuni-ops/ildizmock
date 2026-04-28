import { Plus, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

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

interface Student {
  id: number
  username: string
  first_name: string
  last_name: string
  is_active: boolean
  target_band: string | null
  tests_taken: number
  created_at: string
  teacher_id: number | null
  teacher_name: string | null
}

interface Credentials {
  username: string
  password?: string
  new_password?: string
  login_url: string
}

export default function StudentsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [filter, setFilter] = useState('')

  const load = () => {
    if (!slug) return
    setLoading(true)
    api
      .get<Student[]>(`/center/${slug}/students/`)
      .then((r) => setStudents(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [slug])

  const filtered = useMemo(() => {
    if (!filter.trim()) return students
    const q = filter.trim().toLowerCase()
    return students.filter((s) =>
      `${s.first_name} ${s.last_name} ${s.username}`.toLowerCase().includes(q),
    )
  }, [students, filter])

  const resetPassword = async (id: number) => {
    if (!slug || !window.confirm('Parolni tiklamoqchimisiz?')) return
    const r = await api.post(`/center/${slug}/students/${id}/reset-password/`)
    setCredentials({ ...r.data, login_url: `/${slug}/login` })
  }

  const deactivate = async (id: number) => {
    if (!slug || !window.confirm("Talabani o'chirmoqchimisiz?")) return
    await api.post(`/center/${slug}/students/${id}/deactivate/`)
    load()
  }

  return (
    <PageShell>
      <PageHeader
        title="Talabalar"
        subtitle="Markazga ro'yxatdan o'tgan barcha talabalar"
        actions={
          <button type="button" onClick={() => setShowAdd(true)} className={btnPrimary}>
            <Plus size={16} /> Yangi talaba
          </button>
        }
      />

      {!loading && students.length === 0 ? (
        <StateCard
          Icon={Users}
          tone="indigo"
          title="Hali talaba yo'q"
          description="“Yangi talaba” tugmasini bosib birinchi talabani qo'shing."
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
                placeholder="Ism yoki login bo'yicha qidirish..."
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
                <th className={adminTable.th}>Talaba</th>
                <th className={adminTable.th}>Login</th>
                <th className={adminTable.th}>Maqsad</th>
                <th className={adminTable.th}>Testlar</th>
                <th className={adminTable.th}>Holat</th>
                <th className={adminTable.th + ' text-right'}>Amal</th>
              </tr>
            </thead>
            <tbody className={adminTable.tbody}>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                    Yuklanmoqda…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                    Qidiruv bo'yicha hech narsa topilmadi.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const initials = `${s.first_name?.[0] ?? ''}${s.last_name?.[0] ?? ''}`.toUpperCase() || '?'
                  return (
                    <tr key={s.id} className={adminTable.trHover}>
                      <td className={adminTable.td}>
                        <Link
                          to={`/${slug}/admin/students/${s.id}`}
                          className="flex items-center gap-3 hover:text-red-700"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-700">
                            {initials}
                          </div>
                          <div className="font-semibold text-slate-900">
                            {s.first_name} {s.last_name}
                          </div>
                        </Link>
                      </td>
                      <td className={adminTable.td + ' font-mono text-xs text-slate-600'}>
                        {s.username}
                      </td>
                      <td className={adminTable.td}>
                        {s.target_band ? `Band ${s.target_band}` : <span className="text-slate-400">—</span>}
                      </td>
                      <td className={adminTable.td}>{s.tests_taken ?? 0} ta</td>
                      <td className={adminTable.td}>
                        {s.is_active ? <Chip tone="emerald">Faol</Chip> : <Chip>O'chirilgan</Chip>}
                      </td>
                      <td className={adminTable.td + ' text-right'}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => resetPassword(s.id)}
                            className={btnGhost}
                          >
                            Parolni tiklash
                          </button>
                          {s.is_active && (
                            <button
                              type="button"
                              onClick={() => deactivate(s.id)}
                              className="rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                            >
                              O'chirish
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
        <AddStudentModal
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
        <CredentialsModal
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}
    </PageShell>
  )
}

void btnOutline

function AddStudentModal({
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
    target_band: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim().toLowerCase(),
      }
      if (form.target_band) payload.target_band = parseFloat(form.target_band)
      const r = await api.post(`/center/${slug}/students/`, payload)
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
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Yangi talaba</h2>

        <div className="space-y-3">
          <Input
            label="Ism"
            value={form.first_name}
            onChange={(v) => setForm({ ...form, first_name: v })}
          />
          <Input
            label="Familiya"
            value={form.last_name}
            onChange={(v) => setForm({ ...form, last_name: v })}
          />
          <Input
            label="Login (username)"
            value={form.username}
            onChange={(v) => setForm({ ...form, username: v })}
            hint="Faqat lotin harflari va raqamlar"
          />
          <Input
            label="Maqsad band (ixtiyoriy)"
            value={form.target_band}
            onChange={(v) => setForm({ ...form, target_band: v })}
            placeholder="masalan: 7.0"
          />
        </div>

        {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}

        <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          💡 Parol avtomatik yaratiladi va keyingi ekranda ko'rsatiladi. Eslab
          qoling, talabaga bering.
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className={btnOutline + ' flex-1 justify-center'}>
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={btnPrimary + ' flex-1 justify-center'}
          >
            {submitting ? 'Saqlanmoqda…' : 'Saqlash va parol olish'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Input({
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
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
      />
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
