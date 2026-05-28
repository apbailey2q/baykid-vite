// ErrorState.tsx — Consistent error display for async operations
// Companion to EmptyState. Used when a data fetch fails.

import { type ReactNode } from 'react'

interface Props {
  title?:       string
  message:      string
  icon?:        string
  onRetry?:     () => void
  retryLabel?:  string
  /** Optional secondary action (e.g. "Go back") */
  secondaryAction?: { label: string; onClick: () => void }
  /** Show a compact inline variant instead of full panel */
  inline?:      boolean
  children?:    ReactNode
}

export function ErrorState({
  title       = 'Something went wrong',
  message,
  icon        = '⚠️',
  onRetry,
  retryLabel  = 'Try again',
  secondaryAction,
  inline      = false,
  children,
}: Props) {
  if (inline) {
    return (
      <div
        role="alert"
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          10,
          padding:      '10px 14px',
          background:   'rgba(239,68,68,0.08)',
          border:       '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          color:        '#f87171',
          fontSize:     13,
        }}
      >
        <span aria-hidden="true">{icon}</span>
        <span style={{ flex: 1 }}>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 10px', whiteSpace: 'nowrap' }}
          >
            {retryLabel}
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      role="alert"
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            12,
        padding:        '40px 24px',
        textAlign:      'center',
        background:     'rgba(239,68,68,0.05)',
        border:         '1px solid rgba(239,68,68,0.15)',
        borderRadius:   14,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 36 }}>{icon}</span>

      <div>
        <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 600 }}>{title}</p>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 13, maxWidth: 400 }}>
          {message}
        </p>
      </div>

      {children && (
        <div style={{ width: '100%', maxWidth: 400 }}>{children}</div>
      )}

      {(onRetry || secondaryAction) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 18px' }}
            >
              {secondaryAction.label}
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              style={{ background: 'linear-gradient(135deg,#0080ff,#00c8ff)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '8px 20px' }}
            >
              {retryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inline API error ──────────────────────────────────────────────────────────
// Minimal one-liner for showing fetch errors inside forms or cards.

export function ApiError({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  if (!message) return null
  return (
    <div
      role="alert"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}
    >
      <span style={{ color: '#f87171', fontSize: 14, lineHeight: '20px' }}>⚠️</span>
      <span style={{ color: '#f87171', fontSize: 13, flex: 1, lineHeight: '20px' }}>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'transparent', border: 'none', color: 'rgba(248,113,113,0.6)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: '20px' }}>✕</button>
      )}
    </div>
  )
}

// ── Network error ─────────────────────────────────────────────────────────────

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      icon="📡"
      title="Connection problem"
      message="Unable to reach the server. Check your internet connection and try again."
      onRetry={onRetry}
    />
  )
}
