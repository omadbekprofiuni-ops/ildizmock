import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

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

  const load = () => {
    if (!slug) return
    setLoading(true)
    api
      .get<Student[]>(`/center/${slug}/students/`)
      .then((r) => setStudents(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [slug])

  const resetPassword = async (id: number) => {
    if (!slug || !window.confirm('Parolni tiklamoqchimisiz?')) return
    const r = await api.post(`/center/${slug}/students/${id}/reset-password/`)
    setCredentials({ ...r.data, login_url: `/${slug}/login` })
  }

  const deactivate = async (id: number) => {
    if (!slug || !window.confirm('Talabani o\'chirmoqchimisiz?')) return
    await api.post(`/center/${slug}/students/${id}/deactivate/`)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-light text-slate-900">Talabalar</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Yangi talaba
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="p-4">Ism</th>
              <th className="p-4">Login</th>
              <th className="p-4">Maqsad</th>
              <th className="p-4">Testlar</th>
              <th className="p-4">Holat</th>
              <th className="p-4">Amal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Yuklanmoqda…
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Hali talaba yo'q. "+ Yangi talaba" tugmasini bosing.
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-900">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="p-4 font-mono text-sm text-slate-600">{s.username}</td>
                  <td className="p-4 text-slate-700">
                    {s.target_band ? `Band ${s.target_band}` : '—'}
                  </td>
                  <td className="p-4 text-slate-700">{s.tests_taken ?? 0}</td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        s.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.is_active ? 'Faol' : 'O\'chirilgan'}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    <button
                      type="button"
                      onClick={() => resetPassword(s.id)}
                      className="mr-3 text-orange-600 hover:underline"
                    >
                      Parolni tiklash
                    </button>
                    {s.is_active && (
                      <button
                        type="button"
                        onClick={() => deactivate(s.id)}
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
    </div>
  )
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Yangi talaba</h2>

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

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          💡 Parol avtomatik yaratiladi va keyingi ekranda ko'rsatiladi. Eslab
          qoling, talabaga bering.
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
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
      />
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
