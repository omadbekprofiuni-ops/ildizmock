import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

interface SessionRow {
  id: number
  name: string
  date: string
  status: string
  access_code: string
  participants_count: number
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Kutilmoqda',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  finished: 'Tugagan',
}

const STATUS_COLOR: Record<string, string> = {
  waiting: 'bg-slate-100 text-slate-700',
  listening: 'bg-blue-100 text-blue-800',
  reading: 'bg-amber-100 text-amber-800',
  writing: 'bg-orange-100 text-orange-800',
  finished: 'bg-green-100 text-green-700',
}

export default function MockSessionsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    if (!slug) return
    setLoading(true)
    api
      .get<SessionRow[]>(`/center/${slug}/mock/`)
      .then((r) => setSessions(Array.isArray(r.data) ? r.data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light text-slate-900">Mock sessiyalar</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sinxron mock testlar — talabalar bitta linkdan kirib, bir vaqtda boshlaydi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          + Yangi sessiya
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="p-4">Nomi</th>
              <th className="p-4">Sana</th>
              <th className="p-4">Kod</th>
              <th className="p-4">Talabalar</th>
              <th className="p-4">Status</th>
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
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Hali sessiya yaratilmagan.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-900">{s.name}</td>
                  <td className="p-4 text-sm text-slate-700">{s.date}</td>
                  <td className="p-4 font-mono text-sm">{s.access_code}</td>
                  <td className="p-4 text-sm">{s.participants_count}</td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        STATUS_COLOR[s.status] ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <Link
                      to={`/${slug}/admin/mock/${s.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Ochish →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  )
}

interface TestPick {
  id: string
  name: string
  module: string
  difficulty: string
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
    api
      .get(`/center/${slug}/mock/available-tests/`)
      .then((r) => setTests(r.data))
      .finally(() => setLoading(false))
  }, [slug])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
      const err = e as { response?: { data?: Record<string, unknown> } }
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const first = Object.values(data)[0]
        setError(Array.isArray(first) ? String(first[0]) : String(first))
      } else {
        setError('Xatolik yuz berdi')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-2xl font-semibold">Yangi mock sessiya</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500">Testlar yuklanmoqda…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Sessiya nomi">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Masalan: 2026-04-27 Kechki guruh"
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-900 focus:outline-none"
              />
            </Field>

            <Field label="Sana">
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2"
              />
            </Field>

            <TestSelect
              label="Listening test"
              value={form.listening_test}
              onChange={(v) => setForm({ ...form, listening_test: v })}
              tests={tests.listening}
            />
            <TestSelect
              label="Reading test"
              value={form.reading_test}
              onChange={(v) => setForm({ ...form, reading_test: v })}
              tests={tests.reading}
            />
            <TestSelect
              label="Writing test"
              value={form.writing_test}
              onChange={(v) => setForm({ ...form, writing_test: v })}
              tests={tests.writing}
            />

            <div className="grid grid-cols-3 gap-3">
              <Field label="Listening (daq.)">
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
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                />
              </Field>
              <Field label="Reading (daq.)">
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.reading_duration}
                  onChange={(e) =>
                    setForm({ ...form, reading_duration: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                />
              </Field>
              <Field label="Writing (daq.)">
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.writing_duration}
                  onChange={(e) =>
                    setForm({ ...form, writing_duration: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-2"
                />
              </Field>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Bekor
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {busy ? 'Yaratilmoqda…' : 'Yaratish'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  value,
  onChange,
  tests,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  tests: TestPick[]
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-4 py-2"
      >
        <option value="">— Tanlang —</option>
        {tests.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {tests.length === 0 && (
        <p className="mt-1 text-xs text-amber-600">
          Bu modul bo'yicha published test yo'q. Avval testni global katalogdan
          klon qiling va publish qiling.
        </p>
      )}
    </Field>
  )
}
