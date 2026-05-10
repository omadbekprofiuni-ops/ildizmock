import { Ban } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  visible: boolean
  resultUrl: string
}

export function AutoSubmitModal({ visible, resultUrl }: Props) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mb-3 flex justify-center">
          <Ban className="h-12 w-12 text-rose-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-rose-700">
          Test auto-submitted
        </h2>
        <p className="mb-6 text-slate-700">
          You exceeded the violation limit. Your test has been submitted and
          flagged for review by your teacher.
        </p>
        <Link
          to={resultUrl}
          className="inline-block w-full rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700"
        >
          View result
        </Link>
      </div>
    </div>
  )
}
