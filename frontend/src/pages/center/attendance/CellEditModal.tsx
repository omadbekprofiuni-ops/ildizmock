/**
 * ETAP 20 Tab 2 — Bitta hujayrani belgilash modal'i.
 */
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'

import { btnOutline, btnPrimary } from '@/components/admin-shell'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type Status = 'present' | 'late' | 'absent' | 'excused'

const STATUS_LABELS: Record<Status, string> = {
  present: 'Keldi',
  late: 'Kech qoldi',
  absent: 'Kelmadi',
  excused: 'Sababli',
}

const STATUS_LIST: Status[] = ['present', 'late', 'absent', 'excused']

export interface CellEditContext {
  slug: string
  recordId: number
  studentName: string
  sessionDate: string
  currentStatus: Status | null
  currentNote: string
}

export default function CellEditModal({
  ctx,
  onClose,
  onSaved,
}: {
  ctx: CellEditContext
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<Status | null>(ctx.currentStatus)
  const [note, setNote] = useState(ctx.currentNote || '')

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!status) throw new Error('no_status')
      return (
        await api.patch(
          `/center/${ctx.slug}/attendance/v2/records/${ctx.recordId}/`,
          { status, note },
        )
      ).data
    },
    onSuccess: () => {
      toast.success('Yangilandi')
      onSaved()
    },
    onError: (e) => {
      const data = (e as { response?: { data?: { error?: unknown } } }).response?.data
      const errVal = data?.error
      let msg = 'Saqlanmadi'
      if (typeof errVal === 'string') msg = errVal
      else if (errVal && typeof errVal === 'object') {
        const first = Object.values(errVal as Record<string, unknown>)[0]
        if (typeof first === 'string') msg = first
      }
      toast.error(msg)
    },
  })

  const save = () => {
    if (!status) {
      toast.error('Statusni tanlang')
      return
    }
    if (status === 'excused' && !note.trim()) {
      toast.error('Sababli kelmagan uchun izoh majburiy')
      return
    }
    saveMut.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-slate-900">
              {ctx.studentName}
            </h2>
            <p className="text-xs text-slate-500">{ctx.sessionDate}</p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {STATUS_LIST.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                status === s
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {(status === 'excused' || note) && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={
              status === 'excused'
                ? 'Sabab (majburiy, masalan: kasal, ota-ona ruxsati)'
                : 'Izoh (ixtiyoriy)'
            }
            className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnOutline}>
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saveMut.isPending}
            className={btnPrimary}
          >
            {saveMut.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  )
}
