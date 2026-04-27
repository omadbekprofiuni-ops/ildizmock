import { useState } from 'react'

import { api } from '@/lib/api'

interface Props {
  partId: number
  audioUrl: string | null
  durationSeconds: number
  bitrateKbps: number
  sizeBytes: number
  onUpload: (data: {
    audio_url: string | null
    audio_duration_seconds: number
    audio_bitrate_kbps: number
    audio_size_bytes: number
  }) => void
}

function formatDuration(s: number) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

export function AudioUploadCard({
  partId,
  audioUrl,
  durationSeconds,
  bitrateKbps,
  sizeBytes,
  onUpload,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const upload = async (file: File) => {
    setError('')
    setUploading(true)
    setProgress(0)

    if (file.size > 50 * 1024 * 1024) {
      setError('Fayl 50 MB dan kichik bo\'lsin')
      setUploading(false)
      return
    }

    const fd = new FormData()
    fd.append('audio', file)

    try {
      const r = await api.post(
        `/super/listening-parts/${partId}/upload-audio/`,
        fd,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
          },
        },
      )
      onUpload({
        audio_url: r.data.audio_url,
        audio_duration_seconds: r.data.audio_duration_seconds,
        audio_bitrate_kbps: r.data.audio_bitrate_kbps,
        audio_size_bytes: r.data.audio_size_bytes,
      })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { audio?: string[] } } }
      setError(err.response?.data?.audio?.[0] ?? 'Yuklashda xatolik')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
      {audioUrl ? (
        <div className="space-y-3">
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            <span>⏱ {formatDuration(durationSeconds)}</span>
            <span>📊 {bitrateKbps || '—'} kbps</span>
            <span>📁 {formatSize(sizeBytes)}</span>
          </div>
        </div>
      ) : (
        <div className="text-center text-sm text-slate-500">
          🎵 Audio fayl yuklang (MP3, M4A — 50 MB gacha)
        </div>
      )}

      <label className="mt-4 block cursor-pointer">
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ''
          }}
        />
        <span className="block w-full rounded-full bg-slate-900 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800">
          {uploading ? `Yuklanmoqda… ${progress}%` : audioUrl ? 'Boshqa fayl yuklash' : 'Fayl tanlash'}
        </span>
      </label>

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  )
}
