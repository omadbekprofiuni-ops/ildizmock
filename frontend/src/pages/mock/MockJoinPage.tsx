import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

interface SessionInfo {
  id: number
  name: string
  date: string
  status: string
  participants_count: number
  participants: Array<{ id: number; full_name: string }>
}

const STORAGE_KEY = (code: string) => `ildizmock:mock-bsid:${code}`

export default function MockJoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // If we already have a bsid for this code, jump straight to the session
  useEffect(() => {
    if (!code) return
    const existing = localStorage.getItem(STORAGE_KEY(code))
    if (existing) {
      navigate(`/mock/session/${existing}`, { replace: true })
    }
  }, [code, navigate])

  const load = () => {
    if (!code) return
    api
      .get<SessionInfo>(`/mock/join/${code}/`)
      .then((r) => setInfo(r.data))
      .catch(() => setNotFound(true))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return
    const fullName = name.trim()
    if (fullName.length < 2) {
      setError('Ism va familiyangizni kiriting')
      return
    }
    setError('')
    setBusy(true)
    try {
      const r = await api.post<{
        browser_session_id: string
      }>(`/mock/join/${code}/`, { full_name: fullName })
      localStorage.setItem(STORAGE_KEY(code), r.data.browser_session_id)
      navigate(`/mock/session/${r.data.browser_session_id}`, { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'Xatolik yuz berdi')
    } finally {
      setBusy(false)
    }
  }

  if (notFound) {
    return (
      <Center>
        <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="mb-2 text-2xl font-bold text-red-600">Sessiya topilmadi</h1>
          <p className="text-slate-600">Linkni qayta tekshiring.</p>
        </div>
      </Center>
    )
  }

  if (!info) {
    return (
      <Center>
        <div className="text-slate-500">Yuklanmoqda…</div>
      </Center>
    )
  }

  if (info.status !== 'waiting') {
    return (
      <Center>
        <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            {info.name}
          </h1>
          <p className="text-slate-600">
            Sessiya allaqachon boshlangan. Yangi talabalar qo'shilolmaydi.
          </p>
        </div>
      </Center>
    )
  }

  return (
    <Center>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-center text-2xl font-bold text-slate-900">
          {info.name}
        </h1>
        <p className="mb-6 text-center text-sm text-slate-600">{info.date}</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Ism va familiyangizni kiriting
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: Aziz Karimov"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Qo\'shilmoqda…' : 'Qo\'shilish'}
          </button>
        </form>

        <div className="mt-8 border-t pt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Qo'shilganlar ({info.participants_count})
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-700">
            {info.participants.map((p) => (
              <li key={p.id}>• {p.full_name}</li>
            ))}
            {info.participants.length === 0 && (
              <li className="italic text-slate-400">Hali hech kim yo'q</li>
            )}
          </ul>
        </div>
      </div>
    </Center>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      {children}
    </div>
  )
}
