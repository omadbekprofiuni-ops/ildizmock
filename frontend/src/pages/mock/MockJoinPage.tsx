import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import brandLogo from '@/assets/brand-logo.png'
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
  waiting: 'Waiting',
  listening: 'Listening in progress',
  reading: 'Reading in progress',
  writing: 'Writing in progress',
  speaking: 'Speaking in progress',
  finished: 'Finished',
  cancelled: 'Cancelled',
}

function BrandHeader() {
  return (
    <div className="mb-6 flex items-center justify-center gap-3">
      <img
        src={brandLogo}
        alt="ILDIZmock"
        width={44}
        height={44}
        className="h-11 w-11 object-contain"
        draggable={false}
      />
      <span className="text-2xl font-extrabold tracking-tight">
        <span className="text-brand-900">ILDIZ</span>
        <span className="text-teal-600">mock</span>
      </span>
    </div>
  )
}

export default function MockJoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestName, setGuestName] = useState('')

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
      setError(err.response?.data?.detail ?? 'An error occurred')
    } finally {
      setBusy(false)
    }
  }

  const submitGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return
    const fullName = guestName.trim()
    if (fullName.length < 2) {
      setError('Please enter your first and last name')
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
      setError(err.response?.data?.detail ?? 'An error occurred')
    } finally {
      setBusy(false)
    }
  }

  if (notFound) {
    return (
      <Center>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <BrandHeader />
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Session not found
          </h1>
          <p className="text-slate-600">Please re-check the link.</p>
        </div>
      </Center>
    )
  }

  if (!info) {
    return (
      <Center>
        <div className="text-slate-500">Loading…</div>
      </Center>
    )
  }

  if (!info.join_allowed) {
    return (
      <Center>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <BrandHeader />
          <h1 className="mb-2 text-2xl font-bold text-slate-900">{info.name}</h1>
          <p className="mb-4 text-sm text-slate-500">{info.date}</p>
          <div className="mb-2 inline-block rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-700">
            {STATUS_LABEL[info.status] ?? info.status}
          </div>
          <p className="mt-4 text-slate-600">
            This session is no longer accepting new participants.
          </p>
        </div>
      </Center>
    )
  }

  const pending = info.participants.filter((p) => !p.has_joined && !p.is_guest)
  const joined = info.participants.filter((p) => p.has_joined)

  return (
    <Center>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-100">
        <BrandHeader />

        {/* Session info */}
        <div className="mb-6 text-center">
          <div className="eyebrow eyebrow--accent mb-3">
            <span className="eyebrow__dot" />
            IELTS Mock Exam
          </div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">{info.name}</h1>
          <p className="text-sm text-slate-500">
            {info.date} · Code:{' '}
            <code className="font-mono font-semibold text-brand-700">
              {info.access_code}
            </code>
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-4 py-1 text-xs font-semibold text-brand-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            {STATUS_LABEL[info.status] ?? info.status}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Pre-registered list */}
        {pending.length > 0 && (
          <div className="mb-4">
            <h2 className="mb-2 text-base font-semibold text-slate-900">
              Select your name
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Click on your name to join the session. If your name is not
              listed, ask your teacher.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pending.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => claimParticipant(p.id)}
                  className="group flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600 transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">
                    {p.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {p.full_name}
                    </div>
                    <div className="text-xs text-slate-500">Click →</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {pending.length === 0 && info.participants.length === 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No one has joined the session yet.
          </div>
        )}

        {pending.length === 0 && info.participants.length > 0 && (
          <div className="mb-4 rounded-xl border border-accent-100 bg-accent-50 p-4 text-sm text-accent-700">
            All pre-registered students have already joined.
          </div>
        )}

        {/* Guest mode toggle */}
        {info.allow_guests && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            {!showGuestForm ? (
              <button
                type="button"
                onClick={() => setShowGuestForm(true)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                I'm not on the list — enter a new name
              </button>
            ) : (
              <form onSubmit={submitGuest} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Enter your first and last name
                </h3>
                <input
                  autoFocus
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base outline-none transition-colors focus:border-brand-500 focus:bg-brand-50/40"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-lg bg-gradient-to-r from-brand-600 to-accent-500 py-2.5 font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {busy ? 'Joining…' : 'Join'}
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
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Already joined */}
        {joined.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              In session ({joined.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {joined.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700"
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-accent-50 p-4">
      {/* Soft radial glows — matches landing/hero aesthetic */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, var(--brand-100) 0%, transparent 60%)',
          opacity: 0.6,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-[400px] w-[400px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, var(--accent-100) 0%, transparent 60%)',
          opacity: 0.5,
        }}
      />
      <div className="relative z-10 w-full max-w-2xl">{children}</div>
    </div>
  )
}
