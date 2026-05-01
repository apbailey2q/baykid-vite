import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ background: '#060e24' }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(255,23,68,0.12)', border: '1px solid rgba(255,23,68,0.3)' }}
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#FF1744' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-extrabold" style={{ color: '#ffffff' }}>Something went wrong</h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            An unexpected error occurred. Please reload the page.
          </p>
          {this.state.message && (
            <p
              className="mt-3 rounded-lg px-4 py-2 font-mono text-xs"
              style={{ background: 'rgba(255,23,68,0.08)', color: 'rgba(255,23,68,0.8)' }}
            >
              {this.state.message}
            </p>
          )}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="rounded-xl px-6 py-3 text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 24px rgba(0,190,255,0.35)' }}
        >
          Reload App
        </button>
      </div>
    )
  }
}
