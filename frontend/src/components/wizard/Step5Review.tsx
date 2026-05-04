import { useEffect, useState } from 'react'

import { api } from '@/lib/api'

import type { WizardTestDetail } from './types'

export function Step5Review({ testId }: { testId: string }) {
  const [test, setTest] = useState<WizardTestDetail | null>(null)

  useEffect(() => {
    api.get<WizardTestDetail>(`/super/tests/${testId}/`).then((r) => setTest(r.data))
  }, [testId])

  if (!test)
    return (
      <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">
        Loading…
      </div>
    )

  const totalQuestions =
    test.listening_parts.reduce((s, p) => s + p.questions.length, 0) +
    test.passages.reduce((s, p) => s + p.questions.length, 0)

  return (
    <div className="rounded-2xl border bg-white p-8">
      <div className="mb-1 text-xs uppercase tracking-widest text-orange-600">
        Qadam 5
      </div>
      <h2 className="mb-2 text-2xl text-slate-900">Yakuniy ko'rib chiqish</h2>
      <p className="mb-6 text-sm text-slate-500">
        Pressing the button below publishes the test to the centers' catalog.
      </p>

      <div className="space-y-3 rounded-xl border bg-slate-50 p-4 text-sm">
        <Row label="Name">{test.name}</Row>
        <Row label="Modul">{test.module}</Row>
        <Row label="Difficulty">{test.difficulty}</Row>
        <Row label="Davomiyligi">{test.duration_minutes} min</Row>
        <Row label="Tur">{test.test_type}</Row>
        <Row label="Status">{test.status}</Row>
        <Row label="Listening parts">{test.listening_parts.length}</Row>
        <Row label="Reading sections">{test.passages.length}</Row>
        <Row label="Writing tasks">{test.writing_tasks.length}</Row>
        <Row label="Total questions">{totalQuestions}</Row>
      </div>

      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        ⚠️ E'lon qilingach, test global katalogga qo'shiladi va markazlar uni
        nusxalay olishadi. Edit istasangiz Draft holatiga qaytaring.
      </div>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex justify-between border-b border-slate-200 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{children}</span>
    </div>
  )
}
