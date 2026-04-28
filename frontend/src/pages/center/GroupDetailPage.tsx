import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Loader2,
  Minus,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StateCard,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Member = {
  id: number
  username: string
  full_name: string
  first_name: string
  last_name: string
  is_active: boolean
  enrolled_at: string | null
  avg_band: number | null
  latest_band: number | null
  test_count: number
}

type ChartPoint = {
  session_id: number
  name: string
  date: string | null
  avg: number | null
}

type GroupDetail = {
  id: number
  name: string
  description: string
  teacher: { id: number; full_name: string; username: string } | null
  target_band_score: string | null
  class_schedule: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  student_count: number
  avg_score: number | null
  latest_avg: number | null
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  progress_chart: ChartPoint[]
  members: Member[]
}

function TrendBadge({ trend }: { trend: GroupDetail['trend'] }) {
  if (trend === 'improving')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
        <ArrowUp size={12} /> Yaxshilanmoqda
      </span>
    )
  if (trend === 'declining')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
        <ArrowDown size={12} /> Pasaymoqda
      </span>
    )
  if (trend === 'stable')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
        <Minus size={12} /> Barqaror
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
      Ma'lumot yetarli emas
    </span>
  )
}

function ProgressChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0)
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        Hozircha sessiya yo‘q
      </div>
    )
  const W = 600
  const H = 160
  const PAD_X = 32
  const PAD_Y = 16
  const minBand = 0
  const maxBand = 9
  const xs = data.map((_, i) =>
    PAD_X + (i * (W - 2 * PAD_X)) / Math.max(1, data.length - 1),
  )
  const ys = data.map((p) => {
    const v = p.avg ?? 0
    return H - PAD_Y - ((v - minBand) * (H - 2 * PAD_Y)) / (maxBand - minBand)
  })
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* y grid */}
      {[3, 5, 7, 9].map((v) => {
        const y = H - PAD_Y - ((v - minBand) * (H - 2 * PAD_Y)) / (maxBand - minBand)
        return (
          <g key={v}>
            <line
              x1={PAD_X}
              x2={W - PAD_X / 2}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
            <text x={4} y={y + 4} fontSize={10} fill="#94a3b8">
              {v}
            </text>
          </g>
        )
      })}
      <polyline
        points={points}
        fill="none"
        stroke="#dc2626"
        strokeWidth={2.5}
      />
      {data.map((p, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r={4} fill="#dc2626" />
          <text
            x={xs[i]}
            y={ys[i] - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight="600"
            fill="#0f172a"
          >
            {p.avg != null ? p.avg.toFixed(1) : '—'}
          </text>
          <text
            x={xs[i]}
            y={H - 2}
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            {p.date ? new Date(p.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' }) : ''}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function GroupDetailPage() {
  const { slug, groupId } = useParams<{ slug: string; groupId: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    if (!slug || !groupId) return
    setLoading(true)
    api
      .get<GroupDetail>(`/center/${slug}/groups/${groupId}/`)
      .then((r) => setGroup(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [slug, groupId])

  const removeStudent = async (id: number) => {
    if (!slug || !groupId) return
    if (!window.confirm('Talabani guruhdan chiqarmoqchimisiz?')) return
    await api.post(`/center/${slug}/groups/${groupId}/remove-student/${id}/`)
    toast.success('Guruhdan chiqarildi')
    load()
  }

  const removeGroup = async () => {
    if (!slug || !groupId) return
    if (!window.confirm("Guruhni o'chirmoqchimisiz? Talabalar guruhsiz qoladi.")) return
    await api.delete(`/center/${slug}/groups/${groupId}/`)
    toast.success("Guruh o'chirildi")
    navigate(`/${slug}/admin/groups`)
  }

  if (loading) {
    return (
      <PageShell>
        <StateCard Icon={Loader2} title="Yuklanmoqda…" />
      </PageShell>
    )
  }
  if (!group) {
    return (
      <PageShell>
        <StateCard Icon={X} title="Guruh topilmadi" />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Link
        to={`/${slug}/admin/groups`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
      >
        <ArrowLeft size={14} /> Guruhlar
      </Link>

      <PageHeader
        title={group.name}
        subtitle={
          group.teacher
            ? `O‘qituvchi: ${group.teacher.full_name}`
            : 'O‘qituvchi tayinlanmagan'
        }
        actions={
          <>
            <button
              type="button"
              onClick={removeGroup}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={14} /> O‘chirish
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className={btnPrimary}
            >
              <UserPlus size={16} /> Talaba qo‘shish
            </button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Talabalar" value={String(group.student_count)} />
        <StatTile
          label="O‘rtacha"
          value={group.avg_score != null ? group.avg_score.toFixed(1) : '—'}
          tone="emerald"
        />
        <StatTile
          label="So‘nggi test"
          value={group.latest_avg != null ? group.latest_avg.toFixed(1) : '—'}
          tone="red"
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Trend</div>
          <div className="mt-2">
            <TrendBadge trend={group.trend} />
          </div>
        </div>
      </div>

      {/* Group meta + chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SurfaceCard className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Progress (so‘nggi 5 test)</h3>
            {group.target_band_score && (
              <Chip tone="amber">Maqsad {group.target_band_score}</Chip>
            )}
          </div>
          <ProgressChart data={group.progress_chart} />
        </SurfaceCard>

        <SurfaceCard>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Ma‘lumot</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Dars jadvali" value={group.class_schedule || '—'} />
            <Row label="Boshlanish" value={group.start_date || '—'} />
            <Row label="Tugash" value={group.end_date || '—'} />
            <Row
              label="Holat"
              value={group.is_active ? 'Faol' : 'Faol emas'}
            />
          </dl>
          {group.description && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {group.description}
            </p>
          )}
        </SurfaceCard>
      </div>

      {/* Members table */}
      <SurfaceCard>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            Talabalar ({group.members.length})
          </h3>
        </div>
        {group.members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Guruhda talaba yo‘q
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Talaba</th>
                  <th className="px-3 py-2 text-center">Testlar</th>
                  <th className="px-3 py-2 text-center">O‘rtacha</th>
                  <th className="px-3 py-2 text-center">So‘nggi</th>
                  <th className="px-3 py-2 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-700">
                          {(m.first_name || m.username)[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">
                            {m.full_name}
                          </div>
                          <div className="text-xs text-slate-500">@{m.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">{m.test_count}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-emerald-700">
                      {m.avg_band != null ? m.avg_band.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-red-700">
                      {m.latest_band != null ? m.latest_band.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeStudent(m.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        <X size={12} /> Chiqarish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {showAdd && (
        <AddStudentsDialog
          slug={slug!}
          groupId={groupId!}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false)
            load()
          }}
        />
      )}
    </PageShell>
  )
}

function StatTile({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: string
  tone?: 'slate' | 'emerald' | 'red'
}) {
  const tones: Record<typeof tone, string> = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}

// ---------- Add students dialog ----------

type AvailStudent = {
  id: number
  username: string
  full_name: string
  first_name: string
  last_name: string
}

function AddStudentsDialog({
  slug,
  groupId,
  onClose,
  onAdded,
}: {
  slug: string
  groupId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [list, setList] = useState<AvailStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get<AvailStudent[]>(`/center/${slug}/groups/${groupId}/available-students/`)
      .then((r) => setList(r.data))
      .finally(() => setLoading(false))
  }, [slug, groupId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) =>
      `${s.full_name} ${s.username}`.toLowerCase().includes(q),
    )
  }, [list, search])

  const toggle = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const onSave = async () => {
    if (selected.size === 0) {
      toast.error('Hech narsa tanlanmadi')
      return
    }
    setSaving(true)
    try {
      await api.post(
        `/center/${slug}/groups/${groupId}/add-students/`,
        { student_ids: Array.from(selected) },
      )
      toast.success(`${selected.size} ta talaba qo‘shildi`)
      onAdded()
    } catch {
      toast.error('Xatolik')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-base font-semibold">Talabalarni qo‘shish</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="border-b px-5 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism yoki username…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Faqat hech qaysi guruhga biriktirilmagan talabalar ko‘rinadi.
          </p>
        </div>
        <div className="min-h-[200px] flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              <Loader2 size={16} className="mx-auto animate-spin" />
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Mos talaba topilmadi
            </p>
          ) : (
            filtered.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {s.full_name}
                  </div>
                  <div className="text-xs text-slate-500">@{s.username}</div>
                </div>
              </label>
            ))
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t bg-slate-50 px-5 py-3">
          <span className="text-xs text-slate-600">
            Tanlandi: <strong>{selected.size}</strong>
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className={btnOutline}>
              Bekor
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className={btnPrimary}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saqlanmoqda…
                </>
              ) : (
                <>
                  <Plus size={14} /> Qo‘shish
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
