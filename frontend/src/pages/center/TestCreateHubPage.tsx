import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Headphones,
  PenLine,
  Zap,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader, PageShell } from '@/components/admin-shell'

const MODULES = [
  {
    id: 'listening',
    label: 'Listening',
    Icon: Headphones,
    gradient: 'from-blue-500 to-blue-600',
    desc: 'Audio file, transcript, questions, and an optional image.',
  },
  {
    id: 'reading',
    label: 'Reading',
    Icon: BookOpen,
    gradient: 'from-purple-500 to-purple-600',
    desc: 'Passage texts and questions (3 passages is standard).',
  },
  {
    id: 'writing',
    label: 'Writing',
    Icon: PenLine,
    gradient: 'from-orange-500 to-orange-600',
    desc: 'Task 1 (with a chart/graph image) and Task 2 prompt.',
  },
] as const

export default function TestCreateHubPage() {
  const { slug } = useParams<{ slug: string }>()
  useEffect(() => {
    document.title = 'ILDIZmock — New Test'
  }, [])

  return (
    <PageShell maxWidth="max-w-4xl">
      <Link
        to={`/${slug}/admin/tests`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Tests
      </Link>

      <PageHeader
        title="Create a new test"
        subtitle="Pick a module — each one has its own form"
      />

      {/* Bulk paste — fastest "type it all" path */}
      <Link
        to={`/${slug}/admin/tests/new/bulk`}
        className="group mb-6 block overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        <div className="flex flex-wrap items-center gap-6 p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
            <Zap className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-amber-600 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
              ⚡ Recommended · 5–10 min
            </div>
            <h3 className="text-2xl font-bold text-slate-900">
              Bulk question entry
            </h3>
            <p className="mt-1 text-sm text-slate-700">
              Paste all questions in one textarea using a simple
              <code className="mx-1 rounded bg-white/70 px-1 font-mono text-xs">
                Number|Type|Text|Answer
              </code>
              format. Live-parses as you type. No AI, no Excel — just text.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 group-hover:underline">
            Start <ArrowRight size={14} />
          </div>
        </div>
      </Link>

      <div className="mb-3 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          or build manually (~30 min)
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

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
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:text-brand-700">
                Start <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
