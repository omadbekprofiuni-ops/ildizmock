import { Component, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

type Props = { children: ReactNode }
type State = { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : 'Nomaʼlum xatolik',
    }
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-center">
          <h1 className="text-2xl font-bold">Technical error</h1>
          <p className="text-slate-600">
            Refresh the page or contact us.
          </p>
          {this.state.message && (
            <p className="max-w-md font-mono text-xs text-slate-400">
              {this.state.message}
            </p>
          )}
          <Button onClick={() => window.location.reload()}>Refresh page</Button>
        </div>
      )
    }
    return this.props.children
  }
}
