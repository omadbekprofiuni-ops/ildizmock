import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import SuperAdminLayout from './SuperAdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Plan = {
  id: number
  code: string
  name: string
  max_students: number
  max_teachers: number
  duration_days: number
  price_usd: string
  features: string[]
}

type PlanForm = {
  id?: number
  code: string
  name: string
  max_students: number
  max_teachers: number
  duration_days: number
  price_usd: string
  features: string
}

const EMPTY: PlanForm = {
  code: 'starter',
  name: '',
  max_students: 50,
  max_teachers: 5,
  duration_days: 30,
  price_usd: '0',
  features: '',
}

const CODE_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
]

function formatApiError(data: unknown, fallback: string): string {
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.detail === 'string') return obj.detail
    const first = Object.entries(obj)[0]
    if (first) {
      const [field, value] = first
      const msg = Array.isArray(value) ? String(value[0]) : String(value)
      return field === 'detail' || field === 'non_field_errors'
        ? msg
        : `${field}: ${msg}`
    }
  }
  return fallback
}

export default function SuperAdminSettingsPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<PlanForm | null>(null)
  useEffect(() => { document.title = 'ILDIZmock — Settings' }, [])

  const query = useQuery({
    queryKey: ['super-plans'],
    queryFn: async () => (await api.get<Plan[]>('/super/plans/')).data,
  })

  const upsert = useMutation({
    mutationFn: async (form: PlanForm) => {
      const payload = {
        code: form.code,
        name: form.name,
        max_students: Number(form.max_students),
        max_teachers: Number(form.max_teachers),
        duration_days: Number(form.duration_days),
        price_usd: form.price_usd,
        features: form.features
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }
      if (form.id) {
        return (await api.patch(`/super/plans/${form.id}/`, payload)).data
      }
      return (await api.post('/super/plans/', payload)).data
    },
    onSuccess: () => {
      toast.success('Plan saved')
      qc.invalidateQueries({ queryKey: ['super-plans'] })
      setEditing(null)
    },
    onError: (err) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(formatApiError(data, 'Save failed'))
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) =>
      (await api.delete(`/super/plans/${id}/`)).data,
    onSuccess: () => {
      toast.success('Plan o‘chirildi')
      qc.invalidateQueries({ queryKey: ['super-plans'] })
    },
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(detail || "Couldn't delete")
    },
  })

  const startEdit = (plan: Plan) => {
    setEditing({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      max_students: plan.max_students,
      max_teachers: plan.max_teachers,
      duration_days: plan.duration_days,
      price_usd: plan.price_usd,
      features: (plan.features || []).join('\n'),
    })
  }

  return (
    <SuperAdminLayout>
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-slate-500">
              Platform plans. Selected when creating a center.
            </p>
          </div>
          <Button
            onClick={() => {
              const used = new Set((query.data ?? []).map((p) => p.code))
              const free = CODE_OPTIONS.find((o) => !used.has(o.value))
              if (!free) {
                toast.error(
                  'All 4 plan codes (trial/starter/pro/enterprise) are taken. Edit an existing plan.',
                )
                return
              }
              setEditing({ ...EMPTY, code: free.value })
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New plan
          </Button>
        </div>

        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && (
          <p className="text-rose-600">Couldn't load plans.</p>
        )}

        {query.data && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Kod</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3 text-center">Students</th>
                      <th className="px-4 py-3 text-center">Teachers</th>
                      <th className="px-4 py-3 text-center">Davomiylik</th>
                      <th className="px-4 py-3 text-right">Price ($)</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {query.data.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs uppercase">{p.code}</td>
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-center">
                          {p.max_students === -1 ? '∞' : p.max_students}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.max_teachers === -1 ? '∞' : p.max_teachers}
                        </td>
                        <td className="px-4 py-3 text-center">{p.duration_days} days</td>
                        <td className="px-4 py-3 text-right font-mono">
                          ${Number(p.price_usd).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(p)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (
                                  confirm(`"${p.name}" planini o‘chirilsinmi?`)
                                ) {
                                  remove.mutate(p.id)
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {query.data.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          Hozircha planlar yo‘q.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {editing && (
          <PlanModal
            form={editing}
            onChange={setEditing}
            onClose={() => setEditing(null)}
            onSave={() => upsert.mutate(editing)}
            saving={upsert.isPending}
            usedCodes={
              new Set(
                (query.data ?? [])
                  .filter((p) => p.id !== editing.id)
                  .map((p) => p.code),
              )
            }
          />
        )}
      </div>
    </SuperAdminLayout>
  )
}

function PlanModal({
  form, onChange, onClose, onSave, saving, usedCodes,
}: {
  form: PlanForm
  onChange: (form: PlanForm) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  usedCodes: Set<string>
}) {
  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) =>
    onChange({ ...form, [key]: value })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-6 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {form.id ? 'Edit plan' : 'New plan'}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kod">
              <select
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                disabled={Boolean(form.id)}
                className="w-full rounded-md border px-3 py-2 focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                {CODE_OPTIONS.filter(
                  (o) => o.value === form.code || !usedCodes.has(o.value),
                ).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name">
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Pro center"
                className="w-full rounded-md border px-3 py-2 focus:border-slate-900 focus:outline-none"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Students (-1 = ∞)">
              <input
                type="number"
                value={form.max_students}
                onChange={(e) => set('max_students', Number(e.target.value))}
                className="w-full rounded-md border px-3 py-2 font-mono focus:border-slate-900 focus:outline-none"
              />
            </Field>
            <Field label="Teachers (-1 = ∞)">
              <input
                type="number"
                value={form.max_teachers}
                onChange={(e) => set('max_teachers', Number(e.target.value))}
                className="w-full rounded-md border px-3 py-2 font-mono focus:border-slate-900 focus:outline-none"
              />
            </Field>
            <Field label="Duration (days)">
              <input
                type="number"
                value={form.duration_days}
                onChange={(e) => set('duration_days', Number(e.target.value))}
                className="w-full rounded-md border px-3 py-2 font-mono focus:border-slate-900 focus:outline-none"
              />
            </Field>
          </div>
          <Field label="Price (USD)">
            <input
              value={form.price_usd}
              onChange={(e) => set('price_usd', e.target.value)}
              placeholder="49.00"
              className="w-full rounded-md border px-3 py-2 font-mono focus:border-slate-900 focus:outline-none"
            />
          </Field>
          <Field label="Features (one per line)">
            <textarea
              rows={4}
              value={form.features}
              onChange={(e) => set('features', e.target.value)}
              placeholder={'Mock testlar\nWriting baholash\nSertifikat'}
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  )
}
