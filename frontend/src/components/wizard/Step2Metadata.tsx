import type { WizardData } from './types'

export function Step2Metadata({
  data,
  setData,
}: {
  data: WizardData
  setData: (d: WizardData) => void
}) {
  return (
    <div className="rounded-2xl border bg-white p-8">
      <div className="mb-1 text-xs uppercase tracking-widest text-orange-600">
        Qadam 2
      </div>
      <h2 className="mb-6 text-2xl text-slate-900">Test ma'lumotlari</h2>

      <div className="space-y-4">
        <Field label="Test nomi *">
          <input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Cambridge IELTS 19 — Test 2"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Qiyinlik">
            <select
              value={data.difficulty}
              onChange={(e) =>
                setData({ ...data, difficulty: e.target.value as WizardData['difficulty'] })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
            >
              <option value="easy">Easy (5.0–6.0)</option>
              <option value="medium">Medium (6.0–7.0)</option>
              <option value="hard">Hard (7.0–8.5)</option>
            </select>
          </Field>

          <Field label="Tur">
            <select
              value={data.test_type}
              onChange={(e) =>
                setData({ ...data, test_type: e.target.value as WizardData['test_type'] })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
            >
              <option value="academic">Academic</option>
              <option value="general">General Training</option>
            </select>
          </Field>

          <Field label="Davomiyligi (min)">
            <input
              type="number"
              min={5}
              value={data.duration_minutes}
              onChange={(e) =>
                setData({
                  ...data,
                  duration_minutes: parseInt(e.target.value, 10) || 30,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
            />
          </Field>
        </div>

        <Field label="Kategoriya (ixtiyoriy)">
          <input
            value={data.category}
            onChange={(e) => setData({ ...data, category: e.target.value })}
            placeholder="Cambridge seriyasi"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>

        <Field label="Tavsif (ixtiyoriy)">
          <textarea
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-slate-900"
          />
        </Field>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      {children}
    </div>
  )
}
