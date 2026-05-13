import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Copy, Gift, Plus, Power, Trash2, TrendingUp, Users as UsersIcon,
} from 'lucide-react'
import { useState } from 'react'

import {
  Chip,
  PageHeader,
  PageShell,
  StatCard,
  TableCard,
  adminTable,
  btnPrimary,
} from '@/components/admin-shell'
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

type PromoCode = {
  id: number
  code: string
  description: string
  credits_amount: number
  max_uses: number | null
  uses_count: number
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  is_redeemable: boolean
  created_at: string
  created_by: string | null
}

type Resp = {
  summary: {
    total: number
    active: number
    total_granted_credits: number
    total_redemptions: number
  }
  codes: PromoCode[]
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB') : '—'
}

function getError(err: unknown): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return ''
  if (typeof data === 'string') return data
  return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' · ')
}

export default function SuperAdminPromoCodesPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const q = useQuery({
    queryKey: ['super-promo-codes'],
    queryFn: async () => (await api.get<Resp>('/super/promo-codes/')).data,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['super-promo-codes'] })

  const toggleM = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await api.patch(`/super/promo-codes/${id}/`, { is_active: !isActive })).data,
    onSuccess: () => { invalidate(); toast.success('Holat o‘zgartirildi') },
    onError: (e) => toast.error(getError(e) || 'Xatolik'),
  })

  const deleteM = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/super/promo-codes/${id}/`)).data,
    onSuccess: () => { invalidate(); toast.success('O‘chirildi') },
    onError: (e) => toast.error(getError(e) || 'Xatolik'),
  })

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`"${code}" copied`)
  }

  return (
    <SuperAdminLayout>
      <PageShell>
        <PageHeader
          title="Promo kodlar"
          subtitle="Bepul kredit promo kodlari yaratish va boshqarish"
          actions={
            <button type="button" onClick={() => setCreateOpen(true)} className={btnPrimary}>
              <Plus size={16} /> Yangi promo kod
            </button>
          }
        />

        {q.data && (
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard Icon={Gift} tone="violet" label="Jami kodlar" value={q.data.summary.total} hint={`${q.data.summary.active} faol`} />
            <StatCard Icon={Power} tone="emerald" label="Faol" value={q.data.summary.active} hint="hozir redeem qilinadi" />
            <StatCard Icon={UsersIcon} tone="blue" label="Redemption'lar" value={q.data.summary.total_redemptions} hint="foydalanuvchilar" />
            <StatCard Icon={TrendingUp} tone="amber" label="Berilgan credit" value={q.data.summary.total_granted_credits} hint="jami" />
          </div>
        )}

        {q.isLoading && <p className="text-slate-500">Yuklanmoqda…</p>}

        {q.data && q.data.codes.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <Gift className="h-12 w-12 text-slate-300" />
              <p className="text-sm text-slate-500">Hali promo kodlar yo‘q.</p>
              <Button onClick={() => setCreateOpen(true)} className="mt-2">
                <Plus className="mr-1 h-4 w-4" /> Birinchi kodni yaratish
              </Button>
            </CardContent>
          </Card>
        )}

        {q.data && q.data.codes.length > 0 && (
          <TableCard>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th className={adminTable.th}>Kod</th>
                  <th className={adminTable.th}>Tavsif</th>
                  <th className={adminTable.th + ' text-center'}>Credit</th>
                  <th className={adminTable.th + ' text-center'}>Foydalanish</th>
                  <th className={adminTable.th}>Muddati</th>
                  <th className={adminTable.th}>Holat</th>
                  <th className={adminTable.th + ' text-right'}></th>
                </tr>
              </thead>
              <tbody className={adminTable.tbody}>
                {q.data.codes.map((p) => (
                  <tr key={p.id} className={adminTable.trHover}>
                    <td className={adminTable.td}>
                      <button
                        type="button"
                        onClick={() => copyCode(p.code)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-sm font-bold text-slate-900 hover:bg-slate-200"
                        title="Copy"
                      >
                        {p.code}
                        <Copy size={12} className="text-slate-400" />
                      </button>
                    </td>
                    <td className={adminTable.td + ' text-xs text-slate-600'}>
                      {p.description || <span className="text-slate-400">—</span>}
                    </td>
                    <td className={adminTable.td + ' text-center font-mono font-bold text-amber-700'}>
                      ⚡ {p.credits_amount}
                    </td>
                    <td className={adminTable.td + ' text-center text-xs text-slate-600'}>
                      {p.uses_count}
                      {p.max_uses !== null ? ` / ${p.max_uses}` : ' / ∞'}
                    </td>
                    <td className={adminTable.td + ' text-xs text-slate-500'}>
                      {p.valid_until ? `→ ${fmtDate(p.valid_until)}` : '∞'}
                    </td>
                    <td className={adminTable.td}>
                      {p.is_redeemable ? (
                        <Chip tone="emerald">Faol</Chip>
                      ) : !p.is_active ? (
                        <Chip>O‘chirilgan</Chip>
                      ) : (
                        <Chip tone="amber">Yaroqsiz</Chip>
                      )}
                    </td>
                    <td className={adminTable.td + ' text-right'}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleM.mutate({ id: p.id, isActive: p.is_active })}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                          title={p.is_active ? 'Deaktiv qilish' : 'Faollashtirish'}
                        >
                          <Power size={14} className={p.is_active ? 'text-emerald-600' : 'text-slate-400'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`"${p.code}" kodni o‘chirilsinmi?`)) deleteM.mutate(p.id)
                          }}
                          className="rounded-lg p-2 text-cta-500 hover:bg-cta-50"
                          title="O‘chirish"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}
      </PageShell>

      <CreatePromoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
    </SuperAdminLayout>
  )
}

function CreatePromoDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    code: '',
    description: '',
    credits_amount: '5',
    max_uses: '',
    valid_until: '',
  })

  const reset = () => setForm({
    code: '', description: '', credits_amount: '5', max_uses: '', valid_until: '',
  })

  const m = useMutation({
    mutationFn: async () =>
      (await api.post<PromoCode>('/super/promo-codes/', {
        code: form.code || undefined,
        description: form.description,
        credits_amount: Number(form.credits_amount),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        valid_until: form.valid_until || null,
      })).data,
    onSuccess: (data) => {
      toast.success(`"${data.code}" yaratildi`)
      reset()
      onCreated()
      onOpenChange(false)
    },
    onError: (e) => toast.error(getError(e) || 'Yaratib bo‘lmadi'),
  })

  const valid = Number(form.credits_amount) > 0

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi promo kod yaratish</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label className="text-xs">Kod (bo‘sh qoldirsangiz avtomatik)</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="WELCOME2026"
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tavsif (ixtiyoriy)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Yangi yil bonus"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Credit miqdori</Label>
              <Input
                type="number" min="1"
                value={form.credits_amount}
                onChange={(e) => setForm({ ...form, credits_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Maks. foydalanish</Label>
              <Input
                type="number" min="1"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="∞"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tugash sanasi (ixtiyoriy)</Label>
            <Input
              type="date"
              value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button onClick={() => m.mutate()} disabled={!valid || m.isPending}>
            {m.isPending ? 'Yaratilmoqda…' : 'Yaratish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
