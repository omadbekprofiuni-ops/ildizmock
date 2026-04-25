import {
  BookOpen,
  Check,
  ClipboardList,
  Globe,
  Headphones,
  LineChart,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/stores/auth'

export default function LandingPage() {
  const user = useAuth((s) => s.user)
  const initialised = useAuth((s) => s.initialised)
  const navigate = useNavigate()

  useEffect(() => {
    if (initialised && user) navigate('/home', { replace: true })
  }, [initialised, user, navigate])

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <Testimonial />
      <Pricing />
      <Footer />
    </div>
  )
}

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          IELTSation
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Kirish
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Ro‘yxatdan o‘tish</Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container grid items-center gap-10 py-20 md:grid-cols-2 md:py-28">
        <div>
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs font-medium text-amber-300">
            <Sparkles className="h-3.5 w-3.5" /> O‘zbekistondagi #1 IELTS CD mock platformasi
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            IELTS testini <span className="text-amber-300">haqiqiy formatda</span> sinab ko‘ring
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">
            Computer-delivered test interfeysi, avtomatik band hisobi va Uzbek UI.
            Britaniya Kengashi narxidan 10 barobar arzon.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register">
              <Button size="lg" className="bg-amber-400 text-slate-900 hover:bg-amber-300">
                Bepul boshlash →
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-600 bg-transparent text-white hover:bg-slate-800"
              >
                Hisobingiz bormi?
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            ✓ Kredit karta kerak emas · ✓ 3 ta bepul mock test · ✓ Darhol natija
          </p>
        </div>
        <div className="relative hidden md:block">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-1 shadow-2xl">
            <div className="rounded-lg bg-slate-900 p-5 text-xs">
              <div className="mb-3 flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="font-semibold">The Concept of Intelligence</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-amber-300">
                  18:42
                </span>
              </div>
              <p className="mb-3 leading-relaxed text-slate-300">
                Much that has been written on the subject of intelligence owes more to
                investment in particular theoretical frameworks than to solid empirical
                research...
              </p>
              <div className="rounded border border-slate-700 bg-slate-800/50 p-3">
                <p className="mb-2 font-medium">1. Intelligence is best described as:</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 rounded bg-slate-900 px-2 py-1.5">
                    <span className="h-3 w-3 rounded-full border border-slate-600" />
                    <span className="text-slate-400">A single inherited ability</span>
                  </div>
                  <div className="flex items-center gap-2 rounded border border-amber-400 bg-amber-400/10 px-2 py-1.5">
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span>A collection of different abilities</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-1.5">
                {['1', '2', '3', '4', '5'].map((n, i) => (
                  <div
                    key={n}
                    className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-medium ${
                      i === 0 ? 'bg-amber-400 text-slate-900' : i < 3 ? 'bg-slate-700' : 'border border-slate-700'
                    }`}
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const items = [
    { value: '1,500+', label: 'o‘quvchi' },
    { value: '50+', label: 'mock test' },
    { value: '6.8', label: 'o‘rtacha band' },
    { value: '4.9/5', label: 'reyting' },
  ]
  return (
    <section className="border-b bg-slate-50 py-12">
      <div className="container">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-slate-900 md:text-4xl">{s.value}</div>
              <div className="mt-1 text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  const items = [
    {
      Icon: BookOpen,
      title: 'Haqiqiy IELTS interfeysi',
      desc: 'CD test interfeysi pixel darajasida ko‘chirilgan — Reading, Listening, Writing hammasi bir xil.',
    },
    {
      Icon: Zap,
      title: 'Avto-scoring darhol',
      desc: 'Topshirgan zahoti band score va breakdown. Kutishga hojat yo‘q.',
    },
    {
      Icon: Globe,
      title: 'Uzbek UI',
      desc: 'Barcha tugmalar va ko‘rsatmalar o‘zbek tilida — testni tushunib bajaring.',
    },
    {
      Icon: Headphones,
      title: 'Barcha 4 modul',
      desc: 'Reading + Listening (avto) va Writing + Speaking (AI feedback — tez orada).',
    },
    {
      Icon: LineChart,
      title: 'Progress tahlili',
      desc: 'Har topshirigingiz tarixi, kuchli/zaif mavzular, vaqt bo‘yicha o‘sish grafigi.',
    },
    {
      Icon: ClipboardList,
      title: 'Review rejimi',
      desc: 'Xato javoblarni batafsil ko‘ring — to‘g‘ri javob bilan yonma-yon.',
    },
  ]
  return (
    <section className="py-20">
      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Nima uchun <span className="text-amber-500">IELTSation</span>?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Bilimingizni ishonchli tekshirish uchun kerakli hamma narsa bir joyda.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ Icon, title, desc }) => (
            <Card key={title}>
              <CardContent className="p-6">
                <div className="mb-4 inline-flex rounded-lg bg-slate-900 p-2.5 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="mb-2 text-lg">{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonial() {
  return (
    <section className="border-y bg-slate-50 py-20">
      <div className="container max-w-3xl">
        <div className="rounded-2xl border bg-white p-8 md:p-10">
          <div className="mb-4 flex items-center gap-1 text-amber-400">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
          </div>
          <p className="text-xl leading-relaxed text-slate-800 md:text-2xl">
            “Britaniya Kengashining rasmiy testidan keyin IELTSation'da ham
            o‘sha 7.5 bandni oldim. Interfeys aynan o‘sha — bu juda muhim edi.”
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
              AK
            </div>
            <div>
              <div className="font-semibold text-slate-900">Asal Karimova</div>
              <div className="text-sm text-muted-foreground">IELTS 7.5 · Toshkent</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const plans = [
    {
      name: 'Bepul',
      price: '0',
      period: 'so‘m',
      highlight: false,
      features: [
        '3 ta bepul demo mock test',
        'Avtomatik Reading/Listening scoring',
        'Review rejimi',
        'Progress tarixi',
      ],
      cta: 'Bepul boshlash',
      href: '/register',
    },
    {
      name: 'Standart',
      price: '149,000',
      period: 'so‘m/oy',
      highlight: true,
      features: [
        'Cheksiz Reading + Listening',
        'Barcha mavzular bo‘yicha testlar',
        'Review rejimi + progress tahlili',
        'Email orqali natija yig‘indisi',
      ],
      cta: 'Boshlash',
      href: '/register',
    },
    {
      name: 'Premium',
      price: '399,000',
      period: 'so‘m/oy',
      highlight: false,
      features: [
        'Standart ning hammasi',
        'AI Writing feedback (Claude)',
        'AI Speaking baholash (Whisper)',
        '1-on-1 o‘qituvchi sessiyasi',
      ],
      cta: 'Premiumga o‘tish',
      href: '/register',
    },
  ]

  return (
    <section className="py-20">
      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Arzon narxlar</h2>
          <p className="mt-3 text-muted-foreground">
            Britaniya Kengashi narxidan 10 barobar arzon. Istalgan vaqtda bekor qiling.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.name}
              className={`relative ${p.highlight ? 'border-slate-900 shadow-lg' : ''}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-semibold text-slate-900">
                  Eng mashhur
                </span>
              )}
              <CardContent className="p-6">
                <CardTitle className="text-xl">{p.name}</CardTitle>
                <div className="mt-3">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="ml-1 text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="text-slate-700">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to={p.href} className="mt-6 block">
                  <Button
                    className="w-full"
                    variant={p.highlight ? 'default' : 'outline'}
                  >
                    {p.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t bg-slate-900 py-10 text-slate-400">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
        <div>© 2026 IELTSation. Tashkent, Uzbekistan.</div>
        <div className="flex gap-4">
          <Link to="/login" className="hover:text-white">Kirish</Link>
          <Link to="/register" className="hover:text-white">Ro‘yxatdan o‘tish</Link>
        </div>
      </div>
    </footer>
  )
}
