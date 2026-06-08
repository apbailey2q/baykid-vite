// ComplianceGateBanner.tsx — Compliance gate status banner
//
// Phase MG.5 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Displays the current compliance gate status as a prominent banner.
// Used in ManagementDashboard (pre-computed result) and elsewhere.
//
// Props:
//   gateResult  — pre-computed ComplianceGateResult (from computeGateStatus or getManagementComplianceGateStatus)
//   className   — optional extra className
//   compact     — reduces vertical padding for inline use

import { Link } from 'react-router-dom'
import type { ComplianceGateResult, ComplianceGateStatus } from '../../lib/complianceGate'

interface ComplianceGateBannerProps {
  gateResult:  ComplianceGateResult
  className?:  string
  compact?:    boolean
}

// ── Severity color palette ────────────────────────────────────────────────────

const SEVERITY_STYLES = {
  info: {
    bg:     'rgba(0,200,255,0.07)',
    border: 'rgba(0,200,255,0.25)',
    color:  '#00c8ff',
    badge:  { bg: 'rgba(0,200,255,0.15)', text: '#00c8ff' },
  },
  warning: {
    bg:     'rgba(251,191,36,0.07)',
    border: 'rgba(251,191,36,0.28)',
    color:  '#fbbf24',
    badge:  { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  },
  urgent: {
    bg:     'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.30)',
    color:  '#f97316',
    badge:  { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  },
  critical: {
    bg:     'rgba(248,113,113,0.09)',
    border: 'rgba(248,113,113,0.35)',
    color:  '#f87171',
    badge:  { bg: 'rgba(248,113,113,0.20)', text: '#f87171' },
  },
} as const

const STATUS_ICON: Record<ComplianceGateStatus, string> = {
  clear:                  '✅',
  warning:                '⚠️',
  countdown:              '⏱️',
  temporarily_deactivated: '🚫',
  reactivation_pending:   '🔄',
}

const STATUS_LABEL: Record<ComplianceGateStatus, string> = {
  clear:                  'Compliant',
  warning:                'Warning',
  countdown:              'Countdown Active',
  temporarily_deactivated: 'Temporarily Deactivated',
  reactivation_pending:   'Reactivation Pending',
}

export default function ComplianceGateBanner({
  gateResult,
  className = '',
  compact   = false,
}: ComplianceGateBannerProps) {
  // Don't render a banner when clear
  if (gateResult.status === 'clear') return null

  const styles  = SEVERITY_STYLES[gateResult.severity]
  const icon    = STATUS_ICON[gateResult.status]
  const badge   = STATUS_LABEL[gateResult.status]
  const py      = compact ? 'py-3 px-4' : 'py-4 px-5'

  return (
    <div
      className={`rounded-2xl ${py} ${className}`}
      style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
      role="alert"
    >
      {/* Top row: icon + title + badge */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-lg leading-none">{icon}</span>
        <p className="text-sm font-bold flex-1" style={{ color: styles.color, margin: 0 }}>
          {gateResult.title}
        </p>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0"
          style={{ background: styles.badge.bg, color: styles.badge.text }}
        >
          {badge}
        </span>
      </div>

      {/* Message */}
      <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.75)', margin: 0 }}>
        {gateResult.message}
      </p>

      {/* Days remaining */}
      {gateResult.daysRemaining !== undefined && gateResult.status === 'countdown' && (
        <p className="text-xs font-bold mt-1" style={{ color: styles.color }}>
          ⏳ {gateResult.daysRemaining} day{gateResult.daysRemaining === 1 ? '' : 's'} until deactivation
        </p>
      )}

      {/* Missing documents */}
      {gateResult.missingDocuments && gateResult.missingDocuments.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            REQUIRES ACTION:
          </p>
          <ul className="space-y-0.5">
            {gateResult.missingDocuments.map(doc => (
              <li key={doc} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ color: styles.color }}>•</span> {doc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expired documents */}
      {gateResult.expiredDocuments && gateResult.expiredDocuments.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            EXPIRING / EXPIRED:
          </p>
          <ul className="space-y-0.5">
            {gateResult.expiredDocuments.map(doc => (
              <li key={doc} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ color: styles.color }}>•</span> {doc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reactivation pending note */}
      {gateResult.status === 'reactivation_pending' && (
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          An administrator will review your request and notify you of their decision.
        </p>
      )}

      {/* Action button — status 'clear' isn't part of the gate union, so the
          comparison was redundant. Showing the button whenever an actionUrl
          is present. */}
      {gateResult.actionUrl && (
        <div className="mt-3">
          <Link
            to={gateResult.actionUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
            style={{ background: styles.badge.bg, color: styles.color, border: `1px solid ${styles.border}`, textDecoration: 'none' }}
          >
            {gateResult.status === 'temporarily_deactivated' || gateResult.status === 'reactivation_pending'
              ? '📂 View Documents & Reactivation'
              : '📂 View Documents'}
            <span style={{ opacity: 0.7 }}>→</span>
          </Link>
        </div>
      )}
    </div>
  )
}
