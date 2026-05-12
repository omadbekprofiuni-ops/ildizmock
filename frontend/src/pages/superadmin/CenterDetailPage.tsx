import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowLeft, ImagePlus, KeyRound, Loader2, Pause, Play,
  Plus, Trash2, UploadCloud, UserCog,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

import SuperAdminLayout from './SuperAdminLayout'

type Org = {
  id: number
  name: string
  slug: string
  primary_color: string
  logo: string | null
  status: string
  contact_phone: string
  contact_email: string
  address: string
  notes: string
  students_count: number
  teachers_count: number
  admins_count: number
  plan_name: string
  days_remaining: number
  // ETAP 19 — operatsion holat
  is_suspended: boolean
  is_deleted: boolean
  operational_status: 'active' | 'suspended' | 'deleted' | 'blocked'
  suspended_reason: string | null
  suspended_at: string | null
}

type Trend = {
  months: string[]
  new_students: number[]
  attempts: number[]
}

type Admin = {
  id: number
  username: string
  first_name: string
  last_name: string
  is_active: boolean
  last_login: string | null
}

function generatePassword(): string {
  const words = ['edu', 'mock', 'test', 'study', 'learn']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${word}${num}`
}

function getError(err: unknown): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return ''
  if (typeof data === 'string') return data
  return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' · ')
}

export default function CenterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<Admin | null>(null)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)

  const orgQ = useQuery({
    queryKey: ['super-org', id],
    queryFn: async () => (await api.get<Org>(`/super/organizations/${id}/`)).data,
    enabled: !!id,
  })

  const adminsQ = useQuery({
    queryKey: ['super-org', id, 'admins'],
    queryFn: async () => (await api.get<Admin[]>(`/super/organizations/${id}/admins/`)).data,
    enabled: !!id,
  })

  const trendQ = useQuery({
    queryKey: ['super-org', id, 'trend'],
    queryFn: async () => (await api.get<Trend>(`/super/organizations/${id}/trend/`)).data,
    enabled: !!id,
  })

  const invalidateOrg = () => {
    qc.invalidateQueries({ queryKey: ['super-org', id] })
    qc.invalidateQueries({ queryKey: ['super-orgs'] })
    qc.invalidateQueries({ queryKey: ['super-orgs-summary'] })
  }

  const activateM = useMutation({
    mutationFn: async () =>
      (await api.post(`/super/organizations/${id}/activate/`, {})).data,
    onSuccess: () => {
      toast.success('Markaz faollashtirildi')
      invalidateOrg()
    },
    onError: (e) => toast.error(getError(e) || 'Faollashtirib bo‘lmadi'),
  })

  const restoreM = useMutation({
    mutationFn: async () =>
      (await api.post(`/super/organizations/${id}/restore/`, {})).data,
    onSuccess: () => {
      toast.success('Markaz arxivdan qaytarildi')
      invalidateOrg()
    },
    onError: (e) => toast.error(getError(e) || 'Qaytarib bo‘lmadi'),
  })

  if (orgQ.isLoading) {
    return (
      <SuperAdminLayout>
        <div className="p-8 text-sm text-slate-500">Loading…</div>
      </SuperAdminLayout>
    )
  }
  if (orgQ.isError || !orgQ.data) {
    return (
      <SuperAdminLayout>
        <div className="p-8 text-sm text-cta-600">Center not found.</div>
      </SuperAdminLayout>
    )
  }

  const org = orgQ.data

  return (
    <SuperAdminLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-10">
        <div>
          <Link
            to="/super/organizations"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
          >
            <ArrowLeft size={14} /> Back to centers
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-12 w-12 shrink-0 rounded-2xl"
                style={{ background: org.primary_color }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    {org.name}
                  </h1>
                  <StatusPill org={org} />
                </div>
                <p className="font-mono text-xs text-slate-500">/{org.slug}</p>
              </div>
            </div>
            <a href={`/${org.slug}`} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-200"
              >
                Saytni ochish ↗
              </Button>
            </a>
          </div>

          {/* ETAP 19 — suspended banner */}
          {org.is_suspended && !org.is_deleted && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Markaz to‘xtatilgan</p>
                {org.suspended_reason && (
                  <p className="mt-1 text-amber-800">Sabab: {org.suspended_reason}</p>
                )}
                {org.suspended_at && (
                  <p className="mt-1 text-xs text-amber-700">
                    Sana: {new Date(org.suspended_at).toLocaleString('en-GB')}
                  </p>
                )}
              </div>
            </div>
          )}
          {org.is_deleted && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm">
              <Trash2 size={18} className="mt-0.5 shrink-0 text-slate-600" />
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Markaz arxivda</p>
                <p className="mt-1 text-slate-700">
                  Saytga kirib bo‘lmaydi, lekin ma‘lumotlar saqlangan. Qayta tiklash mumkin.
                </p>
              </div>
              <Button
                size="sm" variant="outline"
                onClick={() => restoreM.mutate()}
                disabled={restoreM.isPending}
              >
                {restoreM.isPending ? 'Qaytarilmoqda…' : 'Arxivdan qaytarish'}
              </Button>
            </div>
          )}

          {/* ETAP 19 — action tugmalari */}
          {!org.is_deleted && (
            <div className="mt-4 flex flex-wrap gap-2">
              {org.is_suspended ? (
                <Button
                  size="sm"
                  onClick={() => activateM.mutate()}
                  disabled={activateM.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Play size={14} className="mr-1.5" />
                  {activateM.isPending ? 'Faollashtirilmoqda…' : 'Faollashtirish'}
                </Button>
              ) : (
                <Button
                  size="sm" variant="outline"
                  onClick={() => setSuspendOpen(true)}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Pause size={14} className="mr-1.5" /> To‘xtatish
                </Button>
              )}
              <Button
                size="sm" variant="outline"
                onClick={() => setReassignOpen(true)}
              >
                <UserCog size={14} className="mr-1.5" /> Admin tayinlash
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="border-cta-300 text-cta-700 hover:bg-cta-50"
              >
                <Trash2 size={14} className="mr-1.5" /> Arxivga
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Talabalar" value={org.students_count} />
          <StatCard label="O‘qituvchilar" value={org.teachers_count} />
          <StatCard label="Adminlar" value={org.admins_count} />
          <StatCard label="Tarif" value={org.plan_name} subtitle={`${org.days_remaining} kun qoldi`} />
        </div>

        {/* ETAP 19 — 6 oylik trend chart */}
        {trendQ.data && (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-1 text-lg font-semibold">Faollik trendi</h2>
              <p className="mb-4 text-xs text-slate-500">
                Oxirgi 6 oy: yangi talabalar va testdagi urinishlar
              </p>
              <CenterTrendChart data={trendQ.data} />
            </CardContent>
          </Card>
        )}

        <LogoDropzone
          orgId={org.id}
          logo={org.logo}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['super-org', id] })}
        />

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Admins</h2>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add admin
              </Button>
            </div>
            {adminsQ.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
            {adminsQ.data && adminsQ.data.length === 0 && (
              <p className="text-sm text-slate-500">No admins yet.</p>
            )}
            <div className="space-y-2">
              {adminsQ.data?.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">
                      {a.first_name} {a.last_name}
                    </div>
                    <div className="font-mono text-xs text-slate-500">{a.username}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.last_login && (
                      <span className="text-xs text-slate-400">
                        last login {new Date(a.last_login).toLocaleDateString()}
                      </span>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => setResetTarget(a)}
                    >
                      <KeyRound className="mr-1 h-3 w-3" /> Reset password
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-sm">
            <h2 className="mb-3 text-lg font-semibold">Contact</h2>
            <Field label="Phone" value={org.contact_phone || '—'} />
            <Field label="Email" value={org.contact_email || '—'} />
            <Field label="Address" value={org.address || '—'} />
            <Field label="Notes" value={org.notes || '—'} />
          </CardContent>
        </Card>
      </div>

      <AddAdminDialog
        orgId={org.id}
        orgName={org.name}
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ['super-org', id, 'admins'] })}
      />
      <ResetPasswordDialog
        orgId={org.id}
        admin={resetTarget}
        onClose={() => setResetTarget(null)}
      />
      <SuspendDialog
        orgId={org.id} orgName={org.name}
        open={suspendOpen} onOpenChange={setSuspendOpen}
        onDone={invalidateOrg}
      />
      <SoftDeleteDialog
        orgId={org.id} orgName={org.name}
        open={deleteOpen} onOpenChange={setDeleteOpen}
        onDone={invalidateOrg}
      />
      <ReassignAdminDialog
        orgId={org.id} orgName={org.name}
        open={reassignOpen} onOpenChange={setReassignOpen}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['super-org', id, 'admins'] })
          invalidateOrg()
        }}
      />
    </SuperAdminLayout>
  )
}

function StatusPill({ org }: { org: Org }) {
  if (org.is_deleted) {
    return <Pill bg="bg-slate-200" text="text-slate-700">Arxiv</Pill>
  }
  if (org.is_suspended) {
    return <Pill bg="bg-amber-100" text="text-amber-800">To‘xtatilgan</Pill>
  }
  if (org.status === 'blocked') {
    return <Pill bg="bg-rose-100" text="text-rose-800">Bloklangan</Pill>
  }
  if (org.status === 'trial') {
    return <Pill bg="bg-amber-100" text="text-amber-700">Trial</Pill>
  }
  return <Pill bg="bg-emerald-100" text="text-emerald-800">Faol</Pill>
}

function Pill({ children, bg, text }: { children: React.ReactNode; bg: string; text: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${bg} ${text}`}>
      {children}
    </span>
  )
}

function CenterTrendChart({ data }: { data: Trend }) {
  if (data.months.length === 0) {
    return <p className="text-sm text-slate-500">Ma‘lumot yo‘q</p>
  }
  const W = 800
  const H = 220
  const PAD_X = 40
  const PAD_Y = 20
  const n = data.months.length
  const xFor = (i: number) => (n === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (n - 1))
  const maxValue = Math.max(1, ...data.new_students, ...data.attempts)
  const yFor = (v: number) => H - PAD_Y - (v / maxValue) * (H - 2 * PAD_Y)

  const studentsPath = data.new_students
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(' ')
  const attemptsPath = data.attempts
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(' ')

  const gridSteps = 4
  const gridValues = Array.from({ length: gridSteps + 1 }, (_, k) =>
    Math.round((maxValue * k) / gridSteps),
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-brand-600" />
          Yangi talabalar
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-cta-500" />
          Test urinishlari
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full min-w-[480px]">
          {gridValues.map((v, k) => (
            <g key={k}>
              <line
                x1={PAD_X}
                x2={W - PAD_X}
                y1={yFor(v)}
                y2={yFor(v)}
                stroke="#e2e8f0"
                strokeDasharray={k === 0 ? '0' : '3 3'}
                strokeWidth={1}
              />
              <text x={PAD_X - 6} y={yFor(v) + 3} fontSize="10" fill="#94a3b8" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {studentsPath && (
            <path d={studentsPath} fill="none" stroke="#0e3a8a" strokeWidth={2} />
          )}
          {attemptsPath && (
            <path d={attemptsPath} fill="none" stroke="#ef4444" strokeWidth={2.5} />
          )}
          {data.months.map((m, i) => (
            <text key={i} x={xFor(i)} y={H - 4} fontSize="10" fill="#64748b" textAnchor="middle">
              {m.slice(5)}/{m.slice(2, 4)}
            </text>
          ))}
          {data.new_students.map((v, i) => (
            <circle key={`ns-${i}`} cx={xFor(i)} cy={yFor(v)} r={3} fill="#0e3a8a" />
          ))}
          {data.attempts.map((v, i) => (
            <circle key={`at-${i}`} cx={xFor(i)} cy={yFor(v)} r={3} fill="#ef4444" />
          ))}
        </svg>
      </div>
    </div>
  )
}

function SuspendDialog({
  orgId, orgName, open, onOpenChange, onDone,
}: {
  orgId: number; orgName: string
  open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: async () =>
      (await api.post(`/super/organizations/${orgId}/suspend/`, { reason })).data,
    onSuccess: () => {
      toast.success(`${orgName} to‘xtatildi`)
      onDone()
      onOpenChange(false)
      setReason('')
    },
    onError: (e) => toast.error(getError(e) || 'To‘xtatib bo‘lmadi'),
  })
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setReason('') }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Markazni to‘xtatish</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            <b>{orgName}</b> vaqtinchalik bloklanadi. Talabalar saytga kira olmaydi.
            Keyinroq qaytadan faollashtirish mumkin.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Sabab (majburiy)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Misol: To‘lov muddati o‘tdi, qarz 200$"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || !reason.trim()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {m.isPending ? 'To‘xtatilmoqda…' : 'To‘xtatish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SoftDeleteDialog({
  orgId, orgName, open, onOpenChange, onDone,
}: {
  orgId: number; orgName: string
  open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void
}) {
  const [confirm, setConfirm] = useState('')
  const m = useMutation({
    mutationFn: async () =>
      (await api.post(`/super/organizations/${orgId}/soft-delete/`, {
        confirm_text: confirm,
      })).data,
    onSuccess: () => {
      toast.success(`${orgName} arxivga olindi`)
      onDone()
      onOpenChange(false)
      setConfirm('')
    },
    onError: (e) => toast.error(getError(e) || 'O‘chirib bo‘lmadi'),
  })
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setConfirm('') }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Markazni arxivga olish</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-cta-200 bg-cta-50 p-3 text-cta-800">
            <p className="font-semibold">Diqqat! Markaz ko‘rinmas bo‘ladi</p>
            <p className="mt-1 text-xs">
              Saytga kirib bo‘lmaydi, lekin barcha ma‘lumotlar (talabalar, testlar, attempt'lar)
              saqlanadi. Keyinroq qaytarish mumkin.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Tasdiqlash uchun markaz nomini aniq tering: <span className="font-bold">{orgName}</span>
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={orgName}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || confirm !== orgName}
            className="bg-cta-600 hover:bg-cta-700"
          >
            {m.isPending ? 'Arxivga olinmoqda…' : 'Arxivga olish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReassignAdminDialog({
  orgId, orgName, open, onOpenChange, onDone,
}: {
  orgId: number; orgName: string
  open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void
}) {
  const [username, setUsername] = useState('')
  const m = useMutation({
    mutationFn: async () =>
      (await api.post(`/super/organizations/${orgId}/reassign-admin/`, {
        username,
      })).data,
    onSuccess: (data) => {
      toast.success(data.message || 'Admin tayinlandi')
      onDone()
      onOpenChange(false)
      setUsername('')
    },
    onError: (e) => toast.error(getError(e) || 'Tayinlab bo‘lmadi'),
  })
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setUsername('') }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi admin tayinlash</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            Mavjud foydalanuvchining username'ini kiriting. U <b>{orgName}</b> markazining
            yangi admini bo‘ladi. Eski adminlar saqlanadi.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="masalan: yangi_admin"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || !username.trim()}
          >
            {m.isPending ? 'Tayinlanmoqda…' : 'Tayinlash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatCard({ label, value, subtitle }: { label: string; value: number | string; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
        {subtitle && <div className="mt-1 text-xs text-slate-400">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function AddAdminDialog({
  orgId, orgName, open, onOpenChange, onCreated,
}: {
  orgId: number; orgName: string
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void
}) {
  const initial = {
    username: '', password: generatePassword(),
    first_name: '', last_name: '',
  }
  const [form, setForm] = useState(initial)
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null)

  const m = useMutation({
    mutationFn: async () =>
      (await api.post(`/super/organizations/${orgId}/add_admin/`, form)).data,
    onSuccess: () => {
      setCreated({ username: form.username, password: form.password })
      onCreated()
    },
    onError: (err) => {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg = data ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Failed'
      toast.error(msg)
    },
  })

  const close = (o: boolean) => {
    if (!o) {
      setCreated(null)
      setForm({ ...initial, password: generatePassword() })
    }
    onOpenChange(o)
  }

  if (created) {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Admin added to {orgName}</DialogTitle>
          </DialogHeader>
          <div className="my-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-2 text-sm text-emerald-800">Save these credentials.</p>
            <div className="space-y-1 rounded bg-white p-3 font-mono text-sm">
              <div><strong>Username:</strong> {created.username}</div>
              <div><strong>Password:</strong> {created.password}</div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => close(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add admin to {orgName}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">First name</Label>
            <Input value={form.first_name}
                   onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Last name</Label>
            <Input value={form.last_name}
                   onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input value={form.username}
                   onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Password</Label>
            <div className="flex gap-2">
              <Input value={form.password}
                     onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Button type="button" variant="outline" size="sm"
                      onClick={() => setForm({ ...form, password: generatePassword() })}>
                Gen
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.username || !form.first_name}>
            {m.isPending ? 'Adding…' : 'Add admin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  orgId, admin, onClose,
}: {
  orgId: number; admin: Admin | null; onClose: () => void
}) {
  const [pwd, setPwd] = useState(generatePassword())

  const m = useMutation({
    mutationFn: async () =>
      (await api.post(`/super/organizations/${orgId}/reset_admin_password/`, {
        admin_id: admin?.id, new_password: pwd,
      })).data,
    onSuccess: () => {
      toast.success(`Password reset for ${admin?.username}. New: ${pwd}`)
      onClose()
      setPwd(generatePassword())
    },
    onError: (err) => {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg = data ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Failed'
      toast.error(msg)
    },
  })

  return (
    <Dialog open={!!admin} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password for {admin?.username}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label className="text-xs">New password</Label>
          <div className="flex gap-2">
            <Input value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <Button type="button" variant="outline" size="sm"
                    onClick={() => setPwd(generatePassword())}>
              Generate
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || pwd.length < 4}>
            {m.isPending ? 'Resetting…' : 'Reset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LogoDropzone({
  orgId,
  logo,
  onUpdated,
}: {
  orgId: number
  logo: string | null
  onUpdated: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayllari (PNG, JPG, SVG)')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      await api.post(`/super/organizations/${orgId}/logo/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Logo uploaded')
      onUpdated()
    } catch {
      toast.error('Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Logoni o‘chirmoqchimisiz?')) return
    setBusy(true)
    try {
      await api.delete(`/super/organizations/${orgId}/logo/`)
      toast.success('Logo o‘chirildi')
      onUpdated()
    } catch {
      toast.error('Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ImagePlus size={18} className="text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900">Center logo</h2>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />

      {logo ? (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <img
            src={logo}
            alt="Logo"
            className="h-20 w-20 rounded-xl border bg-white object-contain p-2"
          />
          <div className="flex-1 text-sm">
            <p className="font-medium text-slate-900">Joriy logo</p>
            <p className="text-xs text-slate-500">
              Drag a new one below or click “Replace”.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <UploadCloud size={14} className="mr-1 inline" /> Replace
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-xl border border-cta-100 bg-cta-50 px-3 py-2 text-sm font-medium text-cta-700 hover:bg-cta-100"
            >
              <Trash2 size={14} className="mr-1 inline" /> Delete
            </button>
          </div>
        </div>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
        }`}
      >
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ${
            dragging ? 'text-brand-600' : 'text-slate-400'
          }`}
        >
          {busy ? <Loader2 size={26} className="animate-spin" /> : <UploadCloud size={26} />}
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">
          Drop the file here or <span className="text-brand-600 underline">choose</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">PNG, JPG, SVG (transparent background recommended)</p>
      </div>
    </div>
  )
}
