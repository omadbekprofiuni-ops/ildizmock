import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import SuperAdminLayout from './SuperAdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type OverviewOrg = {
  id: number
  name: string
  slug: string
  status: string
  plan_expires_at: string | null
  sessions_total: number
  sessions_finished: number
  current_price_per_session: number
  pending_amount: number
  logo: string | null
}

type Overview = {
  totals: {
    organizations: number
    sessions_finished: number
    total_revenue: number
    pending_amount: number
    monthly_revenue: number
    unbilled_sessions: number
  }
  organizations: OverviewOrg[]
}

type CycleRow = {
  id: number
  period_start: string
  period_end: string
  total_sessions: number
  total_amount: number
  paid_amount: number
  status: string
  invoice_number: string
  paid_at: string | null
}

type OrgDetail = {
  organization: {
    id: number
    name: string
    slug: string
    status: string
    logo: string | null
    contact_email: string
    contact_phone: string
  }
  pricing: {
    tier_1: number
    tier_2: number
    tier_3: number
    period: string
    is_active: boolean
  }
  cycles: CycleRow[]
  unbilled_sessions: {
    session_id: number
    session_name: string
    session_date: string
    price_per_session: number
    participant_count: number
  }[]
  recent_sessions: {
    id: number
    name: string
    date: string
    status: string
    participants: number
  }[]
}

function fmtMoney(value: number): string {
  return value.toLocaleString('uz-UZ') + " so'm"
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  overdue: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-slate-100 text-slate-700',
}

export default function SuperAdminBillingPage() {
  const qc = useQueryClient()
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  useEffect(() => { document.title = 'ILDIZmock — Billing' }, [])

  const overview = useQuery({
    queryKey: ['super-billing-overview'],
    queryFn: async () => (await api.get<Overview>('/super/billing/overview/')).data,
  })

  const orgDetail = useQuery({
    queryKey: ['super-billing-org', selectedOrgId],
    queryFn: async () =>
      (await api.get<OrgDetail>(`/super/billing/organizations/${selectedOrgId}/`)).data,
    enabled: !!selectedOrgId,
  })

  const generateCycle = useMutation({
    mutationFn: async (orgId: number) =>
      (await api.post('/super/billing/cycles/generate/', { organization_id: orgId })).data,
    onSuccess: () => {
      toast.success('Hisob-kitob davri yaratildi')
      qc.invalidateQueries({ queryKey: ['super-billing-org', selectedOrgId] })
      qc.invalidateQueries({ queryKey: ['super-billing-overview'] })
    },
    onError: () => toast.error('Cycle yaratishda xatolik'),
  })

  const markPaid = useMutation({
    mutationFn: async ({ cycleId, amount }: { cycleId: number; amount: number }) =>
      (await api.post(`/super/billing/cycles/${cycleId}/mark-paid/`, {
        paid_amount: amount,
      })).data,
    onSuccess: () => {
      toast.success('Cycle to‘langan deb belgilandi')
      qc.invalidateQueries({ queryKey: ['super-billing-org', selectedOrgId] })
      qc.invalidateQueries({ queryKey: ['super-billing-overview'] })
    },
    onError: () => toast.error('Yangilashda xatolik'),
  })

  const totals = overview.data?.totals
  const orgs = overview.data?.organizations ?? []

  return (
    <SuperAdminLayout>
      <div className="space-y-8 p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Markazlar bo‘yicha sessiya-asosli hisob-kitob va to‘lovlar.
          </p>
        </div>

        {overview.isLoading && <p className="text-slate-500">Loading…</p>}
        {overview.isError && (
          <p className="text-rose-600">Ma‘lumotlarni yuklab bo‘lmadi.</p>
        )}

        {totals && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Markazlar" value={totals.organizations} />
            <Stat
              label="Tugatilgan sessiyalar"
              value={totals.sessions_finished}
              hint={`${totals.unbilled_sessions} ta hali billing'sa kiritilmagan`}
            />
            <Stat
              label="Bu oydagi daromad"
              value={fmtMoney(totals.monthly_revenue)}
              accent="text-emerald-600"
            />
            <Stat
              label="Kutilayotgan to‘lov"
              value={fmtMoney(totals.pending_amount)}
              accent="text-amber-600"
              hint={`Jami daromad: ${fmtMoney(totals.total_revenue)}`}
            />
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4">
              <h2 className="text-base font-semibold">Markazlar</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Markaz</th>
                    <th className="px-4 py-3 text-center">Sessiyalar</th>
                    <th className="px-4 py-3 text-center">Hozirgi narx</th>
                    <th className="px-4 py-3 text-center">Qarzdorlik</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orgs.map((o) => (
                    <tr
                      key={o.id}
                      className={`hover:bg-slate-50 ${
                        selectedOrgId === o.id ? 'bg-slate-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {o.logo ? (
                            <img
                              src={o.logo}
                              alt={o.name}
                              className="h-8 w-8 rounded object-contain"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-slate-200" />
                          )}
                          <div>
                            <div className="font-semibold text-slate-900">{o.name}</div>
                            <div className="text-xs text-slate-500">{o.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="font-semibold">{o.sessions_finished}</div>
                        <div className="text-xs text-slate-500">jami {o.sessions_total}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-emerald-700">
                        {fmtMoney(o.current_price_per_session)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {o.pending_amount > 0 ? (
                          <span className="text-rose-600">{fmtMoney(o.pending_amount)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            o.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrgId(o.id)}
                        >
                          Tafsilot
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {orgs.length === 0 && !overview.isLoading && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Markazlar yo‘q.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {selectedOrgId && (
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {orgDetail.data?.organization.name || 'Tafsilot'}
                </h2>
                <div className="flex gap-2">
                  <Button
                    onClick={() => generateCycle.mutate(selectedOrgId)}
                    disabled={generateCycle.isPending}
                    size="sm"
                  >
                    {generateCycle.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Yaratilmoqda…
                      </>
                    ) : (
                      'O‘tgan oyga cycle yaratish'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrgId(null)}
                  >
                    Yopish
                  </Button>
                </div>
              </div>

              {orgDetail.isLoading && <p className="text-slate-500">Loading…</p>}

              {orgDetail.data && (
                <>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Pricing tiers</h3>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <PricingCell
                        label="0–100 sessiya"
                        value={orgDetail.data.pricing.tier_1}
                      />
                      <PricingCell
                        label="101–500"
                        value={orgDetail.data.pricing.tier_2}
                      />
                      <PricingCell
                        label="501+"
                        value={orgDetail.data.pricing.tier_3}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Hisob-kitob davrlari</h3>
                    {orgDetail.data.cycles.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Hozircha cycle yo‘q. Yuqoridagi tugma yordamida yarating.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Davr</th>
                              <th className="px-3 py-2 text-center">Sessiyalar</th>
                              <th className="px-3 py-2 text-right">Summa</th>
                              <th className="px-3 py-2 text-right">To‘langan</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Invoice</th>
                              <th className="px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {orgDetail.data.cycles.map((c) => (
                              <tr key={c.id}>
                                <td className="px-3 py-2">
                                  {c.period_start} → {c.period_end}
                                </td>
                                <td className="px-3 py-2 text-center">{c.total_sessions}</td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {fmtMoney(c.total_amount)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-emerald-700">
                                  {fmtMoney(c.paid_amount)}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                                      STATUS_COLOR[c.status] || 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {c.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">
                                  {c.invoice_number || '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {c.status !== 'paid' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        markPaid.mutate({
                                          cycleId: c.id,
                                          amount: c.total_amount,
                                        })
                                      }
                                      disabled={markPaid.isPending}
                                    >
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      To‘landi deb belgilash
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {orgDetail.data.unbilled_sessions.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        Hisob-kitob davriga kirmagan sessiyalar
                      </h3>
                      <ul className="divide-y rounded-md border text-sm">
                        {orgDetail.data.unbilled_sessions.map((s) => (
                          <li
                            key={s.session_id}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <div>
                              <div className="font-medium">{s.session_name}</div>
                              <div className="text-xs text-slate-500">
                                {new Date(s.session_date).toLocaleDateString('uz-UZ')} ·{' '}
                                {s.participant_count} ishtirokchi
                              </div>
                            </div>
                            <div className="font-mono text-emerald-700">
                              {fmtMoney(s.price_per_session)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SuperAdminLayout>
  )
}

function Stat({
  label, value, hint, accent,
}: {
  label: string; value: string | number; hint?: string; accent?: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? 'text-slate-900'}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

function PricingCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
        {fmtMoney(value)}
      </div>
    </div>
  )
}
