// AgreementReview.tsx — Agreement review and digital acceptance component
//
// Phase MG.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Displays a management agreement document (title, version, summary, full text)
// and collects a digital signature. Blocks completion until:
//   • The "I have read and agree" checkbox is checked
//   • A full legal name has been typed (>= 2 chars)
//
// Usage — standard step:
//   <AgreementReview
//     agreement={getAgreementByCode(CODE_OF_CONDUCT)!}
//     onAccept={sig => handleAcceptAgreement(CODE_OF_CONDUCT, sig, 'confidentiality')}
//     onBack={() => goToStep('mission')}
//     saving={saving}
//   />
//
// Usage — final step with custom label:
//   <AgreementReview
//     agreement={getAgreementByCode(MANAGEMENT_AGREEMENT)!}
//     onAccept={handleFinalAccept}
//     onBack={() => goToStep('assessment')}
//     acceptLabel="Accept & Complete Onboarding"
//     saving={saving}
//   />

import { useState } from 'react'
import type { AgreementDefinition } from '../../data/managementAgreementData'

const BRAND        = '#00c8ff'
const BRAND_DIM    = 'rgba(0,200,255,0.10)'
const BRAND_BORDER = 'rgba(0,200,255,0.28)'

// ── AcceptedBanner ────────────────────────────────────────────────────────────
//
// Shown inside the wizard when a user revisits an already-accepted step.
// Exported so ManagementOnboardingWizard can use it directly.

interface AcceptedBannerProps {
  title:         string
  signatureName: string
  acceptedAt:    string
}

export function AcceptedBanner({ title, signatureName, acceptedAt }: AcceptedBannerProps) {
  const dateStr = new Date(acceptedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)' }}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5">✅</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Accepted on {dateStr} — signed as <em className="text-white">{signatureName}</em>
          </p>
          <p className="text-xs mt-2" style={{ color: 'rgba(74,222,128,0.85)' }}>
            Your acceptance is recorded. Click Continue to proceed.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── AgreementReview ───────────────────────────────────────────────────────────

interface AgreementReviewProps {
  agreement:    AgreementDefinition
  onAccept:     (signatureName: string) => void
  onBack?:      () => void
  saving?:      boolean
  acceptLabel?: string
}

export default function AgreementReview({
  agreement,
  onAccept,
  onBack,
  saving = false,
  acceptLabel = 'Accept & Continue',
}: AgreementReviewProps) {
  const [read,      setRead]      = useState(false)
  const [sigName,   setSigName]   = useState('')

  const canAccept = read && sigName.trim().length >= 2

  // Split full text on double newlines for paragraph rendering
  const paragraphs = agreement.fullText
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,200,255,0.12)' }}
    >
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 className="text-lg font-bold text-white leading-tight">{agreement.title}</h2>
          <span
            className="shrink-0 text-xs font-semibold px-2 py-1 rounded-lg"
            style={{ background: BRAND_DIM, border: `1px solid ${BRAND_BORDER}`, color: BRAND }}
          >
            v{agreement.version}
          </span>
        </div>

        {/* Summary */}
        <div
          className="p-3 rounded-xl text-xs leading-relaxed"
          style={{ background: BRAND_DIM, border: `1px solid ${BRAND_BORDER}`, color: 'rgba(255,255,255,0.75)' }}
        >
          <span className="font-bold" style={{ color: BRAND }}>Summary: </span>
          {agreement.summary}
        </div>
      </div>

      {/* ── Full text scroll area ── */}
      <div
        className="px-6 py-4 overflow-y-auto text-xs leading-relaxed space-y-3"
        style={{ maxHeight: 380, color: 'rgba(255,255,255,0.65)' }}
      >
        {paragraphs.map((para, i) => {
          // Bold any paragraph that starts with an all-caps heading pattern
          const isHeading = /^[A-Z0-9 .&'/()]{4,}$/.test(para.split('\n')[0])
          if (isHeading) {
            const lines = para.split('\n')
            return (
              <div key={i}>
                <p className="font-bold text-white mb-1">{lines[0]}</p>
                {lines.slice(1).map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            )
          }
          return <p key={i}>{para}</p>
        })}
      </div>

      {/* ── Acceptance section ── */}
      <div className="px-6 pb-6 pt-4 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Checkbox */}
        <label
          htmlFor={`agree-${agreement.code}`}
          className="flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-all"
          style={{
            background: read ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.02)',
            border:     `1px solid ${read ? BRAND_BORDER : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <input
            type="checkbox"
            id={`agree-${agreement.code}`}
            checked={read}
            onChange={e => setRead(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-cyan-400 shrink-0"
          />
          <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
            I have read and agree to this document.
          </span>
        </label>

        {/* Signature field */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Full Legal Name — Digital Signature
          </label>
          <input
            type="text"
            value={sigName}
            onChange={e => setSigName(e.target.value)}
            placeholder="Type your full legal name"
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border:     `1px solid ${sigName.trim().length >= 2 ? BRAND_BORDER : 'rgba(255,255,255,0.1)'}`,
            }}
          />
          {sigName.trim().length > 0 && sigName.trim().length < 2 && (
            <p className="text-xs mt-1" style={{ color: 'rgba(239,68,68,0.75)' }}>
              Enter your full legal name to continue.
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center gap-4 pt-1">
          {onBack ? (
            <button
              onClick={onBack}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              ← Back
            </button>
          ) : <div />}

          <button
            onClick={() => canAccept && !saving && onAccept(sigName.trim())}
            disabled={!canAccept || saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-35"
            style={{ background: BRAND, color: '#000' }}
          >
            {saving ? 'Saving…' : acceptLabel}
          </button>
        </div>

        {!canAccept && (
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Check the agreement box and enter your full legal name to accept.
          </p>
        )}
      </div>
    </div>
  )
}
