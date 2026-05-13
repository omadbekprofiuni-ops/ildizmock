import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Coins, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader, PageShell, StatCard } from '@/components/admin-shell'
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

type UserRow = {
  id: number
  username: string
  email: string
  full_name: string
  first_name: string
  last_name: string
  phone: string
  preferred_language: 'uz' | 'ru' | 'en'
  signup_source: '' | 'email' | 'google' | 'admin'
  target_exam: string
  target_band: number | null
  exam_date: string | null
  balance: number
  is_active: boolean
  date_joined: string
  last_login: string | null
}

type Transaction = {
  id: number
  kind: string
  kind_display: string
  amount: number
  balance_after: number
  note: string
  created_by: string | null
  created_at: string
}

type Resp = {
  user: UserRow
  balance: number
  transactions: Transaction[]
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB') : '—'
}

function fmtDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB') : '—'
}

function getError(err: unknown): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return ''
  if (typeof data === 'string') return data
  return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' · ')
}

export default function SuperAdminB2CUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const qc = useQueryClient()
  const [grantOpen, setGrantOpen] = useState<'grant' | 'deduct' | null>(null)

  const q = useQuery({
    queryKey: ['super-b2c-user', userId],
    queryFn: async () =>
      (await api.get<Resp>(`/super/b2c-users/${userId}/`)).data,
    enabled: !!userId,
  })

  if (q.isLoading) {
    return (
      <SuperAdminLayout>
        <PageShell>
          <div className="py-12 text-center text-slate-500">Yuklanmoqda…</div>
        </PageShell>
      </SuperAdminLayout>
    )
  }
  if (q.isError || !q.data) {
    return (
      <SuperAdminLayout>
        <PageShell>
          <div className="py-12 text-center text-cta-600">
            Foydalanuvchi topilmadi.
          </div>
        </PageShell>
      </SuperAdminLayout>
    )
  }

  const { user, balance, transactions } = q.data
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['super-b2c-user', userId] })
    qc.invalidateQueries({ queryKey: ['super-b2c-users'] })
  }

  return (
    <SuperAdminLayout>
      <PageShell>
        <Link
          to="/super/b2c-users"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
        >
          <ArrowLeft size={14} /> Foydalanuvchilarga qaytish
        </Link>

        <PageHeader
          title={user.full_name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-slate-500">{user.username}</span>
              {user.email && <span className="text-slate-500">· {user.email}</span>}
              {!user.is_active && (
                <span className="rounded-full bg-cta-100 px-2 py-0.5 text-[11px] font-bold uppercase text-cta-700">
                  Faol emas
                </span>
              )}
            </span>
          }
          actions={
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setGrantOpen('grant')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <ArrowUpCircle size={16} className="mr-1.5" /> Kredit qo‘shish
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGrantOpen('deduct')}
                className="border-cta-300 text-cta-700 hover:bg-cta-50"
              >
                <ArrowDownCircle size={16} className="mr-1.5" /> Olib tashlash
              </Button>
            </div>
          }
        />

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            Icon={Zap} tone="amber" label="Hozirgi balans"
            value={`⚡ ${balance}`}
            hint="credit"
          />
          <StatCard
            Icon={Coins} tone="blue" label="Tranzaksiyalar"
            value={transactions.length}
            hint="oxirgi 100 ta"
          />
          <StatCard
            tone="emerald" label="Manba"
            value={user.signup_source || '—'}
            hint={user.preferred_language.toUpperCase()}
          />
          <StatCard
            tone="violet" label="Maqsadi"
            value={user.target_exam || '—'}
            hint={user.target_band !== null ? `Band ${user.target_band}` : '—'}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                Kredit tarixi
              </h2>
              {transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Tranzaksiyalar yo‘q.
                </p>
              ) : (
                <div className="-mx-2 max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-2 text-left">Sana</th>
                        <th className="px-2 py-2 text-left">Tur</th>
                        <th className="px-2 py-2 text-right">Miqdor</th>
                        <th className="px-2 py-2 text-right">Balans</th>
                        <th className="px-2 py-2 text-left">Izoh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-2 py-2 text-xs text-slate-500">
                            {fmtDateTime(t.created_at)}
                          </td>
                          <td className="px-2 py-2">
                            <KindBadge kind={t.kind} display={t.kind_display} />
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-bold">
                            <span className={t.amount >= 0 ? 'text-emerald-600' : 'text-cta-600'}>
                              {t.amount > 0 ? '+' : ''}{t.amount}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-slate-600">
                            {t.balance_after}
                          </td>
                          <td className="px-2 py-2 text-xs text-slate-600">
                            <div>{t.note || '—'}</div>
                            {t.created_by && (
                              <div className="text-slate-400">by {t.created_by}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-sm">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Profil</h2>
              <Field label="Email" value={user.email || '—'} />
              <Field label="Telefon" value={user.phone || '—'} />
              <Field label="Til" value={user.preferred_language.toUpperCase()} />
              <Field
                label="Maqsadli imtihon"
                value={user.target_exam || '—'}
              />
              <Field
                label="Target band"
                value={user.target_band !== null ? String(user.target_band) : '—'}
              />
              <Field label="Imtihon sanasi" value={fmtDate(user.exam_date)} />
              <Field label="Qo‘shilgan" value={fmtDate(user.date_joined)} />
              <Field label="Oxirgi kirish" value={fmtDateTime(user.last_login)} />
            </CardContent>
          </Card>
        </div>
      </PageShell>

      <CreditOpDialog
        userId={user.id}
        userName={user.full_name}
        currentBalance={balance}
        mode={grantOpen}
        onClose={() => setGrantOpen(null)}
        onDone={invalidate}
      />
    </SuperAdminLayout>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function KindBadge({ kind, display }: { kind: string; display: string }) {
  const tone: Record<string, string> = {
    signup_bonus: 'bg-emerald-50 text-emerald-700',
    admin_grant: 'bg-blue-50 text-brand-700',
    admin_deduct: 'bg-cta-50 text-cta-700',
    purchase: 'bg-amber-50 text-amber-700',
    spend: 'bg-slate-100 text-slate-700',
    refund: 'bg-violet-50 text-violet-700',
    promo_code: 'bg-teal-50 text-teal-700',
  }
  const cls = tone[kind] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {display}
    </span>
  )
}

function CreditOpDialog({
  userId, userName, currentBalance, mode, onClose, onDone,
}: {
  userId: number
  userName: string
  currentBalance: number
  mode: 'grant' | 'deduct' | null
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const reset = () => { setAmount(''); setNote('') }

  const m = useMutation({
    mutationFn: async () =>
      (await api.post(`/super/b2c-users/${userId}/credit-grant/`, {
        amount: Number(amount),
        note,
        action: mode,
      })).data,
    onSuccess: (data: { new_balance: number; kind_display: string }) => {
      toast.success(
        `${data.kind_display}. Yangi balans: ⚡ ${data.new_balance}`,
      )
      reset()
      onDone()
      onClose()
    },
    onError: (e) => toast.error(getError(e) || 'Operatsiya bajarilmadi'),
  })

  const num = Number(amount)
  const valid = num > 0 && Number.isFinite(num) && note.trim().length >= 3
  const isGrant = mode === 'grant'

  return (
    <Dialog open={mode !== null} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isGrant ? 'Kredit qo‘shish' : 'Kredit olib tashlash'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
            <p className="text-xs">Foydalanuvchi: <b>{userName}</b></p>
            <p className="text-xs">Hozirgi balans: <b>⚡ {currentBalance}</b></p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Miqdor (credit)</Label>
            <Input
              type="number" min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="masalan: 5"
            />
            {!isGrant && num > currentBalance && (
              <p className="text-xs text-cta-600">
                Diqqat: bu miqdor mavjud balansdan ortiq ({currentBalance}).
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Izoh (majburiy, kamida 3 belgi)</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder={isGrant ? 'Misol: promo, kompensatsiya' : 'Misol: noto‘g‘ri grant qaytarish'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose() }}>
            Bekor qilish
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={!valid || m.isPending}
            className={isGrant ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-cta-600 hover:bg-cta-700'}
          >
            {m.isPending
              ? 'Yuborilmoqda…'
              : isGrant ? 'Kreditni qo‘shish' : 'Olib tashlash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
