import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '@/lib/api'

import { ListeningSection } from './sections/ListeningSection'
import { ReadingSection } from './sections/ReadingSection'
import { WritingSection } from './sections/WritingSection'

interface MockState {
  session: {
    id: number
    name: string
    status: 'waiting' | 'listening' | 'reading' | 'writing' | 'finished'
    access_code: string
  }
  participant: { id: number; full_name: string }
  current_section: 'listening' | 'reading' | 'writing' | null
  seconds_remaining: number
  submitted_for_current: boolean
  scores: {
    listening: string | null
    reading: string | null
    writing: string | null
    speaking: string | null
  }
}

export default function MockSessionPage() {
  const { bsid } = useParams<{ bsid: string }>()
  const [state, setState] = useState<MockState | null>(null)
  const [notFound, setNotFound] = useState(false)
  const lastStatusRef = useRef<string | null>(null)

  const fetchState = useCallback(async () => {
    if (!bsid) return
    try {
      const r = await api.get<MockState>(`/mock/state/${bsid}/`)
      setState(r.data)
      lastStatusRef.current = r.data.session.status
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 404) setNotFound(true)
    }
  }, [bsid])

  useEffect(() => {
    fetchState()
    const id = setInterval(fetchState, 2500)
    return () => clearInterval(id)
  }, [fetchState])

  if (notFound) {
    return (
      <Center>
        <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="mb-2 text-2xl font-bold text-red-600">Sessiya topilmadi</h1>
          <p className="text-slate-600">Brauzeringizdan qayta kiring.</p>
        </div>
      </Center>
    )
  }
  if (!state) {
    return (
      <Center>
        <div className="text-slate-500">Yuklanmoqda…</div>
      </Center>
    )
  }

  if (state.session.status === 'waiting') {
    return <WaitingRoom name={state.participant.full_name} />
  }

  if (state.session.status === 'finished') {
    return <FinishedScreen state={state} />
  }

  if (state.submitted_for_current) {
    return (
      <BetweenScreen
        section={state.session.status}
        onTick={fetchState}
      />
    )
  }

  if (state.session.status === 'listening') {
    return (
      <ListeningSection
        bsid={bsid!}
        name={state.participant.full_name}
        secondsRemaining={state.seconds_remaining}
        onSubmit={fetchState}
      />
    )
  }

  if (state.session.status === 'reading') {
    return (
      <ReadingSection
        bsid={bsid!}
        name={state.participant.full_name}
        secondsRemaining={state.seconds_remaining}
        onSubmit={fetchState}
      />
    )
  }

  if (state.session.status === 'writing') {
    return (
      <WritingSection
        bsid={bsid!}
        name={state.participant.full_name}
        secondsRemaining={state.seconds_remaining}
        onSubmit={fetchState}
      />
    )
  }

  return null
}

function WaitingRoom({ name }: { name: string }) {
  return (
    <Center>
      <div className="w-full max-w-lg rounded-2xl bg-white p-12 text-center shadow-xl">
        <div className="mb-6 inline-block h-16 w-16 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Salom, {name}!</h1>
        <p className="mb-2 text-slate-600">Mock test boshlanishini kuting…</p>
        <p className="text-sm text-slate-500">
          O'qituvchi START tugmasini bosganda avtomatik boshlanadi.
        </p>
      </div>
    </Center>
  )
}

function BetweenScreen({
  section,
  onTick,
}: {
  section: 'listening' | 'reading' | 'writing'
  onTick: () => void
}) {
  useEffect(() => {
    onTick()
  }, [onTick])
  const next =
    section === 'listening' ? 'Reading' : section === 'reading' ? 'Writing' : 'natijalar'
  return (
    <Center>
      <div className="w-full max-w-lg rounded-2xl bg-white p-12 text-center shadow-xl">
        <div className="mb-4 text-5xl">✓</div>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          {section.charAt(0).toUpperCase() + section.slice(1)} qismi yuborildi
        </h1>
        <p className="text-slate-600">
          Boshqa talabalar tugatishini va o'qituvchi {next} bosqichiga
          o'tkazishini kuting.
        </p>
      </div>
    </Center>
  )
}

function FinishedScreen({ state }: { state: MockState }) {
  const { scores } = state
  return (
    <Center>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-green-700">
          ✓ Sessiya tugadi
        </h1>
        <p className="mb-6 text-center text-slate-600">
          {state.participant.full_name}
        </p>
        <div className="space-y-3">
          <ScoreRow label="Listening" value={scores.listening} />
          <ScoreRow label="Reading" value={scores.reading} />
          <ScoreRow label="Writing" value={scores.writing} pending />
          <ScoreRow label="Speaking" value={scores.speaking} pending />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Writing va Speaking ballari ustoz tekshirgandan so'ng paydo bo'ladi.
        </p>
      </div>
    </Center>
  )
}

function ScoreRow({
  label,
  value,
  pending,
}: {
  label: string
  value: string | null
  pending?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="font-mono text-xl font-bold">
        {value ?? (pending ? <span className="text-sm font-normal text-slate-400">kutilmoqda…</span> : '—')}
      </span>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      {children}
    </div>
  )
}
