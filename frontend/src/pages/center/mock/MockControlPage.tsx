import { ArrowLeft, CheckCircle2, Copy, Play, Plus, RotateCcw, Trash2, UserPlus, XOctagon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Chip,
  PageShell,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

function extractErrorDetail(err: unknown, fallback: string): string {
  const e = err as {
    response?: { status?: number; data?: { detail?: string } | Record<string, unknown> }
    message?: string
  }
  const data = e.response?.data
  if (data && typeof data === 'object') {
    if ('detail' in data && typeof data.detail === 'string') return data.detail
    const first = Object.values(data as Record<string, unknown>)[0]
    if (Array.isArray(first) && first.length) return String(first[0])
    if (typeof first === 'string') return first
  }
  if (e.response?.status) return `${fallback} (HTTP ${e.response.status})`
  return e.message || fallback
}

interface Participant {
  id: number
  full_name: string
  joined_at: string
  has_joined: boolean
  claimed_at: string | null
  is_guest: boolean
  user_id: number | null
  listening_score: string | null
  reading_score: string | null
  writing_score: string | null
  speaking_score: string | null
  listening_submitted_at: string | null
  reading_submitted_at: string | null
  writing_submitted_at: string | null
}

interface EligibleStudent {
  id: number
  full_name: string
  username: string
  phone: string
  is_added: boolean
}

interface SessionDetail {
  id: number
  name: string
  date: string
  status: 'waiting' | 'listening' | 'reading' | 'writing' | 'finished' | 'cancelled'
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
  allow_late_join: boolean
  allow_guests: boolean
  link_expires_at: string | null
  participants: Participant[]
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Kutilmoqda',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  finished: 'Tugagan',
  cancelled: 'Bekor qilingan',
}

export default function MockControlPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [showAddDialog, setShowAddDialog] = useState(false)

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
      toast.success('Sessiya boshlandi — Listening')
      load()
    } catch (err) {
      toast.error(extractErrorDetail(err, 'Sessiyani boshlab bo‘lmadi'))
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
      toast.success(`${next} bosqichiga o‘tildi`)
      load()
    } catch (err) {
      toast.error(extractErrorDetail(err, 'Bosqichni o‘zgartirib bo‘lmadi'))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!confirm("Sessiyani bekor qilasizmi? Talabalar natijalari saqlanmaydi.")) return
    setBusy(true)
    try {
      await api.post(`/center/${slug}/mock/${sessionId}/cancel/`)
      toast.success('Sessiya bekor qilindi')
      navigate(`/${slug}/admin/mock`)
    } catch (err) {
      toast.error(extractErrorDetail(err, 'Sessiyani bekor qilib bo‘lmadi'))
    } finally {
      setBusy(false)
    }
  }

  const reopen = async () => {
    if (!confirm('Sessiyani qayta ochasizmi? (24 soat ichida ruxsat etiladi)')) return
    setBusy(true)
    try {
      await api.post(`/center/${slug}/mock/${sessionId}/reopen/`)
      load()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail
      alert(detail || 'Qayta ochib bo‘lmadi')
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
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
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
      <SurfaceCard className="mb-6 border-red-100 bg-red-50/40">
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
          <code className="rounded bg-white px-2 py-0.5 font-mono text-red-700">
            {session.access_code}
          </code>
        </p>
      </SurfaceCard>

      {/* Control */}
      <SurfaceCard className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Boshqaruv</h2>

        {session.status === 'waiting' && (() => {
          const noParticipants = session.participants.length === 0
          const noListeningTest = !session.listening_test
          const blockReason = noListeningTest
            ? 'Listening test biriktirilmagan — sessiyani tahrirlab Listening test tanlang.'
            : noParticipants
              ? 'Avval talaba qo‘shing yoki link orqali kirishlarini kuting.'
              : ''
          const disabled = busy || noParticipants || noListeningTest
          return (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={start}
                title={blockReason || undefined}
                className={btnPrimary + ' !px-8 !py-3 text-base disabled:cursor-not-allowed disabled:opacity-50'}
              >
                <Play size={18} /> START — Listening
              </button>
              <p className="mt-2 text-sm text-slate-600">
                {session.participants.length} ta talaba qo'shilgan
              </p>
              {blockReason && (
                <p className="mt-1 text-sm font-medium text-amber-700">
                  ⚠ {blockReason}
                </p>
              )}
            </>
          )
        })()}

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
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                to={`/${slug}/admin/mock/${session.id}/results`}
                className={btnPrimary}
              >
                Natijalarni ko'rish
              </Link>
              <button
                type="button"
                onClick={reopen}
                disabled={busy}
                className={btnOutline}
                title="24 soat ichida qayta ochish mumkin"
              >
                <RotateCcw size={14} /> Qayta ochish
              </button>
            </div>
          </div>
        )}

        {session.status === 'cancelled' && (
          <div className="text-center">
            <p className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-rose-600">
              <XOctagon size={20} /> Sessiya bekor qilingan
            </p>
            <button
              type="button"
              onClick={reopen}
              disabled={busy}
              className={btnOutline}
              title="24 soat ichida qayta ochish mumkin"
            >
              <RotateCcw size={14} /> Qayta ochish
            </button>
          </div>
        )}

        {/* Bekor qilish — faqat hali tugamagan sessiyalar uchun */}
        {(session.status === 'waiting' ||
          session.status === 'listening' ||
          session.status === 'reading' ||
          session.status === 'writing') && (
          <div className="mt-4 border-t border-slate-100 pt-4 text-center">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <XOctagon size={14} /> Sessiyani bekor qilish
            </button>
          </div>
        )}
      </SurfaceCard>

      {/* Participants */}
      <SurfaceCard>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Talabalar ({session.participants.length})
          </h2>
          {session.status === 'waiting' && (
            <button
              type="button"
              onClick={() => setShowAddDialog(true)}
              className={btnPrimary}
            >
              <UserPlus size={14} /> Talaba qo'shish
            </button>
          )}
        </div>

        {session.participants.length === 0 ? (
          <p className="text-sm text-slate-500">
            Hali hech kim qo'shilmagan.
            {session.status === 'waiting' && ' "Talaba qo\'shish" tugmasi orqali oldindan ro\'yxatga oling.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {session.participants.map((p) => {
              const submittedThis =
                (session.status === 'listening' && p.listening_submitted_at) ||
                (session.status === 'reading' && p.reading_submitted_at) ||
                (session.status === 'writing' && p.writing_submitted_at)
              const pending = !p.has_joined
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-3 ${
                    submittedThis
                      ? 'border-emerald-200 bg-emerald-50'
                      : pending
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {p.full_name}
                        {p.is_guest && (
                          <span className="ml-1.5 text-xs font-normal text-slate-500">
                            (mehmon)
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {pending ? (
                          <span className="font-semibold text-amber-700">
                            ⏳ kutilmoqda
                          </span>
                        ) : p.claimed_at ? (
                          <>
                            ✓ kirdi:{' '}
                            {new Date(p.claimed_at).toLocaleTimeString('uz-UZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </>
                        ) : (
                          new Date(p.joined_at).toLocaleTimeString('uz-UZ', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        )}
                        {submittedThis && (
                          <span className="ml-2 font-semibold text-emerald-700">
                            ✓ topshirdi
                          </span>
                        )}
                      </div>
                    </div>
                    {pending && session.status === 'waiting' && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`${p.full_name} ni ro'yxatdan olib tashlaymizmi?`)) return
                          await api.delete(
                            `/center/${slug}/mock/${sessionId}/participants/${p.id}/remove/`,
                          )
                          load()
                        }}
                        className="rounded p-1 text-rose-500 hover:bg-rose-100"
                        title="Olib tashlash"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SurfaceCard>

      {showAddDialog && (
        <AddParticipantsDialog
          slug={slug!}
          sessionId={sessionId!}
          onClose={() => setShowAddDialog(false)}
          onAdded={() => {
            setShowAddDialog(false)
            load()
          }}
        />
      )}
    </PageShell>
  )
}

function AddParticipantsDialog({
  slug,
  sessionId,
  onClose,
  onAdded,
}: {
  slug: string
  sessionId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [students, setStudents] = useState<EligibleStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<EligibleStudent[]>(
        `/center/${slug}/mock/${sessionId}/eligible-students/`,
      )
      .then((r) => setStudents(r.data))
      .finally(() => setLoading(false))
  }, [slug, sessionId])

  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const submit = async () => {
    if (selected.size === 0) {
      setError('Hech bo\'lmaganda bitta talaba tanlang')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post(`/center/${slug}/mock/${sessionId}/add-participants/`, {
        user_ids: Array.from(selected),
      })
      onAdded()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'Xatolik yuz berdi')
    } finally {
      setBusy(false)
    }
  }

  const filtered = students.filter((s) => {
    if (s.is_added) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Talabalarni qo'shish
            </h2>
            <p className="text-xs text-slate-500">
              Ro'yxatdan tanlang — sessiya boshlanganda ular o'z ismini bosib kirishadi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, username yoki telefon bo'yicha qidirish…"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="p-4 text-center text-slate-500">Yuklanmoqda…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              {students.length === 0
                ? 'Markazda talabalar yo\'q. Avval Talabalar sahifasidan akkaunt yarating.'
                : students.every((s) => s.is_added)
                  ? 'Barcha talabalar allaqachon qo\'shilgan.'
                  : 'Qidiruvga mos talaba topilmadi.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {s.full_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        @{s.username}
                        {s.phone && ` · ${s.phone}`}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="border-t border-rose-100 bg-rose-50 px-6 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <span className="text-xs text-slate-500">
            {selected.size} ta tanlandi
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnOutline}>
              Bekor
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || selected.size === 0}
              className={btnPrimary + ' disabled:opacity-50'}
            >
              <Plus size={14} />
              {busy ? 'Qo\'shilmoqda…' : `Qo'shish (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

void btnOutline
