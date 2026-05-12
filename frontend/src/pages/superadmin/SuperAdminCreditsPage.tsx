import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Coins, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Chip,
  PageHeader,
  PageShell,
  StatCard,
  TableCard,
  adminTable,
} from '@/components/admin-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import SuperAdminLayout from './SuperAdminLayout'

type Transaction = {
  id: number
  user: string
  user_id: number
  kind: string
  kind_display: string
  amount: number
  balance_after: number
  note: string
  created_by: string | null
  created_at: string
}

type Resp = {
  summary: {
    total_in_circulation: number
    today_grant: number
    today_spend: number
    week_grant: number
  }
  transactions: Transaction[]
}

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Barchasi' },
  { value: 'signup_bonus', label: 'Signup bonus' },
  { value: 'admin_grant', label: 'Admin grant' },
  { value: 'admin_deduct', label: 'Admin deduct' },
  { value: 'spend', label: 'Test boshlash' },
  { value: 'refund', label: 'Refund' },
  { value: 'promo_code', label: 'Promo kod' },
  { value: 'purchase', label: 'Sotib olish' },
]

function fmtDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB') : '—'
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

type TabKey = 'transactions' | 'bulk'

export default function SuperAdminCreditsPage() {
  const [tab, setTab] = useState<TabKey>('transactions')
  const [kindFilter, setKindFilter] = useState('all')
  const [userQuery, setUserQuery] = useState('')

  const params: Record<string, string> = { kind: kindFilter }
  if (userQuery.trim()) params.user = userQuery.trim()

  const q = useQuery({
    queryKey: ['super-credits-overview', { kindFilter, userQuery }],
    queryFn: async () => (await api.get<Resp>('/super/credits/', { params })).data,
  })

  return (
    <SuperAdminLayout>
      <PageShell>
        <PageHeader
          title="Kreditlar"
          subtitle="Tranzaksiyalar va bulk grant"
        />

        {q.data && (
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              Icon={Coins} tone="amber" label="Aylanmadagi credit"
              value={q.data.summary.total_in_circulation} hint="barcha userlar balansi"
            />
            <StatCard
              Icon={TrendingUp} tone="emerald" label="Bugungi grant"
              value={`+${q.data.summary.today_grant}`} hint="grant + bonus + promo + refund"
            />
            <StatCard
              Icon={TrendingDown} tone="rose" label="Bugungi sarf"
              value={`−${q.data.summary.today_spend}`} hint="test boshlash"
            />
            <StatCard
              Icon={TrendingUp} tone="blue" label="Haftalik grant"
              value={`+${q.data.summary.week_grant}`} hint="7 kun"
            />
          </div>
        )}

        <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setTab('transactions')}
            className={`rounded-lg px-4 py-1.5 transition-colors ${tab === 'transactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Tranzaksiyalar
          </button>
          <button
            type="button"
            onClick={() => setTab('bulk')}
            className={`rounded-lg px-4 py-1.5 transition-colors ${tab === 'bulk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Bulk grant
          </button>
        </div>

        {tab === 'transactions' && (
          <>
            <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-3 sm:flex-row">
              <input
                type="search"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Username bo‘yicha qidiruv…"
                className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
              />
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {q.isLoading && <p className="text-slate-500">Yuklanmoqda…</p>}
            {q.data && q.data.transactions.length === 0 && (
              <TableCard>
                <div className="py-12 text-center text-sm text-slate-500">
                  Bu filtr bo‘yicha tranzaksiyalar topilmadi.
                </div>
              </TableCard>
            )}
            {q.data && q.data.transactions.length > 0 && (
              <TableCard>
                <table className={adminTable.table}>
                  <thead className={adminTable.thead}>
                    <tr>
                      <th className={adminTable.th}>Sana</th>
                      <th className={adminTable.th}>Foydalanuvchi</th>
                      <th className={adminTable.th}>Tur</th>
                      <th className={adminTable.th + ' text-right'}>Miqdor</th>
                      <th className={adminTable.th + ' text-right'}>Balans</th>
                      <th className={adminTable.th}>Izoh</th>
                    </tr>
                  </thead>
                  <tbody className={adminTable.tbody}>
                    {q.data.transactions.map((t) => (
                      <tr key={t.id} className={adminTable.trHover}>
                        <td className={adminTable.td + ' text-xs text-slate-500'}>
                          {fmtDateTime(t.created_at)}
                        </td>
                        <td className={adminTable.td}>
                          <Link
                            to={`/super/b2c-users/${t.user_id}`}
                            className="font-mono text-sm text-brand-700 hover:underline"
                          >
                            {t.user}
                          </Link>
                        </td>
                        <td className={adminTable.td}>
                          <KindBadge kind={t.kind} display={t.kind_display} />
                        </td>
                        <td className={adminTable.td + ' text-right font-mono font-bold'}>
                          <span className={t.amount >= 0 ? 'text-emerald-600' : 'text-cta-600'}>
                            {t.amount > 0 ? '+' : ''}{t.amount}
                          </span>
                        </td>
                        <td className={adminTable.td + ' text-right font-mono text-slate-600'}>
                          {t.balance_after}
                        </td>
                        <td className={adminTable.td + ' text-xs text-slate-600'}>
                          <div>{t.note || '—'}</div>
                          {t.created_by && (
                            <div className="text-slate-400">by {t.created_by}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableCard>
            )}
          </>
        )}

        {tab === 'bulk' && <BulkGrantTab />}
      </PageShell>
    </SuperAdminLayout>
  )
}

function BulkGrantTab() {
  const qc = useQueryClient()
  const [filterType, setFilterType] = useState<'all' | 'zero_balance' | 'last_n_days'>('all')
  const [amount, setAmount] = useState('5')
  const [note, setNote] = useState('')
  const [days, setDays] = useState('30')
  const [preview, setPreview] = useState<{ users_count: number; total_credits_to_grant: number } | null>(null)

  const buildBody = (asPreview: boolean) => {
    const body: Record<string, unknown> = {
      filter_type: filterType,
      amount: Number(amount),
      note: note.trim(),
      preview: asPreview,
    }
    if (filterType === 'last_n_days') body.days = Number(days)
    return body
  }

  const previewM = useMutation({
    mutationFn: async () =>
      (await api.post<{ users_count: number; total_credits_to_grant: number }>(
        '/super/credits/bulk-grant/', buildBody(true),
      )).data,
    onSuccess: (data) => setPreview(data),
    onError: (err) => {
      const detail = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg = detail ? Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Xatolik'
      toast.error(msg)
    },
  })

  const executeM = useMutation({
    mutationFn: async () =>
      (await api.post<{ granted_to: number; total_credits: number }>(
        '/super/credits/bulk-grant/', buildBody(false),
      )).data,
    onSuccess: (data) => {
      toast.success(`${data.granted_to} userga +${data.total_credits} credit berildi`)
      setPreview(null)
      setAmount('5')
      setNote('')
      qc.invalidateQueries({ queryKey: ['super-credits-overview'] })
      qc.invalidateQueries({ queryKey: ['super-b2c-users'] })
    },
  })

  const valid = Number(amount) > 0 && note.trim().length >= 3

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-400" />
          <h2 className="text-base font-bold text-slate-900">Bulk grant — bir nechta foydalanuvchiga</h2>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Kimga</Label>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Radio
                checked={filterType === 'all'} onChange={() => setFilterType('all')}
                title="Hammasi" desc="Barcha faol B2C user"
              />
              <Radio
                checked={filterType === 'zero_balance'} onChange={() => setFilterType('zero_balance')}
                title="Kreditsiz" desc="Balans = 0"
              />
              <Radio
                checked={filterType === 'last_n_days'} onChange={() => setFilterType('last_n_days')}
                title="Oxirgi N kun" desc="Yangi ro‘yxatdan o‘tdi"
              />
            </div>
          </div>

          {filterType === 'last_n_days' && (
            <div className="space-y-1">
              <Label className="text-xs">Kun (oxirgi N kun)</Label>
              <Input
                type="number" min="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Credit miqdori</Label>
              <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Izoh (majburiy, ≥3 belgi)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yangi yil aksiyasi" />
            </div>
          </div>

          {preview && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm">
              <p className="font-bold text-amber-900">Preview natijasi:</p>
              <p className="mt-1 text-amber-800">
                <b>{preview.users_count}</b> foydalanuvchiga jami <b>+{preview.total_credits_to_grant}</b> credit beriladi
              </p>
              {preview.users_count > 100 && (
                <p className="mt-2 text-xs text-amber-700">
                  ⚠️ 100 dan ortiq foydalanuvchi — bajarish bir necha soniya olishi mumkin.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => previewM.mutate()}
              disabled={!valid || previewM.isPending}
            >
              <ArrowDownCircle size={14} className="mr-1.5" />
              {previewM.isPending ? 'Hisoblanmoqda…' : 'Preview qilish'}
            </Button>
            <Button
              onClick={() => {
                if (window.confirm(`${preview?.users_count ?? '?'} userga +${preview?.total_credits_to_grant ?? amount} credit beriladimi?`)) {
                  executeM.mutate()
                }
              }}
              disabled={!preview || executeM.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <ArrowUpCircle size={14} className="mr-1.5" />
              {executeM.isPending ? 'Bajarilmoqda…' : 'Bajarish'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Radio({
  checked, onChange, title, desc,
}: {
  checked: boolean
  onChange: () => void
  title: string
  desc: string
}) {
  return (
    <label
      onClick={onChange}
      className={`cursor-pointer rounded-xl border-2 p-3 text-sm transition-colors ${
        checked ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <input type="radio" checked={checked} onChange={onChange} />
        <span className="font-bold">{title}</span>
      </div>
      <p className="mt-1 pl-6 text-xs text-slate-500">{desc}</p>
    </label>
  )
}

void Chip
