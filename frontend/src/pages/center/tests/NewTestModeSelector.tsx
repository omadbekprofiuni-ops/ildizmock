import { useNavigate, useParams } from 'react-router-dom'

interface ModeCard {
  to: string
  emoji: string
  title: string
  blurb: string
  time: string
  recommended?: boolean
}

const buildModes = (slug?: string): ModeCard[] => {
  const base = slug ? `/${slug}/admin/tests` : '/admin/tests'
  return [
    {
      to: `${base}/new/smart-paste`,
      emoji: '📋',
      title: 'Smart Paste',
      blurb:
        "Passage, savollar va javob kalitini yopishtiring — biz har bir savol turini avtomatik aniqlaymiz.",
      time: '5–8 daqiqa',
      recommended: true,
    },
    {
      to: `${base}/new/import-excel`,
      emoji: '📊',
      title: 'Excel Template',
      blurb: 'Tayyor jadval shabloniga savollar yozib, ko\'plab testni bir vaqtda yuklang.',
      time: '~3 daqiqa',
    },
    {
      to: `${base}/new`,
      emoji: '✏️',
      title: 'Manual Wizard',
      blurb: "Savol-savol qo'l bilan yaratish — odatdagidan farqli savol turlari uchun.",
      time: '45–60 daqiqa',
    },
  ]
}

export default function NewTestModeSelector() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug?: string }>()
  const modes = buildModes(slug)

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Yangi test yaratish</h1>
      <p className="mt-1 text-slate-600">
        Materialingiz uchun eng tezkor usulni tanlang.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {modes.map((m) => (
          <button
            key={m.to}
            onClick={() => navigate(m.to)}
            className="relative flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-brand-500 hover:shadow-md"
          >
            {m.recommended && (
              <span className="absolute right-4 top-4 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                Tavsiya
              </span>
            )}
            <span className="text-3xl">{m.emoji}</span>
            <h2 className="text-lg font-semibold text-slate-900">{m.title}</h2>
            <p className="text-sm text-slate-600">{m.blurb}</p>
            <span className="mt-auto text-xs font-medium text-slate-500">
              {m.time}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
