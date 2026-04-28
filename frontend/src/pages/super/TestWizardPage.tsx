import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import SuperAdminLayout from '@/pages/superadmin/SuperAdminLayout'
import { Step1Type } from '@/components/wizard/Step1Type'
import { Step2Metadata } from '@/components/wizard/Step2Metadata'
import { Step3Content } from '@/components/wizard/Step3Content'
import { Step4Questions } from '@/components/wizard/Step4Questions'
import { Step5Review } from '@/components/wizard/Step5Review'
import { Stepper } from '@/components/wizard/Stepper'
import type { WizardData } from '@/components/wizard/types'
import { api } from '@/lib/api'

export default function TestWizardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [step, setStep] = useState(1)
  const [testId, setTestId] = useState<string | null>(id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [data, setData] = useState<WizardData>({
    module: 'listening',
    name: '',
    difficulty: 'medium',
    test_type: 'academic',
    description: '',
    category: '',
    duration_minutes: 30,
  })

  useEffect(() => {
    if (!id) return
    api.get(`/super/tests/${id}/`).then((r) => {
      const t = r.data
      setData({
        module: t.module,
        name: t.name,
        difficulty: t.difficulty,
        test_type: t.test_type,
        description: t.description ?? '',
        category: t.category ?? '',
        duration_minutes: t.duration_minutes,
      })
    })
  }, [id])

  const next = () => setStep((s) => Math.min(5, s + 1))
  const back = () => setStep((s) => Math.max(1, s - 1))

  const createOrUpdate = async () => {
    setError('')
    setSaving(true)
    try {
      if (!testId) {
        const r = await api.post('/super/tests/', data)
        setTestId(r.data.id)
      } else {
        await api.patch(`/super/tests/${testId}/`, data)
      }
      next()
    } catch (e: unknown) {
      const err = e as { response?: { data?: Record<string, unknown> } }
      const detail =
        (err.response?.data?.name as string[] | undefined)?.[0] ??
        (err.response?.data?.detail as string | undefined) ??
        'Saqlashda xatolik'
      setError(detail)
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    if (!testId) return
    setSaving(true)
    try {
      await api.post(`/super/tests/${testId}/publish/`)
      navigate('/super/tests')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto max-w-7xl p-6 sm:p-8">
        <header className="mb-6">
          <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">
            <Link to="/super/tests" className="hover:text-orange-600">
              Testlar
            </Link>{' '}
            / {testId ? 'Tahrirlash' : 'Yangi'}
          </div>
          <h1 className="text-3xl font-light text-slate-900 sm:text-4xl">
            {testId ? 'Testni tahrirlash' : 'Yangi test '}
            {!testId && <em className="italic text-orange-600">yaratish.</em>}
          </h1>
        </header>

        <Stepper currentStep={step} />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {step === 1 && <Step1Type data={data} setData={setData} />}
            {step === 2 && <Step2Metadata data={data} setData={setData} />}
            {step === 3 && testId && (
              <Step3Content testId={testId} module={data.module} />
            )}
            {step === 4 && testId && (
              <Step4Questions testId={testId} module={data.module} />
            )}
            {step === 5 && testId && <Step5Review testId={testId} />}

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={back}
                disabled={step === 1}
                className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30"
              >
                ← Orqaga
              </button>

              {step === 2 ? (
                <button
                  type="button"
                  onClick={createOrUpdate}
                  disabled={saving || !data.name}
                  className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Saqlanmoqda…' : 'Saqlash va davom →'}
                </button>
              ) : step === 5 ? (
                <button
                  type="button"
                  onClick={publish}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Yuborilmoqda…' : "E'lon qilish ✓"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  disabled={step === 1 ? false : !testId}
                  className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  Keyingisi →
                </button>
              )}
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-6 rounded-2xl border bg-white p-6">
              <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">
                Tekshirish ro'yxati
              </div>
              <ChecklistItem done={step > 1} active={step === 1}>
                Test turi
              </ChecklistItem>
              <ChecklistItem done={step > 2} active={step === 2}>
                Ma'lumotlar
              </ChecklistItem>
              <ChecklistItem done={step > 3} active={step === 3}>
                Kontent
              </ChecklistItem>
              <ChecklistItem done={step > 4} active={step === 4}>
                Savollar
              </ChecklistItem>
              <ChecklistItem done={false} active={step === 5}>
                E'lon qilish
              </ChecklistItem>
            </div>
          </aside>
        </div>
      </div>
    </SuperAdminLayout>
  )
}

function ChecklistItem({
  done,
  active,
  children,
}: {
  done: boolean
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex items-center gap-2 py-2 text-sm ${
        done
          ? 'text-green-600'
          : active
            ? 'font-semibold text-orange-600'
            : 'text-slate-400'
      }`}
    >
      <div className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">
        {done ? '✓' : active ? '●' : '○'}
      </div>
      {children}
    </div>
  )
}
