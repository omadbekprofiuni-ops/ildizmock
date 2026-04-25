import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogIn, MoreVertical, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
import { useOrgContext } from '@/stores/orgContext'

import SuperAdminLayout from './SuperAdminLayout'

type Plan = { id: number; code: string; name: string; price_usd: string; max_students: number }
type Org = {
  id: number; name: string; slug: string; primary_color: string
  plan_code: string; plan_name: string; status: string
  students_count: number; max_students: number
  days_remaining: number; plan_expires_at: string
}

export default function SuperAdminOrgsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const setContext = useOrgContext((s) => s.setContext)
  const [open, setOpen] = useState(false)

  const orgs = useQuery({
    queryKey: ['super-orgs'],
    queryFn: async () => (await api.get<Org[]>('/superadmin/organizations/')).data,
  })

  const plans = useQuery({
    queryKey: ['super-plans'],
    queryFn: async () => (await api.get<Plan[]>('/superadmin/plans/')).data,
  })

  const enterOrgContext = (org: Org) => {
    setContext(org.id, org.name)
    navigate('/super/org/dashboard')
    toast.info(`${org.name} contextiga o‘tdingiz`)
  }

  return (
    <SuperAdminLayout>
      <header className="flex items-center justify-between border-b bg-white px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Markazlar</h1>
          <p className="text-sm text-muted-foreground">{orgs.data?.length ?? 0} ta markaz</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Yangi markaz qo‘shish
        </Button>
      </header>

      <div className="p-8">
        {orgs.isLoading && <p className="text-muted-foreground">Yuklanmoqda…</p>}
        {orgs.data && orgs.data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Nom</th>
                    <th className="px-6 py-3">Tarif</th>
                    <th className="px-6 py-3">Talaba</th>
                    <th className="px-6 py-3">Holat</th>
                    <th className="px-6 py-3">Tugaydi</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orgs.data.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-block h-6 w-6 rounded"
                            style={{ background: o.primary_color }}
                          />
                          <div>
                            <div className="font-medium">{o.name}</div>
                            <div className="text-xs text-muted-foreground">/{o.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">{o.plan_name}</td>
                      <td className="px-6 py-3">
                        {o.students_count}
                        {o.max_students > 0 ? ` / ${o.max_students}` : ' / ∞'}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-6 py-3 text-xs">
                        {o.days_remaining > 0 ? `${o.days_remaining} kun` : '—'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline" size="sm"
                            onClick={() => enterOrgContext(o)}
                            title="Markaz ichiga kirish"
                          >
                            <LogIn className="mr-1 h-3 w-3" /> Kirish
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateOrgDialog
        open={open}
        onOpenChange={setOpen}
        plans={plans.data || []}
        onCreated={() => qc.invalidateQueries({ queryKey: ['super-orgs'] })}
      />
    </SuperAdminLayout>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'bg-emerald-100 text-emerald-700'
    : status === 'trial' ? 'bg-amber-100 text-amber-700'
    : status === 'expired' ? 'bg-rose-100 text-rose-700'
    : 'bg-slate-200 text-slate-700'
  const label =
    status === 'active' ? '● Faol'
    : status === 'trial' ? '● Sinov'
    : status === 'expired' ? '⚠ Tugagan'
    : '● Bloklangan'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

function CreateOrgDialog({
  open, onOpenChange, plans, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void
  plans: Plan[]; onCreated: () => void
}) {
  const [form, setForm] = useState({
    name: '', slug: '', primary_color: '#DC2626',
    contact_phone: '', contact_email: '', address: '',
    plan: '',
    admin_phone: '+998', admin_first_name: '', admin_last_name: '',
    admin_password: '',
  })

  const create = useMutation({
    mutationFn: async () => (await api.post('/superadmin/organizations/', {
      ...form,
      plan: form.plan ? Number(form.plan) : undefined,
    })).data,
    onSuccess: (data) => {
      toast.success(
        `${data.name} yaratildi. Admin: ${data.admin?.phone} (parolni ko‘chiring)`,
      )
      onCreated()
      onOpenChange(false)
      setForm({
        name: '', slug: '', primary_color: '#DC2626',
        contact_phone: '', contact_email: '', address: '',
        plan: '',
        admin_phone: '+998', admin_first_name: '', admin_last_name: '',
        admin_password: '',
      })
    },
    onError: (err) => {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg = data ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Xatolik'
      toast.error(msg)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Yangi markaz qo‘shish</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nomi" value={form.name}
                 onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Slug (URL)" value={form.slug}
                 onChange={(v) => setForm({ ...form, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
          <Field label="Asosiy rang" value={form.primary_color}
                 onChange={(v) => setForm({ ...form, primary_color: v })} />
          <div className="space-y-1">
            <Label className="text-xs">Tarif</Label>
            <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    className="h-9 w-full rounded-md border bg-white px-2 text-sm">
              <option value="">— tanlang —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (${p.price_usd})</option>
              ))}
            </select>
          </div>
          <Field label="Telefon" value={form.contact_phone}
                 onChange={(v) => setForm({ ...form, contact_phone: v })} />
          <Field label="Email" value={form.contact_email}
                 onChange={(v) => setForm({ ...form, contact_email: v })} />
          <div className="sm:col-span-2">
            <Field label="Manzil" value={form.address}
                   onChange={(v) => setForm({ ...form, address: v })} />
          </div>
        </div>

        <hr className="my-2" />
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Markaz administratori</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ism" value={form.admin_first_name}
                   onChange={(v) => setForm({ ...form, admin_first_name: v })} />
            <Field label="Familiya" value={form.admin_last_name}
                   onChange={(v) => setForm({ ...form, admin_last_name: v })} />
            <Field label="Telefon" value={form.admin_phone}
                   onChange={(v) => setForm({ ...form, admin_phone: v })} />
            <Field label="Parol" value={form.admin_password}
                   onChange={(v) => setForm({ ...form, admin_password: v })} type="password" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Yaratilmoqda…' : 'Markaz yaratish ✓'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label, value, onChange, type,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
