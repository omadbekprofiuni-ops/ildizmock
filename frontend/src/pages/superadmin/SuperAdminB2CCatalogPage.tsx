import { useEffect, useMemo, useState } from 'react'

import {
  Chip,
  PageHeader,
  PageShell,
  TableCard,
  adminTable,
} from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'
import SuperAdminLayout from '@/pages/superadmin/SuperAdminLayout'

interface SuperTestRow {
  id: string
  name: string
  module: string
  difficulty: string
  status: string
  duration_minutes: number
  questions_count: number
  available_for_b2c: boolean
  b2c_published_at: string | null
  b2c_display_name: string
  b2c_description: string
  source: string
  source_custom_name: string
  source_display: string
}

const MODULE_LABEL: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  full_mock: 'Full Mock',
}

// ETAP 16.6 — backend Test.Source TextChoices bilan sinxron.
const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'cambridge_7', label: 'Cambridge 7' },
  { value: 'cambridge_8', label: 'Cambridge 8' },
  { value: 'cambridge_9', label: 'Cambridge 9' },
  { value: 'cambridge_10', label: 'Cambridge 10' },
  { value: 'cambridge_11', label: 'Cambridge 11' },
  { value: 'cambridge_12', label: 'Cambridge 12' },
  { value: 'cambridge_13', label: 'Cambridge 13' },
  { value: 'cambridge_14', label: 'Cambridge 14' },
  { value: 'cambridge_15', label: 'Cambridge 15' },
  { value: 'cambridge_16', label: 'Cambridge 16' },
  { value: 'cambridge_17', label: 'Cambridge 17' },
  { value: 'cambridge_18', label: 'Cambridge 18' },
  { value: 'cambridge_19', label: 'Cambridge 19' },
  { value: 'cambridge_20', label: 'Cambridge 20' },
  { value: 'real_exam_2024', label: 'Real Exam 2024' },
  { value: 'real_exam_2025', label: 'Real Exam 2025' },
  { value: 'real_exam_2026', label: 'Real Exam 2026' },
  { value: 'ildiz_original', label: 'ILDIZ Original' },
  { value: 'other', label: 'Boshqa' },
]

const STATUS_CHOICES: Array<['all' | 'published' | 'unpublished', string]> = [
  ['all', 'Hammasi'],
  ['published', 'Katalogda'],
  ['unpublished', 'Katalogda emas'],
]

const SECTION_CHOICES: Array<[string, string]> = [
  ['all', 'Barcha bo\'limlar'],
  ['listening', 'Listening'],
  ['reading', 'Reading'],
  ['writing', 'Writing'],
  ['full_mock', 'Full Mock'],
]

export default function SuperAdminB2CCatalogPage() {
  const [tests, setTests] = useState<SuperTestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'unpublished'>('all')
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDisplay, setEditDisplay] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSource, setEditSource] = useState('other')
  const [editSourceCustomName, setEditSourceCustomName] = useState('')

  const load = () => {
    setLoading(true)
    api
      .get<SuperTestRow[]>('/super/tests/')
      .then((r) => setTests(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      if (statusFilter === 'published' && !t.available_for_b2c) return false
      if (statusFilter === 'unpublished' && t.available_for_b2c) return false
      if (sectionFilter !== 'all' && t.module !== sectionFilter) return false
      if (search) {
        const haystack = `${t.name} ${t.b2c_display_name}`.toLowerCase()
        if (!haystack.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [tests, statusFilter, sectionFilter, search])

  const publishedCount = tests.filter((t) => t.available_for_b2c).length

  const toggleB2C = async (test: SuperTestRow) => {
    try {
      await api.post(`/super/tests/${test.id}/toggle-b2c/`)
      const action = test.available_for_b2c ? 'olib tashlandi' : 'chiqarildi'
      toast.success(`"${test.name}" katalogdan ${action}`)
      load()
    } catch {
      toast.error("Saqlanmadi. Qaytadan urinib ko'ring.")
    }
  }

  const startEdit = (t: SuperTestRow) => {
    setEditingId(t.id)
    setEditDisplay(t.b2c_display_name)
    setEditDescription(t.b2c_description)
    setEditSource(t.source || 'other')
    setEditSourceCustomName(t.source_custom_name || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDisplay('')
    setEditDescription('')
    setEditSource('other')
    setEditSourceCustomName('')
  }

  const saveEdit = async (id: string) => {
    try {
      await api.patch(`/super/tests/${id}/b2c-meta/`, {
        b2c_display_name: editDisplay,
        b2c_description: editDescription,
        source: editSource,
        // source !== 'other' bo'lsa custom_name'ni bo'shatamiz, chalkashlik bo'lmasin.
        source_custom_name:
          editSource === 'other' ? editSourceCustomName : '',
      })
      toast.success("B2C ma'lumotlari saqlandi")
      cancelEdit()
      load()
    } catch {
      toast.error("Saqlanmadi. Qaytadan urinib ko'ring.")
    }
  }

  return (
    <SuperAdminLayout>
      <PageShell>
        <PageHeader
          title="B2C Catalog boshqaruvi"
          subtitle="Individual foydalanuvchilarga ochiq testlarni nazorat qiling"
          actions={
            <div className="text-right">
              <p className="text-2xl font-extrabold text-brand-600">{publishedCount}</p>
              <p className="text-xs text-slate-500">
                {tests.length} testdan publish qilingan
              </p>
            </div>
          }
        />

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Test nomi bo'yicha qidirish…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_CHOICES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {SECTION_CHOICES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <TableCard>
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th className={adminTable.th}>B2C</th>
                <th className={adminTable.th}>Name</th>
                <th className={adminTable.th}>Modul</th>
                <th className={adminTable.th}>Daraja</th>
                <th className={adminTable.th}>Savollar</th>
                <th className={adminTable.th}>Chiqarilgan</th>
                <th className={adminTable.th + ' text-right'}>Amal</th>
              </tr>
            </thead>
            <tbody className={adminTable.tbody}>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                    Hech narsa topilmadi.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className={adminTable.trHover}>
                    <td className={adminTable.td}>
                      <button
                        type="button"
                        onClick={() => toggleB2C(t)}
                        title={t.available_for_b2c ? 'Katalogdan olib tashlash' : 'Katalogga chiqarish'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          t.available_for_b2c ? 'bg-brand-500' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            t.available_for_b2c ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className={adminTable.td}>
                      <div className="font-semibold text-slate-900">
                        {t.b2c_display_name || t.name}
                        {t.available_for_b2c && (
                          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">
                            B2C
                          </span>
                        )}
                      </div>
                      {t.b2c_display_name && (
                        <div className="text-xs text-slate-500">
                          asl nom: {t.name}
                        </div>
                      )}
                      {t.source_display && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          Manba: {t.source_display}
                        </div>
                      )}
                      {editingId === t.id && (
                        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                          <input
                            type="text"
                            value={editDisplay}
                            onChange={(e) => setEditDisplay(e.target.value)}
                            placeholder="B2C uchun ko'rsatiladigan nom (ixtiyoriy)"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={3}
                            placeholder="B2C foydalanuvchilar uchun tavsif (ixtiyoriy)"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                          />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <select
                              value={editSource}
                              onChange={(e) => setEditSource(e.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                            >
                              {SOURCE_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            {editSource === 'other' && (
                              <input
                                type="text"
                                value={editSourceCustomName}
                                onChange={(e) =>
                                  setEditSourceCustomName(e.target.value)
                                }
                                placeholder="Erkin manba nomi (masalan, IELTS Original 2026)"
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                              />
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(t.id)}
                              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
                            >
                              Saqlash
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                            >
                              Bekor qilish
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className={adminTable.td}>
                      <Chip tone="indigo">
                        {MODULE_LABEL[t.module] ?? t.module}
                      </Chip>
                    </td>
                    <td className={adminTable.td + ' text-slate-700'}>
                      {t.difficulty}
                    </td>
                    <td className={adminTable.td + ' text-slate-700'}>
                      {t.questions_count}
                    </td>
                    <td className={adminTable.td + ' text-slate-500'}>
                      {t.b2c_published_at
                        ? new Date(t.b2c_published_at).toLocaleDateString('uz-UZ')
                        : '—'}
                    </td>
                    <td className={adminTable.td + ' text-right'}>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        B2C ma'lumotlari
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableCard>
      </PageShell>
    </SuperAdminLayout>
  )
}
