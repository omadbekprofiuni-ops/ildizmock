import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

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
  const [tab, setTab] = useState<'mine' | 'catalog'>('mine')
  const [mine, setMine] = useState<TestRow[]>([])
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
    api
      .get<TestRow[]>(`/center/${slug}/tests/`)
      .then((r) => setMine(r.data))
      .finally(() => setLoading(false))
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
    else loadCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, slug, filter])

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
    if (!confirm('Bu testdan nusxa yaratamizmi?')) return
    setBusy(testId)
    setMessage('')
    try {
      await api.post(`/center/${slug}/tests/${testId}/clone/`)
      setMessage('✅ Nusxa yaratildi')
      loadMine()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setMessage(`❌ ${err.response?.data?.detail ?? 'Xatolik yuz berdi'}`)
    } finally {
      setBusy(null)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const rows = tab === 'mine' ? mine : catalog

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-light text-slate-900">Testlar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Markaz bazasidagi testlar va SuperAdmin tayyorlagan global katalog.
        </p>
      </div>

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          Mening testlarim ({mine.length})
        </TabButton>
        <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')}>
          Global katalog
        </TabButton>
      </div>

      {tab === 'catalog' && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Select
            value={filter.module}
            onChange={(v) => setFilter({ ...filter, module: v })}
            options={[
              { value: '', label: 'Barcha modullar' },
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
              { value: '', label: 'Barcha qiyinliklar' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="p-4">Nomi</th>
              <th className="p-4">Modul</th>
              <th className="p-4">Qiyinlik</th>
              <th className="p-4">Savollar</th>
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  {tab === 'mine'
                    ? 'Hali testingiz yo\'q. Global katalogdan klon qiling.'
                    : 'Katalogda hali test yo\'q.'}
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{t.name}</div>
                    {t.category && (
                      <div className="text-xs text-slate-500">{t.category}</div>
                    )}
                    {tab === 'mine' && t.is_cloned && (
                      <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        Klon
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-700">
                    {MODULE_LABEL[t.module] ?? t.module}
                  </td>
                  <td className="p-4 text-sm text-slate-700">
                    {DIFFICULTY_LABEL[t.difficulty] ?? t.difficulty}
                  </td>
                  <td className="p-4 text-sm text-slate-700">{t.questions_count}</td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        t.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : t.status === 'archived'
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {tab === 'catalog' ? (
                      t.already_cloned ? (
                        <span className="text-xs text-slate-400">
                          Allaqachon nusxalangan
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => cloneTest(t.id)}
                          className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {busy === t.id ? 'Klonlash…' : 'Klon qilish'}
                        </button>
                      )
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/${slug}/admin/tests/${t.id}/preview`}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          👁 Preview
                        </Link>
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => cloneOwnTest(t.id)}
                          className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {busy === t.id ? '…' : '📋 Clone'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-slate-900 text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-700'
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
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
