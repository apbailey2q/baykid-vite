/**
 * ErrorBoundary — catches unhandled render-tree exceptions and shows a
 * user-friendly fallback instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 *   // with a custom fallback:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     ...
 *   </ErrorBoundary>
 *
 * Errors are logged to the console (and to any configured error tracker
 * via reportError() at the bottom of this file).
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  children:  ReactNode
  /** Custom fallback UI — defaults to the built-in error card. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error:    Error | null
}

// ── Error tracker hook (wire up Sentry / PostHog / etc. here) ─────────────────

function reportError(error: Error, info: ErrorInfo): void {
  // TODO: forward to your error tracker, e.g.:
  //   Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  //   posthog.capture('$exception', { error: error.message, stack: info.componentStack })
  console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack)
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── AIMarketingErrorBoundary — section-level boundary for AI Marketing Center ──
// Shows a compact inline error card instead of the full-screen fallback so
// only the failing section blanks out while the rest of the page stays usable.

class AIMarketingErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, info)
  }

  override render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div
        role="alert"
        style={{
          padding:      '16px',
          borderRadius: 12,
          background:   'rgba(248,113,113,0.07)',
          border:       '1px solid rgba(248,113,113,0.22)',
          color:        '#f87171',
          fontSize:     13,
          lineHeight:   1.5,
        }}
      >
        <strong>Section failed to render.</strong>{' '}
        {this.state.error?.message ?? 'Unknown error'}{' '}
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{ marginLeft: 8, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: 'inherit' }}
        >
          Retry
        </button>
      </div>
    )
  }
}

/** Named export expected by AIMarketingCenter. */
export const AIMarketingErrorBoundary = AIMarketingErrorBoundaryInner

// ── Main ErrorBoundary ────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, info)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  override render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div
        role="alert"
        style={{
          minHeight:      '100dvh',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '24px',
          background:     '#060e24',
          color:          '#ffffff',
          fontFamily:     'system-ui, sans-serif',
          textAlign:      'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>

        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>
          Something went wrong
        </h1>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 320, lineHeight: 1.6, marginBottom: 24 }}>
          An unexpected error occurred. Please try refreshing the page. If the
          problem persists, contact support.
        </p>

        {this.state.error && (
          <pre
            style={{
              fontSize:    11,
              color:       'rgba(248,113,113,0.7)',
              background:  'rgba(248,113,113,0.06)',
              border:      '1px solid rgba(248,113,113,0.2)',
              borderRadius: 8,
              padding:     '10px 14px',
              maxWidth:    360,
              overflowX:   'auto',
              textAlign:   'left',
              marginBottom: 24,
              whiteSpace:  'pre-wrap',
              wordBreak:   'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={this.handleReset}
            style={{
              padding:    '10px 20px',
              borderRadius: 10,
              border:     '1px solid rgba(0,200,255,0.35)',
              background: 'rgba(0,200,255,0.08)',
              color:      '#00c8ff',
              fontSize:   13,
              fontWeight: 600,
              cursor:     'pointer',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding:    '10px 20px',
              borderRadius: 10,
              border:     'none',
              background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
              color:      '#ffffff',
              fontSize:   13,
              fontWeight: 700,
              cursor:     'pointer',
            }}
          >
            Refresh page
          </button>
        </div>
      </div>
    )
  }
}
