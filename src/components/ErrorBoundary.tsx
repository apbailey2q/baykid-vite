import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { logError } from '../lib/monitoring'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  children:    ReactNode
  fallback?:   ReactNode
  onError?:    (error: Error, info: ErrorInfo) => void
  context?:    string   // e.g. 'AIMarketingCenter', 'PublishingCenter'
}

interface State {
  hasError:  boolean
  message:   string
  errorId:   string
  stack?:    string
}

// ── Production error reporting ────────────────────────────────────────────────

function reportToProd(errorId: string, error: Error, info: ErrorInfo, context?: string): void {
  // Sentry
  try {
    const sentry = (window as unknown as Record<string, unknown>).Sentry as
      { captureException?: (e: Error, ctx?: object) => void } | null
    sentry?.captureException?.(error, {
      extra: { errorId, componentStack: info.componentStack, context },
      tags:  { component: context ?? 'unknown', boundary: 'ErrorBoundary' },
    })
  } catch { /* non-critical */ }
}

// ── Error classification ──────────────────────────────────────────────────────

function classifyError(message: string): { headline: string; detail: string } {
  const msg = message.toLowerCase()
  if (msg.includes('chunk') || msg.includes('loading'))
    return { headline: 'Loading error', detail: 'A required resource failed to load. Check your network connection.' }
  if (msg.includes('network') || msg.includes('fetch'))
    return { headline: 'Network error', detail: 'A network request failed. Check your connection and try again.' }
  if (msg.includes('permission') || msg.includes('not allowed'))
    return { headline: 'Permission error', detail: 'You may not have access to this feature.' }
  if (msg.includes('undefined') || msg.includes('null'))
    return { headline: 'Data error', detail: 'A required piece of data was missing. This has been reported.' }
  return { headline: 'Unexpected error', detail: 'An unexpected error occurred. Our team has been notified.' }
}

// ── ErrorBoundary ─────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '', errorId: '', stack: undefined }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`
    return {
      hasError: true,
      message:  error.message,
      errorId,
      stack:    import.meta.env.DEV ? error.stack : undefined,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const ctx = this.props.context ?? 'App'
    // Log via monitoring (wired to Sentry/PostHog in prod, console in dev)
    logError('general', `[ErrorBoundary:${ctx}] ${error.message}`, {
      errorId:  this.state.errorId,
      stack:    error.stack?.slice(0, 500),
      component: info.componentStack?.slice(0, 500),
    })
    // Also attempt direct Sentry capture in production
    if (import.meta.env.PROD) {
      reportToProd(this.state.errorId, error, info, ctx)
    }
    this.props.onError?.(error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '', errorId: '', stack: undefined })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // Custom fallback provided by parent
    if (this.props.fallback) return this.props.fallback

    const { headline, detail } = classifyError(this.state.message)

    return (
      <div
        style={{
          display:        'flex',
          minHeight:      '100vh',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            24,
          padding:        '24px 16px',
          textAlign:      'center',
          background:     '#060e24',
        }}
      >
        {/* Icon */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,23,68,0.12)', border: '1px solid rgba(255,23,68,0.3)',
        }}>
          <svg style={{ width: 36, height: 36, color: '#FF1744' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        {/* Message */}
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
            {headline}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 12px', lineHeight: 1.6 }}>
            {detail}
          </p>

          {/* Error ID for support */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 12px' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Error ID:</span>
            <code style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace' }}>
              {this.state.errorId}
            </code>
          </div>

          {/* Dev stack trace */}
          {this.state.stack && (
            <pre style={{
              marginTop: 12, textAlign: 'left', fontSize: 10, color: 'rgba(255,100,100,0.7)',
              background: 'rgba(255,23,68,0.05)', border: '1px solid rgba(255,23,68,0.15)',
              borderRadius: 8, padding: 12, overflow: 'auto', maxHeight: 160,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {this.state.stack.slice(0, 800)}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={this.handleRetry}
            style={{
              background:   'rgba(0,200,255,0.12)',
              border:       '1px solid rgba(0,200,255,0.35)',
              color:        '#00c8ff',
              borderRadius: 12,
              padding:      '10px 24px',
              fontSize:     14,
              fontWeight:   700,
              cursor:       'pointer',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background:   'linear-gradient(135deg,#0057e7,#00c8ff)',
              border:       'none',
              color:        '#fff',
              borderRadius: 12,
              padding:      '10px 24px',
              fontSize:     14,
              fontWeight:   700,
              cursor:       'pointer',
              boxShadow:    '0 4px 24px rgba(0,190,255,0.35)',
            }}
          >
            Reload App
          </button>
        </div>
      </div>
    )
  }
}

// ── AI Marketing specific error boundary ──────────────────────────────────────

export class AIMarketingErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '', errorId: '', stack: undefined }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message:  error.message,
      errorId:  `AI-${Date.now().toString(36).toUpperCase()}`,
      stack:    import.meta.env.DEV ? error.stack : undefined,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError('ai', `[AIMarketing crash] ${error.message}`, {
      errorId:   this.state.errorId,
      component: info.componentStack?.slice(0, 300),
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
        borderRadius: 16, padding: 24, margin: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <h3 style={{ color: '#f87171', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>
          This section encountered an error
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 16px' }}>
          {this.state.message || 'An unexpected error occurred in the AI Marketing Center.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => this.setState({ hasError: false, message: '', errorId: '', stack: undefined })}
            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
        {this.state.errorId && (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 12, fontFamily: 'monospace' }}>
            {this.state.errorId}
          </p>
        )}
      </div>
    )
  }
}
