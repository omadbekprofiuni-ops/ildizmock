import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import SuperAdminLayout from './SuperAdminLayout'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

type AudioRow = {
  id: number
  test_id: string
  test_name: string
  organization: string
  is_global: boolean
  part_number: number
  duration_seconds: number
  size_bytes: number
  bitrate_kbps: number
  audio_url: string | null
  created_at: string
}

type AudioResponse = {
  totals: {
    count: number
    total_size_bytes: number
    total_duration_seconds: number
  }
  files: AudioRow[]
}

function fmtDuration(s: number): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function fmtSize(bytes: number): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export default function SuperAdminAudioPage() {
  const [filter, setFilter] = useState('')
  useEffect(() => { document.title = 'ILDIZmock — Audio files' }, [])

  const query = useQuery({
    queryKey: ['super-audio'],
    queryFn: async () => (await api.get<AudioResponse>('/super/audio/')).data,
  })

  const allFiles = query.data?.files ?? []
  const filtered = filter
    ? allFiles.filter((f) =>
        f.test_name.toLowerCase().includes(filter.toLowerCase()) ||
        f.organization.toLowerCase().includes(filter.toLowerCase()),
      )
    : allFiles

  const totalSize = query.data?.totals.total_size_bytes ?? 0
  const totalDuration = query.data?.totals.total_duration_seconds ?? 0

  return (
    <SuperAdminLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audio files</h1>
          <p className="mt-1 text-sm text-slate-500">
            Listening testlardagi audio fayllar kutubxonasi.
          </p>
        </div>

        {query.isLoading && <p className="text-slate-500">Loading…</p>}
        {query.isError && (
          <p className="text-cta-600">Couldn't load audio files.</p>
        )}

        {query.data && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Stat label="Total files" value={query.data.totals.count} />
              <Stat label="Total duration" value={fmtDuration(totalDuration)} />
              <Stat label="Total size" value={fmtSize(totalSize)} />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b p-4">
                  <h2 className="text-base font-semibold">Fayllar</h2>
                  <input
                    placeholder="Search by test or center name…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-72 rounded-md border px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Test</th>
                        <th className="px-4 py-3">Center</th>
                        <th className="px-4 py-3 text-center">Part</th>
                        <th className="px-4 py-3 text-center">Davomiylik</th>
                        <th className="px-4 py-3 text-center">Hajm</th>
                        <th className="px-4 py-3 text-center">Bitrate</th>
                        <th className="px-4 py-3">Audio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {f.test_name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {f.is_global ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                                Global
                              </span>
                            ) : (
                              f.organization
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono">
                            {f.part_number}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {fmtDuration(f.duration_seconds)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {fmtSize(f.size_bytes)}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500">
                            {f.bitrate_kbps ? `${f.bitrate_kbps} kbps` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {f.audio_url ? (
                              <audio
                                src={f.audio_url}
                                controls
                                preload="none"
                                className="h-8 w-64"
                              />
                            ) : (
                              <span className="text-xs text-slate-400">Audio yo‘q</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && !query.isLoading && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            No audio files found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}
