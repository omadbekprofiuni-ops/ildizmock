import { ArrowLeft, ArrowRight, BookOpen, Headphones, PenLine } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader, PageShell } from '@/components/admin-shell'

const MODULES = [
  {
    id: 'listening',
    label: 'Listening',
    Icon: Headphones,
    gradient: 'from-blue-500 to-blue-600',
    desc: 'Audio fayl, transcript, savollar va kerak bo‘lsa rasm.',
  },
  {
    id: 'reading',
    label: 'Reading',
    Icon: BookOpen,
    gradient: 'from-purple-500 to-purple-600',
    desc: 'Passage matnlari va savollar (3 ta passage standart).',
  },
  {
    id: 'writing',
    label: 'Writing',
    Icon: PenLine,
    gradient: 'from-orange-500 to-orange-600',
    desc: "Task 1 (chart/grafik rasmi bilan) va Task 2 sharti.",
  },
] as const

export default function TestCreateHubPage() {
  const { slug } = useParams<{ slug: string }>()
  useEffect(() => { document.title = 'ILDIZmock — Yangi test' }, [])

  return (
    <PageShell maxWidth="max-w-4xl">
      <Link
        to={`/${slug}/admin/tests`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
      >
        <ArrowLeft size={14} /> Testlar
      </Link>

      <PageHeader
        title="Yangi test yaratish"
        subtitle="Modul tanlang — har biri uchun alohida shakli mavjud"
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.id}
            to={`/${slug}/admin/tests/new/${m.id}`}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className={`bg-gradient-to-br ${m.gradient} p-6 text-white`}>
              <m.Icon className="h-10 w-10" />
              <h3 className="mt-3 text-2xl font-bold">{m.label}</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600">{m.desc}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:text-red-700">
                Boshlash <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
