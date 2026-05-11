import { useQuery } from '@tanstack/react-query'
import { Clock, FileText, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { B2CLayout } from '@/components/B2CLayout'
import { api } from '@/lib/api'

interface CatalogTest {
  id: string
  name: string
  module: string
  module_label: string
  difficulty: string
  difficulty_label: string
  duration_minutes: number
  b2c_description: string
  b2c_published_at: string | null
  questions_count: number
  source: string
  source_display: string
  credits_cost?: number | null
}

interface CatalogResponse {
  results: CatalogTest[]
  pagination: {
    page: number
    num_pages: number
    total: number
    page_size: number
    has_next: boolean
    has_previous: boolean
  }
  filters: { section: string; difficulty: string; source: string; q: string }
  meta: {
    section_choices: [string, string][]
    difficulty_choices: [string, string][]
    section_counts: {
      listening: number
      reading: number
      writing: number
      full_mock: number
      total: number
    }
    sources: { key: string; label: string }[]
  }
}

// ETAP 16.6 — dense katalog. Module badge ranglari brand paletadan.
const MODULE_BADGE: Record<string, string> = {
  listening: 'bg-brand-50 text-brand-700',
  reading: 'bg-amber-50 text-amber-700',
  writing: 'bg-accent-50 text-accent-700',
  full_mock: 'bg-violet-50 text-violet-700',
  speaking: 'bg-slate-100 text-slate-600',
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-emerald-600',
  beginner: 'text-emerald-600',
  medium: 'text-amber-600',
  intermediate: 'text-amber-600',
  hard: 'text-rose-600',
  advanced: 'text-rose-600',
  expert: 'text-rose-700',
}

export default function B2CCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') ?? 'all'
  const difficulty = searchParams.get('difficulty') ?? 'all'
  const source = searchParams.get('source') ?? 'all'
  const queryParam = searchParams.get('q') ?? ''
  const page = Number(searchParams.get('page') ?? '1') || 1

  const [searchInput, setSearchInput] = useState(queryParam)
  useEffect(() => {
    setSearchInput(queryParam)
  }, [queryParam])

  const queryKey = useMemo(
    () => ['b2c-catalog', { section, difficulty, source, q: queryParam, page }],
    [section, difficulty, source, queryParam, page],
  )

  const { data, isLoading } = useQuery<CatalogResponse>({
    queryKey,
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page) }
      if (section !== 'all') params.section = section
      if (difficulty !== 'all') params.difficulty = difficulty
      if (source !== 'all') params.source = source
      if (queryParam) params.q = queryParam
      return (await api.get<CatalogResponse>('/b2c/catalog', { params })).data
    },
  })

  const updateParams = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(searchParams)
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === 'all') merged.delete(k)
      else merged.set(k, v)
    })
    // Filter o'zgartirilganda paginatsiya boshiga qaytariladi.
    if ('section' in next || 'difficulty' in next || 'source' in next
        || 'q' in next) {
      merged.delete('page')
    }
    setSearchParams(merged, { replace: false })
  }

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ q: searchInput.trim() || undefined })
  }

  const sectionChoices = data?.meta.section_choices ?? [
    ['all', 'Barchasi'],
    ['listening', 'Listening'],
    ['reading', 'Reading'],
    ['writing', 'Writing'],
    ['full_mock', 'Full Mock'],
  ]
  const difficultyChoices = data?.meta.difficulty_choices ?? [
    ['all', 'Barcha darajalar'],
    ['easy', 'Oson'],
    ['medium', "O'rta"],
    ['hard', 'Qiyin'],
  ]
  const sourceChoices = data?.meta.sources ?? [
    { key: 'all', label: 'Barcha manbalar' },
  ]

  const counts = data?.meta.section_counts

  return (
    <B2CLayout active="catalog">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Test Katalogi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {counts
            ? `Jami ${counts.total} ta test tayyor — bo'lim, manba va daraja bo'yicha tanlang`
            : 'Yuklanmoqda…'}
        </p>
      </section>

      {/* Section tabs */}
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        <nav className="flex min-w-max gap-1">
          {sectionChoices.map(([key, label]) => {
            const isActive = section === key
            const count =
              key === 'all'
                ? counts?.total
                : (counts?.[key as keyof typeof counts] as number | undefined)
            return (
              <button
                key={key}
                type="button"
                onClick={() => updateParams({ section: key })}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
                {count !== undefined && (
                  <span
                    className={`ml-1.5 text-xs ${
                      isActive ? 'text-brand-500' : 'text-slate-400'
                    }`}
                  >
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <form
          onSubmit={onSubmitSearch}
          className="flex flex-col gap-2 md:flex-row md:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Test nomi bo'yicha qidirish…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <select
            value={source}
            onChange={(e) => updateParams({ source: e.target.value })}
            className="min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {sourceChoices.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => updateParams({ difficulty: e.target.value })}
            className="min-w-[140px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {difficultyChoices.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Qidirish
          </button>
        </form>
      </section>

      {/* Cards — dense 4-column grid */}
      {isLoading && !data ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Yuklanmoqda…
        </section>
      ) : data && data.results.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-3xl">
            📚
          </div>
          <h3 className="font-extrabold text-slate-900">Hech narsa topilmadi</h3>
          <p className="mt-1 text-sm text-slate-500">
            {queryParam
            || difficulty !== 'all'
            || section !== 'all'
            || source !== 'all'
              ? "Filtrlarni o'zgartirib qaytadan urinib ko'ring."
              : "Bu bo'limda hozircha testlar yo'q. Yangilari tez orada qo'shiladi."}
          </p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.results.map((t) => (
              <TestCard key={t.id} test={t} />
            ))}
          </section>

          {/* Pagination */}
          {data && data.pagination.num_pages > 1 && (
            <section className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                disabled={!data.pagination.has_previous}
                onClick={() => updateParams({ page: String(page - 1) })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Oldingi
              </button>
              <span className="text-sm text-slate-500">
                {data.pagination.page} / {data.pagination.num_pages}
              </span>
              <button
                type="button"
                disabled={!data.pagination.has_next}
                onClick={() => updateParams({ page: String(page + 1) })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Keyingi →
              </button>
            </section>
          )}
        </>
      )}
    </B2CLayout>
  )
}

function TestCard({ test }: { test: CatalogTest }) {
  const moduleClass = MODULE_BADGE[test.module] ?? 'bg-slate-100 text-slate-700'
  const moduleLabel = test.module_label || test.module
  const diffColor = DIFFICULTY_COLOR[test.difficulty] ?? 'text-slate-500'
  const diffLabel = test.difficulty_label || test.difficulty

  return (
    <Link
      to={`/b2c/catalog/${test.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      {/* Top — section badge + source */}
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${moduleClass}`}
        >
          {moduleLabel}
        </span>
        {test.source_display && (
          <span className="truncate text-slate-400" title={test.source_display}>
            {test.source_display}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-2 line-clamp-2 text-sm font-bold leading-tight text-slate-900 transition-colors group-hover:text-brand-700">
        {test.name}
      </h3>

      {/* Meta — duration + questions + difficulty */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {test.duration_minutes ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {test.duration_minutes}m
          </span>
        ) : null}
        {test.questions_count != null ? (
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {test.questions_count}
          </span>
        ) : null}
        <span className={`font-semibold ${diffColor}`}>{diffLabel}</span>
      </div>

      {/* Footer — credit placeholder + Start */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2">
        {test.credits_cost != null ? (
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600">
            ⚡ {test.credits_cost}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
        <span className="text-xs font-semibold text-brand-600 group-hover:underline">
          Start →
        </span>
      </div>
    </Link>
  )
}
