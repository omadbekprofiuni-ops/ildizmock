import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

interface Participant {
  id: number
  full_name: string
  joined_at: string
  has_joined: boolean
  is_guest: boolean
}

interface SessionInfo {
  id: number
  name: string
  date: string
  status: string
  access_code: string
  participants_count: number
  allow_late_join: boolean
  allow_guests: boolean
  link_expires_at: string | null
  join_allowed: boolean
  participants: Participant[]
}

const STORAGE_KEY = (code: string) => `ildizmock:mock-bsid:${code}`

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Kutilmoqda',
  listening: 'Listening jarayonda',
  reading: 'Reading jarayonda',
  writing: 'Writing jarayonda',
  speaking: 'Speaking jarayonda',
  finished: 'Tugagan',
  cancelled: 'Bekor qilingan',
}

export default function MockJoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // Guest mode
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestName, setGuestName] = useState('')

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

  const claimParticipant = async (participantId: number) => {
    if (!code) return
    setError('')
    setBusy(true)
    try {
      const r = await api.post<{ browser_session_id: string }>(
        `/mock/join/${code}/`,
        { participant_id: participantId },
      )
      localStorage.setItem(STORAGE_KEY(code), r.data.browser_session_id)
      navigate(`/mock/session/${r.data.browser_session_id}`, { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'Xatolik yuz berdi')
    } finally {
      setBusy(false)
    }
  }

  const submitGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return
    const fullName = guestName.trim()
    if (fullName.length < 2) {
      setError('Ism va familiyangizni kiriting')
      return
    }
    setError('')
    setBusy(true)
    try {
      const r = await api.post<{ browser_session_id: string }>(
        `/mock/join/${code}/`,
        { full_name: fullName },
      )
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

  // Sessiya endi qo'shilish uchun ochiq emas
  if (!info.join_allowed) {
    return (
      <Center>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">{info.name}</h1>
          <p className="mb-4 text-sm text-slate-500">{info.date}</p>
          <div className="mb-2 inline-block rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-700">
            {STATUS_LABEL[info.status] ?? info.status}
          </div>
          <p className="mt-4 text-slate-600">
            Bu sessiyaga endi qo‘shilib bo‘lmaydi.
          </p>
        </div>
      </Center>
    )
  }

  // Pre-registered (hali kirmagan) participantlar
  const pending = info.participants.filter((p) => !p.has_joined && !p.is_guest)
  const joined = info.participants.filter((p) => p.has_joined)

  return (
    <Center>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-block rounded-lg bg-red-600 px-4 py-1.5 text-sm font-bold text-white">
            IELTS MOCK
          </div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">{info.name}</h1>
          <p className="text-sm text-slate-500">
            {info.date} · Kod:{' '}
            <code className="font-mono text-red-600">{info.access_code}</code>
          </p>
          <div className="mt-3 inline-block rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold text-blue-700">
            {STATUS_LABEL[info.status] ?? info.status}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Pre-registered ro'yxat */}
        {pending.length > 0 && (
          <div className="mb-4">
            <h2 className="mb-2 text-base font-semibold text-slate-900">
              Ismingizni tanlang
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Sessiyaga kirish uchun o‘z ismingizni bosing. Agar ro‘yxatda yo‘q
              bo‘lsangiz, ustozingizga murojaat qiling.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pending.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => claimParticipant(p.id)}
                  className="group flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 text-left transition-all hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600 group-hover:bg-red-100 group-hover:text-red-700">
                    {p.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {p.full_name}
                    </div>
                    <div className="text-xs text-slate-500">Bosing →</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {pending.length === 0 && info.participants.length === 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Sessiyaga hali hech kim qo‘shilmagan.
          </div>
        )}

        {pending.length === 0 && info.participants.length > 0 && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Barcha pre-registered talabalar allaqachon kirgan.
          </div>
        )}

        {/* Guest mode toggle */}
        {info.allow_guests && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            {!showGuestForm ? (
              <button
                type="button"
                onClick={() => setShowGuestForm(true)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Ro‘yxatda yo‘qman — yangi ism kiritaman
              </button>
            ) : (
              <form onSubmit={submitGuest} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Ism va familiyangizni kiriting
                </h3>
                <input
                  autoFocus
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Masalan: Aziz Karimov"
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-red-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy ? 'Qo‘shilmoqda…' : 'Qo‘shilish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGuestForm(false)
                      setGuestName('')
                      setError('')
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Bekor
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Allaqachon kirganlar */}
        {joined.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Sessiyada ({joined.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {joined.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                >
                  ✓ {p.full_name}
                </span>
              ))}
            </div>
          </div>
        )}
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
