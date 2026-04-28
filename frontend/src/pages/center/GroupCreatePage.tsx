import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  PageHeader,
  PageShell,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Teacher = {
  id: number
  username: string
  first_name: string
  last_name: string
}

export default function GroupCreatePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [teacherId, setTeacherId] = useState<string>('')
  const [target, setTarget] = useState<string>('')
  const [schedule, setSchedule] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = 'ILDIZmock — Yangi guruh'
    if (!slug) return
    api.get<Teacher[]>(`/center/${slug}/teachers/`).then((r) => setTeachers(r.data))
  }, [slug])

  const onSave = async () => {
    if (!name.trim()) {
      toast.error('Guruh nomini kiriting')
      return
    }
    setSaving(true)
    try {
      const res = await api.post<{ id: number }>(`/center/${slug}/groups/`, {
        name: name.trim(),
        description: description.trim(),
        teacher_id: teacherId ? Number(teacherId) : null,
        target_band_score: target || null,
        class_schedule: schedule.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
      })
      toast.success('Guruh yaratildi')
      navigate(`/${slug}/admin/groups/${res.data.id}`)
    } catch (err) {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      toast.error('Xatolik: ' + JSON.stringify(data).slice(0, 200))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell maxWidth="max-w-3xl">
      <Link
        to={`/${slug}/admin/groups`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
      >
        <ArrowLeft size={14} /> Guruhlar
      </Link>

      <PageHeader
        title="Yangi guruh"
        subtitle="Talabalar guruhini yarating va o‘qituvchini biriktiring"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate(`/${slug}/admin/groups`)}
              className={btnOutline}
            >
              Bekor
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={btnPrimary}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saqlanmoqda…
                </>
              ) : (
                <>Saqlash</>
              )}
            </button>
          </>
        }
      />

      <SurfaceCard>
        <div className="space-y-4">
          <Field label="Guruh nomi *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: IELTS 7.0 — Group A"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </Field>

          <Field label="Tavsif (ixtiyoriy)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mas’ul o‘qituvchi">
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">— tanlanmagan —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name} ({t.username})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Maqsad band score">
              <input
                type="number"
                step="0.5"
                min="0"
                max="9"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="7.0"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </Field>
          </div>

          <Field label="Dars jadvali">
            <input
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Du, Chor, Ju · 18:00–20:00"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Boshlanish sanasi">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </Field>
            <Field label="Tugash sanasi">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </Field>
          </div>
        </div>
      </SurfaceCard>
    </PageShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}
