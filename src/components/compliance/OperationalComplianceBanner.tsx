// OperationalComplianceBanner.tsx — Self-loading compliance banner for
// driver / warehouse / commercial dashboards. Distinct from the
// ComplianceGateBanner used by ManagementDashboard (which is fed a
// pre-computed MG.5 ComplianceGateResult).
//
// Behavior:
//   - Loads the current user's compliance gate state on mount.
//   - Renders nothing when severity === 'none' (zero noise).
//   - Renders an inline banner with severity-appropriate styling when
//     severity is 'warning' or 'blocked'.
//   - Always links to /compliance/documents for remediation.
//
// Drop-in:
//   import OperationalComplianceBanner from '../../components/compliance/OperationalComplianceBanner'
//   <OperationalComplianceBanner />
//
// Safe-fail: if the backend isn't ready the gate returns severity 'none'
// and the banner stays hidden.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  getAccountComplianceGate,
  type AccountComplianceGate,
} from '../../lib/complianceGate'

export default function OperationalComplianceBanner({ className = '' }: { className?: string }) {
  const { user, role } = useAuthStore()
  const [gate, setGate] = useState<AccountComplianceGate | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!user?.id) return
    ;(async () => {
      const g = await getAccountComplianceGate(user.id, role ?? '')
      if (!cancelled) setGate(g)
    })()
    return () => { cancelled = true }
  }, [user?.id, role])

  if (!gate || gate.severity === 'none') return null

  const palette = gate.severity === 'blocked'
    ? { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.40)',  color: '#fca5a5', icon: '🚫' }
    : { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.40)', color: '#fbbf24', icon: '⚠️' }

  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
    >
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 22 }}>{palette.icon}</span>
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>
            {gate.severity === 'blocked' ? 'Compliance hold' : 'Compliance attention needed'}
          </p>
          <p style={{ fontSize: 13, color: palette.color, marginTop: 4 }}>
            {gate.message ?? 'Please review your compliance documents.'}
          </p>
          {gate.details && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {gate.details.expired > 0      && <span>Expired: <strong>{gate.details.expired}</strong></span>}
              {gate.details.missing > 0      && <span>Missing: <strong>{gate.details.missing}</strong></span>}
              {gate.details.expiringSoon > 0 && <span>Expiring soon: <strong>{gate.details.expiringSoon}</strong></span>}
              {gate.details.countdownActive  && <span><strong>Countdown active</strong></span>}
            </div>
          )}
          <div className="mt-3">
            <Link
              to={gate.redirectTo ?? '/compliance/documents'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
              style={{
                background: gate.severity === 'blocked' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                border:     `1px solid ${palette.border}`,
                color:      palette.color,
                textDecoration: 'none',
              }}
            >
              📋 Open Document Center →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
