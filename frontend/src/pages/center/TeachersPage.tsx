import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { CredentialsModal } from '@/components/center/CredentialsModal'
import { api } from '@/lib/api'

interface Teacher {
  id: number
  username: string
  first_name: string
  last_name: string
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
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const load = () => {
    if (!slug) return
    setLoading(true)
    api
      .get<Teacher[]>(`/center/${slug}/teachers/`)
      .then((r) => setTeachers(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [slug])

  const resetPassword = async (id: number) => {
    if (!slug || !window.confirm('Parolni tiklamoqchimisiz?')) return
    const r = await api.post(`/center/${slug}/teachers/${id}/reset-password/`)
    setCredentials({ ...r.data, login_url: `/${slug}/login` })
  }

  const deactivate = async (id: number) => {
    if (!slug || !window.confirm('Ustozni o\'chirmoqchimisiz?')) return
    await api.post(`/center/${slug}/teachers/${id}/deactivate/`)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-light text-slate-900">Ustozlar</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Yangi ustoz
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="p-4">Ism</th>
              <th className="p-4">Login</th>
              <th className="p-4">Talabalari</th>
              <th className="p-4">Holat</th>
              <th className="p-4">Amal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  Yuklanmoqda…
                </td>
              </tr>
            ) : teachers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  Hali ustoz yo'q.
                </td>
              </tr>
            ) : (
              teachers.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-900">
                    {t.first_name} {t.last_name}
                  </td>
                  <td className="p-4 font-mono text-sm text-slate-600">{t.username}</td>
                  <td className="p-4 text-slate-700">{t.students_count}</td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        t.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.is_active ? 'Faol' : 'O\'chirilgan'}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    <button
                      type="button"
                      onClick={() => resetPassword(t.id)}
                      className="mr-3 text-orange-600 hover:underline"
                    >
                      Parolni tiklash
                    </button>
                    {t.is_active && (
                      <button
                        type="button"
                        onClick={() => deactivate(t.id)}
                        className="text-red-600 hover:underline"
                      >
                        O'chirish
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
        <CredentialsModal
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Yangi ustoz</h2>
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
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          💡 Parol avtomatik yaratiladi va keyingi ekranda ko'rsatiladi.
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm hover:bg-slate-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Saqlanmoqda…' : 'Saqlash va parol olish'}
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
      />
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
