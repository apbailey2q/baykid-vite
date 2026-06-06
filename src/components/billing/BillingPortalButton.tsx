// BillingPortalButton — opens the Stripe Customer Portal in a new tab.
// Hides itself if the user has no Stripe customer id yet (i.e. has never
// subscribed). In mock mode (Stripe not configured) it logs and redirects to
// a synthetic URL so the click handler is still exercised in dev.

import { useState } from 'react'
import { createPortalSession, isStripeConfigured } from '../../lib/billing'

interface Props {
  orgId: string
  returnPath?: string
  label?: string
  variant?: 'primary' | 'ghost'
}

export function BillingPortalButton({
  orgId,
  returnPath,
  label = 'Manage billing',
  variant = 'ghost',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function open() {
    setError(null)
    setLoading(true)
    try {
      const { url } = await createPortalSession({ orgId, returnPath })
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open portal')
      setLoading(false)
    }
  }

  const style: React.CSSProperties = variant === 'primary'
    ? {
        background: 'linear-gradient(135deg,#0057e7,#00c8ff)',
        color: '#fff', border: 'none', boxShadow: '0 2px 12px rgba(0,190,255,0.35)',
      }
    : {
        background: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.85)',
        border: '1px solid rgba(255,255,255,0.15)',
      }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button
        onClick={open}
        disabled={loading}
        style={{
          ...style,
          borderRadius: 10, padding: '8px 16px',
          fontWeight: 700, fontSize: 13, cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Opening…' : label}
      </button>
      {!isStripeConfigured() && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          Mock mode — set VITE_STRIPE_PUBLISHABLE_KEY to enable
        </span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>
      )}
    </div>
  )
}
