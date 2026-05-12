import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, Gift, Zap } from 'lucide-react'
import { useState } from 'react'

import { B2CLayout } from '@/components/B2CLayout'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Transaction = {
  id: number
  kind: string
  kind_display: string
  amount: number
  balance_after: number
  note: string
  created_at: string
}

type Resp = {
  balance: number
  transactions: Transaction[]
}

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

export default function B2CCreditsPage() {
  const qc = useQueryClient()
  const [promoCode, setPromoCode] = useState('')

  const q = useQuery({
    queryKey: ['b2c-credits-page'],
    queryFn: async () => (await api.get<Resp>('/b2c/credits')).data,
  })

  const redeemM = useMutation({
    mutationFn: async () =>
      (
        await api.post<{
          credits_granted: number
          new_balance: number
          code: string
        }>('/b2c/credits/redeem-promo', { code: promoCode.trim() })
      ).data,
    onSuccess: (data) => {
      toast.success(`+${data.credits_granted} credit qabul qilindi (yangi balans: ⚡ ${data.new_balance})`)
      setPromoCode('')
      qc.invalidateQueries({ queryKey: ['b2c-credits-page'] })
      qc.invalidateQueries({ queryKey: ['b2c-credits-balance'] })
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || 'Promo kod qabul qilinmadi')
    },
  })

  return (
    <B2CLayout active="credits">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Kreditlar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kreditlar yordamida testlarni boshlaysiz. Har bir test uchun ma‘lum miqdorda credit kerak.
        </p>
      </div>

      {q.isLoading && (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Yuklanmoqda…
        </p>
      )}

      {q.data && (
        <>
          <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Hozirgi balans
                </p>
                <p className="mt-1 flex items-center gap-2 text-4xl font-extrabold text-slate-900">
                  <Zap className="h-8 w-8 text-amber-500" />
                  {q.data.balance}
                </p>
                <p className="mt-1 text-sm text-slate-600">credit</p>
              </div>
            </div>
          </div>

          {/* Promo kod input */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <Gift className="h-5 w-5 text-violet-500" />
              <h2 className="text-base font-bold text-slate-900">Promo kod</h2>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              Agar sizda promo kod bo‘lsa, kiriting va bepul kredit oling.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="WELCOME2026"
                className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 font-mono text-sm uppercase outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={() => redeemM.mutate()}
                disabled={!promoCode.trim() || redeemM.isPending}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {redeemM.isPending ? 'Yuborilmoqda…' : 'Qabul qilish'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Coins className="h-5 w-5 text-slate-400" />
              <h2 className="text-base font-bold text-slate-900">Tarix</h2>
            </div>
            {q.data.transactions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-500">
                <Gift className="h-10 w-10 text-slate-300" />
                <p>Hali tranzaksiyalar yo‘q.</p>
              </div>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Sana</th>
                      <th className="px-2 py-2 text-left">Tur</th>
                      <th className="px-2 py-2 text-right">Miqdor</th>
                      <th className="px-2 py-2 text-right">Balans</th>
                      <th className="px-2 py-2 text-left">Izoh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {q.data.transactions.map((t) => (
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
                        <td className="px-2 py-2 text-xs text-slate-600">{t.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </B2CLayout>
  )
}
