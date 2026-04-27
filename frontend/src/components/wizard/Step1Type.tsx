import type { WizardData, WizardModule } from './types'

const TYPES: { id: WizardModule; label: string; icon: string; meta: string }[] = [
  { id: 'listening', label: 'Listening', icon: '🎧', meta: '30 min, 4 part, 40 savol' },
  { id: 'reading', label: 'Reading', icon: '📖', meta: '60 min, 3 passage, 40 savol' },
  { id: 'writing', label: 'Writing', icon: '✍️', meta: '60 min, 2 task' },
  { id: 'full_mock', label: 'To\'liq mock', icon: '📋', meta: '2s 30m, hammasi' },
]

export function Step1Type({
  data,
  setData,
}: {
  data: WizardData
  setData: (d: WizardData) => void
}) {
  return (
    <div className="rounded-2xl border bg-white p-8">
      <div className="mb-1 text-xs uppercase tracking-widest text-orange-600">
        Qadam 1
      </div>
      <h2 className="mb-6 text-2xl text-slate-900">Test turini tanlang</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TYPES.map((t) => {
          const active = data.module === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setData({ ...data, module: t.id })}
              className={`rounded-xl border-2 p-5 text-left transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 hover:border-orange-500'
              }`}
            >
              <div className="mb-2 text-3xl">{t.icon}</div>
              <div className="mb-1 font-semibold">{t.label}</div>
              <div
                className={`text-xs ${
                  active ? 'text-orange-200' : 'text-slate-500'
                }`}
              >
                {t.meta}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
