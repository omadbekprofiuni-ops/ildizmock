import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Copy,
  FileSpreadsheet,
  Headphones,
  PenLine,
  Sparkles,
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
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
      >
        <ArrowLeft size={14} /> Tests
      </Link>

      <PageHeader
        title="Create a new test"
        subtitle="Pick a module — each one has its own form"
      />

      {/* Quick options — fastest paths to a finished test */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Template Catalog */}
        <Link
          to={`/${slug}/admin/tests`}
          className="group relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            ⚡ 2 min
          </div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
            <Copy className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Clone a template</h3>
          <p className="mt-1 text-sm text-slate-700">
            Pick a Cambridge-style test from the catalog. One click → ready.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 group-hover:underline">
            Browse catalog <ArrowRight size={14} />
          </div>
        </Link>

        {/* AI-Assisted */}
        <Link
          to={`/${slug}/admin/tests/new/ai`}
          className="group relative overflow-hidden rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            ⚡ 10 min
          </div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">AI-Assisted</h3>
          <p className="mt-1 text-sm text-slate-700">
            Paste a Reading passage — Claude drafts IELTS-quality questions.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-700 group-hover:underline">
            Start <ArrowRight size={14} />
          </div>
        </Link>

        {/* Excel Import */}
        <Link
          to={`/${slug}/admin/tests/new/excel`}
          className="group relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            ⚡ 15 min
          </div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Excel import</h3>
          <p className="mt-1 text-sm text-slate-700">
            Download the template, fill it in Excel, upload. Best for bulk
            imports from existing materials.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 group-hover:underline">
            Download template <ArrowRight size={14} />
          </div>
        </Link>
      </div>

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
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:text-red-700">
                Start <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
