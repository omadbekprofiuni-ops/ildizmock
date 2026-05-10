import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '@/lib/api'

import { ListeningSection } from './sections/ListeningSection'
import { MockPdfSection } from './sections/MockPdfSection'
import { ReadingSection } from './sections/ReadingSection'
import { SpeakingSection } from './sections/SpeakingSection'
import { WritingSection } from './sections/WritingSection'

type SessionStatus =
  | 'waiting'
  | 'listening'
  | 'reading'
  | 'writing'
  | 'speaking'
  | 'finished'
  | 'cancelled'

interface MockState {
  session: {
    id: number
    name: string
    status: SessionStatus
    access_code: string
  }
  participant: { id: number; full_name: string }
  current_section: 'listening' | 'reading' | 'writing' | 'speaking' | null
  current_section_kind: 'regular' | 'pdf' | null
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
          <h1 className="mb-2 text-2xl font-bold text-red-600">Session not found</h1>
          <p className="text-slate-600">Please re-enter from your browser.</p>
        </div>
      </Center>
    )
  }
  if (!state) {
    return (
      <Center>
        <div className="text-slate-500">Loading…</div>
      </Center>
    )
  }

  if (state.session.status === 'waiting') {
    return <WaitingRoom name={state.participant.full_name} />
  }

  if (state.session.status === 'finished') {
    return <FinishedScreen state={state} />
  }

  if (
    state.submitted_for_current &&
    (state.session.status === 'listening'
      || state.session.status === 'reading'
      || state.session.status === 'writing'
      || state.session.status === 'speaking')
  ) {
    return (
      <BetweenScreen
        section={state.session.status}
        onTick={fetchState}
      />
    )
  }

  if (state.session.status === 'listening') {
    if (state.current_section_kind === 'pdf') {
      return (
        <MockPdfSection
          bsid={bsid!}
          section="listening"
          name={state.participant.full_name}
          secondsRemaining={state.seconds_remaining}
          onSubmit={fetchState}
        />
      )
    }
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
    if (state.current_section_kind === 'pdf') {
      return (
        <MockPdfSection
          bsid={bsid!}
          section="reading"
          name={state.participant.full_name}
          secondsRemaining={state.seconds_remaining}
          onSubmit={fetchState}
        />
      )
    }
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

  if (state.session.status === 'speaking') {
    return (
      <SpeakingSection
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
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Hello, {name}!</h1>
        <p className="mb-2 text-slate-600">Waiting for the mock test to start…</p>
        <p className="text-sm text-slate-500">
          It will start automatically when the teacher presses START.
        </p>
      </div>
    </Center>
  )
}

function BetweenScreen({
  section,
  onTick,
}: {
  section: 'listening' | 'reading' | 'writing' | 'speaking'
  onTick: () => void
}) {
  useEffect(() => {
    onTick()
  }, [onTick])
  const next =
    section === 'listening'
      ? 'Reading'
      : section === 'reading'
        ? 'Writing'
        : section === 'writing'
          ? 'Speaking'
          : 'results'
  return (
    <Center>
      <div className="w-full max-w-lg rounded-2xl bg-white p-12 text-center shadow-xl">
        <div className="mb-4 text-5xl">✓</div>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          {section.charAt(0).toUpperCase() + section.slice(1)} section submitted
        </h1>
        <p className="text-slate-600">
          Wait for other students to finish and the teacher to advance to {next}.
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
          ✓ Session finished
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
          Writing and Speaking scores will appear after the teacher reviews.
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
        {value ?? (pending ? <span className="text-sm font-normal text-slate-400">pending…</span> : '—')}
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
