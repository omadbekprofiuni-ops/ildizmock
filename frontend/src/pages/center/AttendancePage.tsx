import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StateCard,
  StatCard,
  TableCard,
  adminTable,
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

type Session = {
  id: number
  group: number
  group_name: string
  date: string
  start_time: string | null
  end_time: string | null
  is_finalized: boolean
  attendance_rate: number
  present_count: number
  absent_count: number
  total_count: number
}

type GroupOption = { id: number; name: string }

export default function AttendancePage() {
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const sessionsQ = useQuery({
    queryKey: ['attendance-sessions', slug],
    queryFn: async () =>
      (await api.get<Session[]>(`/center/${slug}/attendance/sessions/`)).data,
  })

  const groupsQ = useQuery({
    queryKey: ['attendance-groups-options', slug],
    queryFn: async () =>
      (await api.get<GroupOption[]>(`/center/${slug}/groups/`)).data,
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    group: '',
    date: todayStr,
    start_time: '',
    end_time: '',
    notes: '',
  })

  const createMut = useMutation({
    mutationFn: async () =>
      (await api.post(`/center/${slug}/attendance/sessions/`, {
        group: Number(form.group),
        date: form.date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        notes: form.notes,
      })).data,
    onSuccess: () => {
      toast.success('Sessiya yaratildi')
      setCreateOpen(false)
      setForm({ group: '', date: todayStr, start_time: '', end_time: '', notes: '' })
      qc.invalidateQueries({ queryKey: ['attendance-sessions', slug] })
    },
    onError: (e) => {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      toast.error(msg || 'Sessiya yaratib bo\'lmadi')
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) =>
      api.delete(`/center/${slug}/attendance/sessions/${id}/`),
    onSuccess: () => {
      toast.success('O\'chirildi')
      qc.invalidateQueries({ queryKey: ['attendance-sessions', slug] })
    },
    onError: (e) => {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      toast.error(msg || 'O\'chirib bo\'lmadi')
    },
  })

  const sessions = sessionsQ.data ?? []
  const groups = groupsQ.data ?? []

  const today = sessions.filter((s) => s.date === todayStr)
  const upcoming = sessions.filter((s) => s.date > todayStr)
  const past = sessions.filter((s) => s.date < todayStr).slice(0, 20)

  const totalToday = today.reduce((sum, s) => sum + s.total_count, 0)
  const presentToday = today.reduce((sum, s) => sum + s.present_count, 0)
  const todayRate = totalToday ? Math.round((presentToday / totalToday) * 1000) / 10 : 0

  return (
    <PageShell>
      <PageHeader
        title="Davomat"
        subtitle="Guruh dars sessiyalarini yarating va talabalar davomatini belgilang"
        actions={
          <button className={btnPrimary} onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Yangi sessiya
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Bugungi sessiyalar"
          value={today.length}
          hint={`${presentToday}/${totalToday} keldi`}
          Icon={CalendarCheck}
          tone="emerald"
        />
        <StatCard
          label="Bugungi davomat"
          value={`${todayRate}%`}
          hint="Bugun keldi/jami"
          Icon={Users}
          tone="blue"
        />
        <StatCard
          label="Yaqinda"
          value={upcoming.length}
          hint={`Kelajak ${upcoming.length} ta sessiya rejada`}
          Icon={CalendarPlus}
          tone="amber"
        />
      </div>

      {sessionsQ.isLoading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
        </div>
      ) : sessions.length === 0 ? (
        <StateCard
          Icon={ClipboardList}
          title="Hali sessiya yo'q"
          description="Birinchi davomat sessiyasini yarating"
          action={
            <button className={btnPrimary} onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Yangi sessiya
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {today.length > 0 && (
            <SessionTable
              title="Bugun"
              rows={today}
              slug={slug!}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          )}
          {upcoming.length > 0 && (
            <SessionTable
              title="Yaqinda"
              rows={upcoming}
              slug={slug!}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          )}
          {past.length > 0 && (
            <SessionTable
              title="So'nggi sessiyalar"
              rows={past}
              slug={slug!}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi davomat sessiyasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Guruh</Label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.group}
                onChange={(e) => setForm((p) => ({ ...p, group: e.target.value }))}
              >
                <option value="">— tanlang —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Sana</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
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
              <Label>Izoh (ixtiyoriy)</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Dars mavzusi yoki maxsus eslatma"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Bekor
            </Button>
            <button
              className={btnPrimary}
              onClick={() => createMut.mutate()}
              disabled={!form.group || !form.date || createMut.isPending}
            >
              {createMut.isPending ? 'Yaratilmoqda…' : 'Yaratish'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

function SessionTable({
  title,
  rows,
  slug,
  onDelete,
}: {
  title: string
  rows: Session[]
  slug: string
  onDelete: (id: number) => void
}) {
  return (
    <TableCard title={`${title} (${rows.length})`}>
      <table className={adminTable.table}>
        <thead className={adminTable.thead}>
          <tr>
            <th className={adminTable.th}>Sana</th>
            <th className={adminTable.th}>Guruh</th>
            <th className={adminTable.th}>Vaqt</th>
            <th className={adminTable.th}>Holat</th>
            <th className={adminTable.th}>Davomat</th>
            <th className={adminTable.th}></th>
          </tr>
        </thead>
        <tbody className={adminTable.tbody}>
          {rows.map((s) => (
            <tr key={s.id} className={adminTable.trHover}>
              <td className={adminTable.td}>
                <Link
                  to={`/${slug}/admin/attendance/${s.id}`}
                  className="font-medium text-slate-900 hover:text-red-700"
                >
                  {new Date(s.date).toLocaleDateString('uz-UZ')}
                </Link>
              </td>
              <td className={adminTable.td}>{s.group_name}</td>
              <td className={adminTable.td}>
                {s.start_time && s.end_time
                  ? `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`
                  : '—'}
              </td>
              <td className={adminTable.td}>
                {s.is_finalized ? (
                  <Chip tone="emerald">Yakunlangan</Chip>
                ) : (
                  <Chip tone="amber">Ochiq</Chip>
                )}
              </td>
              <td className={adminTable.td}>
                <span className="font-semibold text-slate-900">{s.attendance_rate}%</span>
                <span className="ml-2 text-xs text-slate-500">
                  ({s.present_count}/{s.total_count})
                </span>
              </td>
              <td className={adminTable.td}>
                <div className="flex items-center justify-end gap-2">
                  <Link
                    to={`/${slug}/admin/attendance/${s.id}`}
                    className={btnOutline + ' !py-1.5 !px-3'}
                  >
                    Ochish
                  </Link>
                  {!s.is_finalized && (
                    <button
                      onClick={() => {
                        if (confirm("Bu sessiyani o'chirasizmi?")) onDelete(s.id)
                      }}
                      className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="O'chirish"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  )
}
