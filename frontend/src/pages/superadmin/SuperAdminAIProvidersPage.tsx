/**
 * ETAP 16.8 — Superadmin AI Provider admin panel.
 *
 * Foydalanish:
 *   /super/settings/ai-providers
 *
 * - Provider'lar ro'yxati (kartochkalar)
 * - Har bir karta: model selector, masked key, key yangilash, sinash,
 *   aktiv qilish (faqat bittasi aktiv bo'la oladi)
 * - Pastida — oxirgi 50 ta o'zgartirish (audit log)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Key,
  Loader2,
  Lock,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react'
import { useState } from 'react'

import { btnOutline, btnPrimary } from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import SuperAdminLayout from './SuperAdminLayout'

interface ModelOption {
  value: string
  label: string
}

interface ProviderConfig {
  id: number
  provider: string
  provider_display: string
  model_name: string
  available_models: ModelOption[]
  masked_key: string
  is_configured: boolean
  is_active: boolean
  last_test_at: string | null
  last_test_success: boolean | null
  last_test_error: string
  last_test_latency_ms: number | null
  last_updated_at: string | null
  last_updated_by: string | null
}

interface AuditLog {
  id: number
  provider: string
  provider_code: string
  action: string
  action_code: string
  old_value: string
  new_value: string
  test_success: boolean | null
  test_error: string
  performed_by: string
  created_at: string
}

interface ListResponse {
  providers: ProviderConfig[]
  encryption_available: boolean
}

interface AuditResponse {
  logs: AuditLog[]
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function fmtError(e: unknown, fallback = 'Xatolik'): string {
  const data = (e as { response?: { data?: { error?: string } } })?.response?.data
  return (data?.error as string) || fallback
}

function placeholderFor(provider: string) {
  if (provider === 'gemini_aistudio')
    return 'AIzaSy... (https://aistudio.google.com/apikey)'
  if (provider === 'claude_anthropic')
    return 'sk-ant-... (https://console.anthropic.com)'
  return 'API key'
}

function ProviderCard({
  config,
  onChanged,
  encryptionAvailable,
}: {
  config: ProviderConfig
  onChanged: () => void
  encryptionAvailable: boolean
}) {
  const [model, setModel] = useState(config.model_name)
  const [newKey, setNewKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(!config.is_configured)
  const [revealKey, setRevealKey] = useState(false)

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {}
      if (model !== config.model_name) body.model_name = model
      if (newKey.trim()) body.api_key = newKey.trim()
      if (Object.keys(body).length === 0) {
        throw new Error('no_changes')
      }
      return (await api.patch(`/super/ai-providers/${config.id}/`, body)).data
    },
    onSuccess: () => {
      toast.success('Saqlandi')
      setNewKey('')
      setShowKeyInput(false)
      onChanged()
    },
    onError: (e) => {
      if ((e as Error).message === 'no_changes') {
        toast.message("O'zgarish yo'q")
        return
      }
      toast.error(fmtError(e, 'Saqlanmadi'))
    },
  })

  const testMut = useMutation({
    mutationFn: async () => {
      return (await api.post(`/super/ai-providers/${config.id}/test/`)).data as {
        success: boolean
        latency_ms: number
        error: string
      }
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Ulanish muvaffaqiyatli (${data.latency_ms}ms)`)
      } else {
        toast.error(`Sinov: ${data.error || 'Kutilgan javob kelmadi'}`)
      }
      onChanged()
    },
    onError: (e) => toast.error(fmtError(e, 'Sinov bajarilmadi')),
  })

  const activateMut = useMutation({
    mutationFn: async () => {
      return (await api.post(`/super/ai-providers/${config.id}/activate/`)).data
    },
    onSuccess: () => {
      toast.success(`${config.provider_display} endi aktiv`)
      onChanged()
    },
    onError: (e) => toast.error(fmtError(e, 'Aktiv qilib bo\'lmadi')),
  })

  const activateClick = () => {
    if (!config.is_configured) {
      toast.error('Avval API key kiriting')
      return
    }
    const ok = window.confirm(
      `${config.provider_display}'ni aktiv qilasizmi? Boshqa provider'lar deaktivlanadi.`,
    )
    if (!ok) return
    activateMut.mutate()
  }

  const cardBorder = config.is_active
    ? 'border-brand-500 ring-1 ring-brand-500/40'
    : 'border-slate-200'

  return (
    <div className={`rounded-2xl border-2 bg-white p-6 shadow-sm ${cardBorder}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-slate-900">
              {config.provider_display}
            </h3>
            {config.is_active && (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-700">
                Aktiv
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            {config.is_configured ? (
              <>
                <Key size={12} />
                <span>API key o'rnatilgan</span>
              </>
            ) : (
              <>
                <AlertTriangle size={12} className="text-amber-500" />
                <span>API key kiritilmagan</span>
              </>
            )}
          </p>
        </div>

        {!config.is_active && config.is_configured && (
          <button
            onClick={activateClick}
            disabled={activateMut.isPending}
            className={btnPrimary}
          >
            <Zap size={14} />
            {activateMut.isPending ? '…' : 'Aktiv qilish'}
          </button>
        )}
      </div>

      {/* Model selector */}
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Model
        </span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {config.available_models.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      {/* API key */}
      <div className="mb-4">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
          API key
        </span>
        {!showKeyInput && config.is_configured && (
          <div className="flex items-center gap-2">
            <code
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-600"
            >
              {config.masked_key}
            </code>
            <button
              type="button"
              onClick={() => setShowKeyInput(true)}
              className={btnOutline}
            >
              Yangilash
            </button>
          </div>
        )}
        {(showKeyInput || !config.is_configured) && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={revealKey ? 'text' : 'password'}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={placeholderFor(config.provider)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setRevealKey((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-700"
              >
                {revealKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {showKeyInput && config.is_configured && (
              <button
                type="button"
                onClick={() => {
                  setShowKeyInput(false)
                  setNewKey('')
                }}
                className={btnOutline}
              >
                Bekor
              </button>
            )}
          </div>
        )}
        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <Lock size={10} />
          Saqlangach faqat oxirgi 4 belgi ko'rinadi. To'liq matn shifrlangan
          holda DB'da.
        </p>
        {!encryptionAvailable && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
            <strong>Diqqat:</strong>{' '}
            <code className="rounded bg-amber-100 px-1">AI_PROVIDER_ENCRYPTION_KEY</code>{' '}
            <code>.env</code>'da o'rnatilmagan — kalit shifrlab saqlanmaydi.
          </p>
        )}
      </div>

      {/* Last test result */}
      {config.last_test_at && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${
            config.last_test_success
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {config.last_test_success ? (
            <CheckCircle2 size={14} className="shrink-0" />
          ) : (
            <XCircle size={14} className="shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold">
              Oxirgi sinov: {fmtDate(config.last_test_at)}
              {config.last_test_latency_ms != null && (
                <span className="font-mono"> · {config.last_test_latency_ms}ms</span>
              )}
            </p>
            {config.last_test_error && (
              <p className="mt-0.5 truncate text-[11px] opacity-80">
                {config.last_test_error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={
            saveMut.isPending
            || (!newKey.trim() && model === config.model_name)
          }
          className={btnPrimary}
        >
          {saveMut.isPending ? '…' : 'Saqlash'}
        </button>
        <button
          type="button"
          onClick={() => testMut.mutate()}
          disabled={testMut.isPending || !config.is_configured}
          className={btnOutline}
        >
          {testMut.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Sinab ko'rilmoqda…
            </>
          ) : (
            <>
              <Sparkles size={14} /> Sinash
            </>
          )}
        </button>
        <span className="ml-auto text-[11px] text-slate-400">
          Yangilangan: {fmtDate(config.last_updated_at)}
          {config.last_updated_by && ` · ${config.last_updated_by}`}
        </span>
      </div>
    </div>
  )
}

function AuditLogFeed({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        Hozircha o'zgartirishlar yo'q
      </p>
    )
  }
  return (
    <ul className="divide-y divide-slate-100">
      {logs.map((log) => (
        <li key={log.id} className="py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-bold text-slate-900">{log.action}</span>
                <span className="text-slate-500"> · {log.provider}</span>
              </p>
              {(log.old_value || log.new_value) && (
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {log.old_value || '∅'}{' → '}
                  <span className="font-semibold text-slate-700">
                    {log.new_value || '∅'}
                  </span>
                </p>
              )}
              {log.test_success === false && log.test_error && (
                <p className="mt-0.5 text-[12px] text-rose-700">
                  ✗ {log.test_error}
                </p>
              )}
              {log.test_success === true && (
                <p className="mt-0.5 text-[12px] text-emerald-700">✓ Sinov OK</p>
              )}
            </div>
            <div className="text-right text-[11px] text-slate-400">
              <p>{log.performed_by}</p>
              <p>{fmtDate(log.created_at)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function SuperAdminAIProvidersPage() {
  const qc = useQueryClient()

  const listQ = useQuery({
    queryKey: ['super-ai-providers'],
    queryFn: async () =>
      (await api.get<ListResponse>('/super/ai-providers/')).data,
  })

  const auditQ = useQuery({
    queryKey: ['super-ai-providers-audit'],
    queryFn: async () =>
      (await api.get<AuditResponse>('/super/ai-providers/audit-log/')).data,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['super-ai-providers'] })
    qc.invalidateQueries({ queryKey: ['super-ai-providers-audit'] })
    qc.invalidateQueries({ queryKey: ['ai-quota'] })
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            AI Provider sozlamalari
          </h1>
          <p className="mt-1.5 text-slate-600">
            PDF parse uchun ishlatiladigan AI provider va API kalitlarini
            boshqaring. Kalitlar Fernet shifrlash bilan DB'da saqlanadi.
          </p>
        </div>

        {listQ.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Yuklanmoqda…
          </div>
        ) : listQ.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            Ma'lumot olinmadi. Faqat superadmin kira oladi.
          </div>
        ) : (
          <div className="space-y-4">
            {(listQ.data?.providers ?? []).map((c) => (
              <ProviderCard
                key={c.id}
                config={c}
                onChanged={refresh}
                encryptionAvailable={!!listQ.data?.encryption_available}
              />
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <History size={16} className="text-slate-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              Oxirgi o'zgartirishlar
            </h2>
          </div>
          {auditQ.isLoading ? (
            <p className="py-6 text-center text-sm text-slate-400">
              <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" />
            </p>
          ) : (
            <AuditLogFeed logs={auditQ.data?.logs ?? []} />
          )}
        </div>
      </div>
    </SuperAdminLayout>
  )
}
