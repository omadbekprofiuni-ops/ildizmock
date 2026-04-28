import { ArrowLeft, CheckCircle2, Copy, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageShell,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
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
    <PageShell>
      <div className="mb-6">
        <Link
          to={`/${slug}/admin/mock`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft size={14} /> Sessiyalar
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {session.name}
          </h1>
          <Chip
            tone={
              session.status === 'finished'
                ? 'emerald'
                : session.status === 'waiting'
                  ? 'slate'
                  : 'indigo'
            }
          >
            {STATUS_LABEL[session.status]}
          </Chip>
        </div>
      </div>

      {/* Join link */}
      <SurfaceCard className="mb-6 border-indigo-100 bg-indigo-50/40">
        <p className="mb-2 text-sm font-semibold text-slate-700">
          Talabalar uchun link:
        </p>
        <div className="flex items-center gap-3">
          <input
            readOnly
            value={joinUrl}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm"
            onFocus={(e) => e.target.select()}
          />
          <button type="button" onClick={copyLink} className={btnPrimary}>
            <Copy size={14} />
            {copied ? 'Nusxalandi' : 'Nusxa olish'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Access code:{' '}
          <code className="rounded bg-white px-2 py-0.5 font-mono text-indigo-700">
            {session.access_code}
          </code>
        </p>
      </SurfaceCard>

      {/* Control */}
      <SurfaceCard className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Boshqaruv</h2>

        {session.status === 'waiting' && (
          <>
            <button
              type="button"
              disabled={busy || session.participants.length === 0}
              onClick={start}
              className={btnPrimary + ' !px-8 !py-3 text-base'}
            >
              <Play size={18} /> START — Listening
            </button>
            <p className="mt-2 text-sm text-slate-600">
              {session.participants.length} ta talaba qo'shilgan
              {session.participants.length === 0 &&
                ' — talabalar qo\'shilishini kuting'}
            </p>
          </>
        )}

        {(session.status === 'listening' ||
          session.status === 'reading' ||
          session.status === 'writing') && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 px-6 py-5 text-center">
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
              className={btnPrimary + ' w-full justify-center !py-3 text-base'}
            >
              {session.status === 'listening' && 'NEXT → Reading'}
              {session.status === 'reading' && 'NEXT → Writing'}
              {session.status === 'writing' && '✓ FINISH'}
            </button>
          </div>
        )}

        {session.status === 'finished' && (
          <div className="text-center">
            <p className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-emerald-600">
              <CheckCircle2 size={20} /> Sessiya tugadi
            </p>
            <div>
              <Link
                to={`/${slug}/admin/mock/${session.id}/results`}
                className={btnPrimary + ' mt-2'}
              >
                Natijalarni ko'rish
              </Link>
            </div>
          </div>
        )}
      </SurfaceCard>

      {/* Participants */}
      <SurfaceCard>
        <h2 className="mb-4 text-base font-semibold text-slate-900">
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
                    submittedThis
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="font-medium text-slate-900">{p.full_name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(p.joined_at).toLocaleTimeString('uz-UZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {submittedThis && (
                      <span className="ml-2 font-semibold text-emerald-700">
                        ✓ topshirdi
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SurfaceCard>
    </PageShell>
  )
}

void btnOutline
