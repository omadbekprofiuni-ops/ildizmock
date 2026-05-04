const STEPS = [
  { n: 1, label: 'Test turi' },
  { n: 2, label: 'Informationlar' },
  { n: 3, label: 'Kontent' },
  { n: 4, label: 'Savollar' },
  { n: 5, label: 'Publish' },
]

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border bg-white p-4">
      {STEPS.map((s, i) => {
        const done = currentStep > s.n
        const active = currentStep === s.n
        return (
          <div key={s.n} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? 'bg-green-600 text-white'
                  : active
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 text-slate-400'
              }`}
            >
              {done ? '✓' : s.n}
            </div>
            <div
              className={`whitespace-nowrap text-xs ${
                active ? 'font-semibold text-slate-900' : 'text-slate-500'
              }`}
            >
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 ${
                  done ? 'bg-green-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
