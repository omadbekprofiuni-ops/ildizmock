import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, KeyRound, Plus } from 'lucide-react'
import { useState } from 'react'
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

export default function CenterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<Admin | null>(null)

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
        <div className="p-8 text-sm text-rose-600">Center not found.</div>
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
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
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
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  {org.name}
                </h1>
                <p className="font-mono text-xs text-slate-500">/{org.slug}</p>
              </div>
            </div>
            <a href={`/${org.slug}`} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-200"
              >
                Open site ↗
              </Button>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Students" value={org.students_count} />
          <StatCard label="Teachers" value={org.teachers_count} />
          <StatCard label="Admins" value={org.admins_count} />
          <StatCard label="Plan" value={org.plan_name} subtitle={`${org.days_remaining} days left`} />
        </div>

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
    </SuperAdminLayout>
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
