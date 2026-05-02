import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StateCard,
  SurfaceCard,
  btnOutline,
  btnPrimary,
} from '@/components/admin-shell'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Schedule = {
  id: number
  group: number
  day_of_week: number
  day_name: string
  start_time: string
  end_time: string
  duration_minutes: number
  room: string
  is_active: boolean
}

const DAYS = [
  { v: 0, label: 'Dushanba' },
  { v: 1, label: 'Seshanba' },
  { v: 2, label: 'Chorshanba' },
  { v: 3, label: 'Payshanba' },
  { v: 4, label: 'Juma' },
  { v: 5, label: 'Shanba' },
  { v: 6, label: 'Yakshanba' },
]

export default function GroupSchedulePage() {
  const { slug, groupId } = useParams<{ slug: string; groupId: string }>()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const groupQ = useQuery({
    queryKey: ['group-detail', slug, groupId],
    queryFn: async () =>
      (await api.get<{ id: number; name: string }>(`/center/${slug}/groups/${groupId}/`)).data,
  })

  const schedQ = useQuery({
    queryKey: ['group-schedules', slug, groupId],
    queryFn: async () =>
      (await api.get<Schedule[]>(`/center/${slug}/groups/${groupId}/schedules/`)).data,
  })

  const [form, setForm] = useState({
    day_of_week: 0,
    start_time: '18:00',
    end_time: '20:00',
    room: '',
  })

  const createMut = useMutation({
    mutationFn: async () =>
      api.post(`/center/${slug}/groups/${groupId}/schedules/`, form),
    onSuccess: () => {
      toast.success('Jadval qo\'shildi')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['group-schedules', slug, groupId] })
    },
    onError: (e) => {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      toast.error(msg || 'Qo\'shib bo\'lmadi')
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) =>
      api.delete(`/center/${slug}/groups/${groupId}/schedules/${id}/`),
    onSuccess: () => {
      toast.success('O\'chirildi')
      qc.invalidateQueries({ queryKey: ['group-schedules', slug, groupId] })
    },
  })

  const schedules = schedQ.data ?? []
  const groupName = groupQ.data?.name ?? 'Guruh'

  return (
    <PageShell>
      <PageHeader
        title={`${groupName} — Dars jadvali`}
        subtitle="Haftalik dars kunlari va vaqtlari. Generate Sessions buyrug'i shu jadval asosida sessiya yaratadi."
        actions={
          <>
            <Link to={`/${slug}/admin/groups/${groupId}`} className={btnOutline}>
              <ArrowLeft size={16} /> Guruh
            </Link>
            <button className={btnPrimary} onClick={() => setOpen(true)}>
              <Plus size={16} /> Jadval qo'shish
            </button>
          </>
        }
      />

      {schedQ.isLoading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
        </div>
      ) : schedules.length === 0 ? (
        <StateCard
          Icon={CalendarDays}
          title="Hali jadval yo'q"
          description="Birinchi dars kunini qo'shing — masalan Dushanba 18:00–20:00"
          action={
            <button className={btnPrimary} onClick={() => setOpen(true)}>
              <Plus size={16} /> Jadval qo'shish
            </button>
          }
        />
      ) : (
        <SurfaceCard padding="p-0">
          <div className="divide-y divide-slate-100">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700">
                  <CalendarDays size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{s.day_name}</p>
                  <p className="text-sm text-slate-500">
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} ·{' '}
                    {s.duration_minutes} min
                    {s.room && ` · ${s.room}`}
                  </p>
                </div>
                <Chip tone={s.is_active ? 'emerald' : 'slate'}>
                  {s.is_active ? 'Faol' : 'Nofaol'}
                </Chip>
                <button
                  onClick={() => {
                    if (confirm("O'chirilsinmi?")) deleteMut.mutate(s.id)
                  }}
                  className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi dars vaqti</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Hafta kuni</Label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.day_of_week}
                onChange={(e) =>
                  setForm((p) => ({ ...p, day_of_week: Number(e.target.value) }))
                }
              >
                {DAYS.map((d) => (
                  <option key={d.v} value={d.v}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Boshlanish</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                />
              </div>
              <div>
                <Label>Tugash</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Xona (ixtiyoriy)</Label>
              <Input
                value={form.room}
                onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))}
                placeholder="Room 301 / Online"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
            <button
              className={btnPrimary}
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
