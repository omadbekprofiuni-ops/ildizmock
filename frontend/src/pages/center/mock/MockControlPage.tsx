import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '@/lib/api'

interface Participant {
  id: number
  full_name: string
  joined_at: string
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
  listening_submitted_at: string | null
  reading_submitted_at: string | null
  writing_submitted_at: string | null
}

interface SessionDetail {
  id: number
  name: string
  date: string
  status: 'waiting' | 'listening' | 'reading' | 'writing' | 'finished'
  access_code: string
  started_at: string | null
  finished_at: string | null
  section_started_at: string | null
  listening_duration: number
  reading_duration: number
  writing_duration: number
  listening_test: { id: string; name: string } | null
  reading_test: { id: string; name: string } | null
  writing_test: { id: string; name: string } | null
  participants: Participant[]
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Kutilmoqda',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  finished: 'Tugagan',
}

export default function MockControlPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())

  const load = () => {
    if (!slug || !sessionId) return
    api
      .get<SessionDetail>(`/center/${slug}/mock/${sessionId}/`)
      .then((r) => setSession(r.data))
      .catch(() => setSession(null))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sessionId])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!session) {
    return <div className="p-6 text-slate-500">Yuklanmoqda…</div>
  }

  const joinUrl = `${window.location.origin}/mock/join/${session.access_code}`
  const copyLink = async () => {
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const start = async () => {
    if (!confirm('Listening sessiyasini boshlashga ishonchingiz komilmi? Hamma talabalar avtomatik test sahifasiga o‘tadi.'))
      return
    setBusy(true)
    try {
      await api.post(`/center/${slug}/mock/${sessionId}/start/`)
      load()
    } finally {
      setBusy(false)
    }
  }

  const advance = async () => {
    const next =
      session.status === 'listening'
        ? 'Reading'
        : session.status === 'reading'
          ? 'Writing'
          : 'Yakunlash'
    if (!confirm(`${next} bosqichiga o‘tishni tasdiqlaysizmi?`)) return
    setBusy(true)
    try {
      await api.post(`/center/${slug}/mock/${sessionId}/advance/`)
      load()
    } finally {
      setBusy(false)
    }
  }

  // Compute remaining seconds locally
  let remainingSec = 0
  if (
    session.section_started_at &&
    session.status !== 'waiting' &&
    session.status !== 'finished'
  ) {
    const started = new Date(session.section_started_at).getTime()
    const total =
      session.status === 'listening'
        ? session.listening_duration
        : session.status === 'reading'
          ? session.reading_duration
          : session.writing_duration
    remainingSec = Math.max(
      0,
      Math.floor(total * 60 - (now - started) / 1000),
    )
  }

  const m = Math.floor(remainingSec / 60)
    .toString()
    .padStart(2, '0')
  const s = (remainingSec % 60).toString().padStart(2, '0')

  const submittedCount = session.participants.filter((p) => {
    if (session.status === 'listening') return p.listening_submitted_at
    if (session.status === 'reading') return p.reading_submitted_at
    if (session.status === 'writing') return p.writing_submitted_at
    return false
  }).length

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to={`/${slug}/admin/mock`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Sessiyalar
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-light text-slate-900">{session.name}</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            session.status === 'finished'
              ? 'bg-green-100 text-green-700'
              : session.status === 'waiting'
                ? 'bg-slate-100 text-slate-700'
                : 'bg-blue-100 text-blue-800'
          }`}
        >
          {STATUS_LABEL[session.status]}
        </span>
      </div>

      {/* Join link */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <p className="mb-2 text-sm font-semibold text-slate-700">
          Talabalar uchun link:
        </p>
        <div className="flex items-center gap-3">
          <input
            readOnly
            value={joinUrl}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {copied ? '✓ Nusxalandi' : 'Nusxa olish'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Access code:{' '}
          <code className="rounded bg-white px-2 py-0.5 font-mono">
            {session.access_code}
          </code>
        </p>
      </div>

      {/* Control */}
      <div className="mb-6 rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Boshqaruv</h2>

        {session.status === 'waiting' && (
          <>
            <button
              type="button"
              disabled={busy || session.participants.length === 0}
              onClick={start}
              className="rounded-full bg-green-600 px-8 py-3 text-lg font-bold text-white hover:bg-green-700 disabled:opacity-40"
            >
              ▶ START — Listening
            </button>
            <p className="mt-2 text-sm text-slate-600">
              {session.participants.length} ta talaba qo'shilgan
              {session.participants.length === 0 && ' — talabalar qo\'shilishini kuting'}
            </p>
          </>
        )}

        {(session.status === 'listening' ||
          session.status === 'reading' ||
          session.status === 'writing') && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-100 px-6 py-4 text-center">
              <div className="text-xs uppercase tracking-widest text-slate-500">
                {STATUS_LABEL[session.status]} taymeri
              </div>
              <div className="font-mono text-5xl font-bold text-slate-900">
                {m}:{s}
              </div>
            </div>

            <div className="text-center text-sm text-slate-600">
              Yuborgan talabalar: <strong>{submittedCount}</strong> /{' '}
              {session.participants.length}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={advance}
              className="w-full rounded-full bg-orange-500 px-8 py-3 text-lg font-bold text-white hover:bg-orange-600 disabled:opacity-40"
            >
              {session.status === 'listening' && 'NEXT → Reading'}
              {session.status === 'reading' && 'NEXT → Writing'}
              {session.status === 'writing' && '✓ FINISH'}
            </button>
          </div>
        )}

        {session.status === 'finished' && (
          <div className="text-center">
            <p className="mb-3 text-lg font-semibold text-green-700">
              ✓ Sessiya tugadi
            </p>
            <Link
              to={`/${slug}/admin/mock/${session.id}/results`}
              className="inline-block rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Natijalarni ko'rish
            </Link>
          </div>
        )}
      </div>

      {/* Participants */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Talabalar ({session.participants.length})
        </h2>

        {session.participants.length === 0 ? (
          <p className="text-sm text-slate-500">Hali hech kim qo'shilmagan</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {session.participants.map((p) => {
              const submittedThis =
                (session.status === 'listening' && p.listening_submitted_at) ||
                (session.status === 'reading' && p.reading_submitted_at) ||
                (session.status === 'writing' && p.writing_submitted_at)
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-3 ${
                    submittedThis ? 'border-green-300 bg-green-50' : 'bg-slate-50'
                  }`}
                >
                  <div className="font-medium text-slate-900">{p.full_name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(p.joined_at).toLocaleTimeString('uz-UZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {submittedThis && (
                      <span className="ml-2 font-semibold text-green-700">
                        ✓ topshirdi
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
