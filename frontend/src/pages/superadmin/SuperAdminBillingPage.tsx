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
  period_start: string | null
  period_end: string | null
  period_label: string
  year: number | null
  month: number | null
  total_sessions: number
  total_students: number
  total_amount: number
  paid_amount: number
  status: string
  payment_method: string
  payment_date: string | null
  invoice_number: string
  paid_at: string | null
  notes: string
}

type PaymentRow = {
  id: number
  amount_paid: number
  payment_method: string
  payment_method_label: string
  payment_date: string
  receipt_number: string
  received_by: string | null
  invoice_number: string
  cycle_period: string
  notes: string
  created_at: string
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
  overdue: 'bg-cta-100 text-cta-700',
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
      toast.success('Billing cycle created')
      qc.invalidateQueries({ queryKey: ['super-billing-org', selectedOrgId] })
      qc.invalidateQueries({ queryKey: ['super-billing-overview'] })
    },
    onError: () => toast.error('Failed to create cycle'),
  })

  const markPaid = useMutation({
    mutationFn: async (payload: {
      cycleId: number
      paid_amount: number
      payment_method: string
      payment_date: string
      notes?: string
    }) =>
      (await api.post(`/super/billing/cycles/${payload.cycleId}/mark-paid/`, {
        paid_amount: payload.paid_amount,
        payment_method: payload.payment_method,
        payment_date: payload.payment_date,
        notes: payload.notes ?? '',
      })).data,
    onSuccess: () => {
      toast.success('To\'langan deb belgilandi')
      setPayCycle(null)
      qc.invalidateQueries({ queryKey: ['super-billing-org', selectedOrgId] })
      qc.invalidateQueries({ queryKey: ['super-billing-overview'] })
      qc.invalidateQueries({ queryKey: ['super-billing-payments', selectedOrgId] })
    },
    onError: () => toast.error('Yangilashda xatolik'),
  })

  const paymentHistory = useQuery({
    queryKey: ['super-billing-payments', selectedOrgId],
    queryFn: async () =>
      (await api.get<PaymentRow[]>(
        `/super/billing/organizations/${selectedOrgId}/payments/`,
      )).data,
    enabled: !!selectedOrgId,
  })

  const [payCycle, setPayCycle] = useState<CycleRow | null>(null)

  const updatePricing = useMutation({
    mutationFn: async ({
      orgId, tier_1, tier_2, tier_3,
    }: { orgId: number; tier_1: number; tier_2: number; tier_3: number }) =>
      (await api.patch(`/super/billing/organizations/${orgId}/pricing/`, {
        price_per_session_tier_1: tier_1,
        price_per_session_tier_2: tier_2,
        price_per_session_tier_3: tier_3,
      })).data,
    onSuccess: () => {
      toast.success('Prices saved')
      qc.invalidateQueries({ queryKey: ['super-billing-org', selectedOrgId] })
      qc.invalidateQueries({ queryKey: ['super-billing-overview'] })
    },
    onError: () => toast.error('Failed to save prices'),
  })

  const totals = overview.data?.totals
  const orgs = overview.data?.organizations ?? []

  return (
    <SuperAdminLayout>
      <div className="space-y-8 p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Per-center session-based billing and payments.
          </p>
        </div>

        {overview.isLoading && <p className="text-slate-500">Loading…</p>}
        {overview.isError && (
          <p className="text-cta-600">Couldn't load data.</p>
        )}

        {totals && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Centers" value={totals.organizations} />
            <Stat
              label="Completed sessions"
              value={totals.sessions_finished}
              hint={`${totals.unbilled_sessions} not yet included in billing`}
            />
            <Stat
              label="This month's revenue"
              value={fmtMoney(totals.monthly_revenue)}
              accent="text-emerald-600"
            />
            <Stat
              label="Kutilayotgan to‘lov"
              value={fmtMoney(totals.pending_amount)}
              accent="text-amber-600"
              hint={`Total revenue: ${fmtMoney(totals.total_revenue)}`}
            />
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="border-b p-4">
              <h2 className="text-base font-semibold">Centers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Center</th>
                    <th className="px-4 py-3 text-center">Sessions</th>
                    <th className="px-4 py-3 text-center">Current price</th>
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
                        <div className="text-xs text-slate-500">total {o.sessions_total}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-emerald-700">
                        {fmtMoney(o.current_price_per_session)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {o.pending_amount > 0 ? (
                          <span className="text-cta-600">{fmtMoney(o.pending_amount)}</span>
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
                        Centers yo‘q.
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
                        Creating…
                      </>
                    ) : (
                      'Create cycle for last month'
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
                  <PricingEditor
                    orgId={selectedOrgId}
                    initial={orgDetail.data.pricing}
                    onSave={(values) =>
                      updatePricing.mutate({ orgId: selectedOrgId, ...values })
                    }
                    saving={updatePricing.isPending}
                  />

                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Billing cycles</h3>
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
                              <th className="px-3 py-2 text-center">Sessions</th>
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
                                  <div className="font-medium">{c.period_label}</div>
                                  {c.total_students > 0 && (
                                    <div className="text-xs text-slate-500">
                                      {c.total_students} students
                                    </div>
                                  )}
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
                                      onClick={() => setPayCycle(c)}
                                    >
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      To'landi
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
                        Sessions not yet included in a billing cycle
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

                  {/* ETAP 16 — to'lov tarixi */}
                  {paymentHistory.data && paymentHistory.data.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        To'lov tarixi
                      </h3>
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Davr</th>
                              <th className="px-3 py-2">Usul</th>
                              <th className="px-3 py-2 text-right">Summa</th>
                              <th className="px-3 py-2">Qabul qildi</th>
                              <th className="px-3 py-2">Izoh</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {paymentHistory.data.map((p) => (
                              <tr key={p.id}>
                                <td className="px-3 py-2 font-medium">
                                  {new Date(p.payment_date).toLocaleDateString('uz-UZ')}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">
                                  {p.cycle_period} {p.invoice_number && `· ${p.invoice_number}`}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {p.payment_method_label}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-emerald-700">
                                  {fmtMoney(p.amount_paid)}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-600">
                                  {p.received_by ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">
                                  {p.notes || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {payCycle && (
          <MarkPaidModal
            cycle={payCycle}
            onCancel={() => setPayCycle(null)}
            onConfirm={(form) =>
              markPaid.mutate({
                cycleId: payCycle.id,
                paid_amount: form.paid_amount,
                payment_method: form.payment_method,
                payment_date: form.payment_date,
                notes: form.notes,
              })
            }
            saving={markPaid.isPending}
          />
        )}
      </div>
    </SuperAdminLayout>
  )
}

function MarkPaidModal({
  cycle,
  onCancel,
  onConfirm,
  saving,
}: {
  cycle: CycleRow
  onCancel: () => void
  onConfirm: (form: {
    paid_amount: number
    payment_method: string
    payment_date: string
    notes: string
  }) => void
  saving: boolean
}) {
  const [amount, setAmount] = useState(String(cycle.total_amount))
  const [method, setMethod] = useState('cash')
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [notes, setNotes] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">
          To'landi deb belgilash
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {cycle.period_label} · {fmtMoney(cycle.total_amount)}
          {cycle.invoice_number && ` · ${cycle.invoice_number}`}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Summa (so'm)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
              To'lov usuli
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="cash">Naqd</option>
              <option value="bank_transfer">Bank o'tkazmasi</option>
              <option value="card">Karta</option>
              <option value="other">Boshqa</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
              To'lov sanasi
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Izoh (ixtiyoriy)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Receipt #, eslatma..."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                paid_amount: Number(amount),
                payment_method: method,
                payment_date: paymentDate,
                notes,
              })
            }
            disabled={saving || !amount}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
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

function PricingEditor({
  orgId, initial, onSave, saving,
}: {
  orgId: number
  initial: { tier_1: number; tier_2: number; tier_3: number }
  onSave: (values: { tier_1: number; tier_2: number; tier_3: number }) => void
  saving: boolean
}) {
  const [tier1, setTier1] = useState<string>(String(initial.tier_1))
  const [tier2, setTier2] = useState<string>(String(initial.tier_2))
  const [tier3, setTier3] = useState<string>(String(initial.tier_3))

  // Reset local form state when switching organizations
  useEffect(() => {
    setTier1(String(initial.tier_1))
    setTier2(String(initial.tier_2))
    setTier3(String(initial.tier_3))
  }, [orgId, initial.tier_1, initial.tier_2, initial.tier_3])

  const parse = (v: string) => {
    const n = Number(v.replace(/\s+/g, ''))
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const t1 = parse(tier1)
  const t2 = parse(tier2)
  const t3 = parse(tier3)
  const valid = t1 !== null && t2 !== null && t3 !== null
  const dirty =
    t1 !== initial.tier_1 || t2 !== initial.tier_2 || t3 !== initial.tier_3

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pricing tiers</h3>
        <p className="text-xs text-slate-500">
          Price per session (in UZS). Tier is selected automatically based on session count.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <PricingInput label="0–100 sessions" value={tier1} onChange={setTier1} valid={t1 !== null} />
        <PricingInput label="101–500 sessions" value={tier2} onChange={setTier2} valid={t2 !== null} />
        <PricingInput label="501+ sessions" value={tier3} onChange={setTier3} valid={t3 !== null} />
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {dirty && (
          <button
            type="button"
            className="text-xs text-slate-500 hover:underline"
            onClick={() => {
              setTier1(String(initial.tier_1))
              setTier2(String(initial.tier_2))
              setTier3(String(initial.tier_3))
            }}
          >
            Cancel
          </button>
        )}
        <Button
          size="sm"
          disabled={!valid || !dirty || saving}
          onClick={() => {
            if (!valid) return
            onSave({ tier_1: t1!, tier_2: t2!, tier_3: t3! })
          }}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Saving…
            </>
          ) : (
            'Save prices'
          )}
        </Button>
      </div>
    </div>
  )
}

function PricingInput({
  label, value, onChange, valid,
}: {
  label: string; value: string; onChange: (v: string) => void; valid: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-1 flex items-center rounded-md border bg-white focus-within:border-slate-900">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-transparent px-3 py-2 font-mono text-sm focus:outline-none ${
            valid ? 'text-slate-900' : 'text-cta-600'
          }`}
        />
        <span className="px-2 text-xs text-slate-500">so‘m</span>
      </div>
    </label>
  )
}
