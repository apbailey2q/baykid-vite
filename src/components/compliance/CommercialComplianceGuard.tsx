// ─────────────────────────────────────────────────────────────────────────────
// CO.2 — Commercial Compliance Guard
// ─────────────────────────────────────────────────────────────────────────────
//
// Service-hold gate component for commercial users.
//
// Rules:
//   • Admins are NEVER blocked — guard passes through immediately.
//   • Commercial users with an active service hold or reactivation pending
//     may still access:
//       /commercial/documents   (to fix their documents)
//       /commercial/contracts   (to review service agreement)
//   • All other routes are blocked with a clear service-hold message and
//     a link to /commercial/documents.
//   • Dashboard viewing is NOT blocked (commercial users can still see their
//     dashboard; only pickup creation would be blocked — see wiring notes below).
//
// Wiring notes:
//   • Wrap pickup-creation routes/buttons with this guard to block new pickups
//     when an account is on hold.
//   • For full route gating, wrap the route element in App.tsx:
//       <CommercialComplianceGuard>
//         <CommercialPickupRequest />
//       </CommercialComplianceGuard>
//   • This guard is NOT auto-applied globally — it must be explicitly added
//     to routes that should be blocked.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, type ReactNode }  from 'react'
import { useNavigate, useLocation }              from 'react-router-dom'
import { supabase }                              from '../../lib/supabase'
import { useAuthStore }                          from '../../store/authStore'
import { PrimaryButton }                         from '../ui/PrimaryButton'
import { Spinner }                               from '../ui/Spinner'
import { getCommercialServiceHoldStatus }        from '../../lib/commercialCompliance'
import type { ServiceHoldStatus }                from '../../lib/commercialCompliance'

// ── Routes always accessible even when on hold ────────────────────────────────

const HOLD_ALLOWED_PATHS = [
  '/commercial/documents',
  '/commercial/contracts',
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode
  /** Override: if true, treat this route as allowed even when on hold */
  allowOnHold?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommercialComplianceGuard({ children, allowOnHold = false }: Props) {
  const navigate     = useNavigate()
  const { pathname } = useLocation()
  const { user, role } = useAuthStore()

  const [holdStatus,  setHoldStatus]  = useState<ServiceHoldStatus | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    // Admins always pass through
    if (role === 'admin') { setLoading(false); return }

    // Non-commercial roles pass through (guard is commercial-specific)
    const isCommercialRole = role === 'commercial'
      || role?.endsWith('_customer')
      || role?.endsWith('_partner')
      || role === 'business_customer'
      || role === 'school_business'
    if (!isCommercialRole) { setLoading(false); return }

    // Load the account and check hold status
    void (async () => {
      const { data: account } = await supabase
        .from('commercial_accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!account?.id) { setLoading(false); return }

      const result = await getCommercialServiceHoldStatus(account.id)
      setHoldStatus(result.data ?? null)
      setLoading(false)
    })()
  }, [user, role])

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Spinner />
      </div>
    )
  }

  // ── Pass-through cases ───────────────────────────────────────────────────

  // Admin always passes
  if (role === 'admin') return <>{children}</>

  // No hold — pass through
  if (!holdStatus?.onHold) return <>{children}</>

  // Allowed path even on hold
  if (allowOnHold) return <>{children}</>
  if (HOLD_ALLOWED_PATHS.some(p => pathname.startsWith(p))) return <>{children}</>

  // ── Service hold block ───────────────────────────────────────────────────

  return (
    <div style={{
      minHeight:    '100vh',
      background:   '#0d1117',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      padding:      24,
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     420,
        background:   'rgba(249,115,22,0.08)',
        border:       '1px solid rgba(249,115,22,0.3)',
        borderRadius: 20,
        padding:      28,
        textAlign:    'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {holdStatus.reactivationPending ? '🔄' : '🔒'}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
          {holdStatus.reactivationPending
            ? 'Reactivation Under Review'
            : 'Account Service Hold'}
        </h2>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.6 }}>
          {holdStatus.reactivationPending
            ? 'Your reactivation request is being reviewed by the Cyan\'s Brooklynn Recycling compliance team. You will be notified when a decision is made.'
            : `Your account has an active service hold${holdStatus.reason ? `: ${holdStatus.reason}` : ''}. Resolve outstanding compliance documents to restore service.`}
        </p>

        {holdStatus.holdExpiresAt && (
          <p style={{ fontSize: 12, color: '#fbbf24', margin: '0 0 16px' }}>
            Hold expires: {new Date(holdStatus.holdExpiresAt).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryButton fullWidth onClick={() => navigate('/commercial/documents')}>
            📄 Resolve Compliance Documents
          </PrimaryButton>
          <PrimaryButton fullWidth variant="secondary" onClick={() => navigate('/commercial/contracts')}>
            📋 View Service Agreement
          </PrimaryButton>
          <PrimaryButton fullWidth variant="secondary" onClick={() => navigate('/dashboard/commercial')}>
            ← Back to Dashboard
          </PrimaryButton>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 16 }}>
          Questions? Contact Cyan&apos;s Brooklynn Recycling compliance support.
        </p>
      </div>
    </div>
  )
}
