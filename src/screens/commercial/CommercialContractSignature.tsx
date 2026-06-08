// ─────────────────────────────────────────────────────────────────────────────
// CO.4 — Commercial Contract Signature Screen
// Route: /commercial/contracts/sign/:contractId
// ─────────────────────────────────────────────────────────────────────────────
//
// Allows the commercial account representative to review the full contract
// terms and provide a typed electronic signature as acknowledgement.
//
// Signature = typed name acknowledgement — NOT a cryptographic signature.
// Platform does NOT provide legal advice (CLAUDE.md).
// PROHIBITED: No Stripe, ACH, bank account numbers, routing numbers.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate }            from 'react-router-dom'
import { useAuthStore }                      from '../../store/authStore'
import { AppShell }                          from '../../components/ui/AppShell'
import { PageHeader }                        from '../../components/ui/PageHeader'
import { PrimaryButton }                     from '../../components/ui/PrimaryButton'
import { StatusBadge }                       from '../../components/ui/StatusBadge'
import { Spinner }                           from '../../components/ui/Spinner'
import { getActiveCommercialContract }       from '../../lib/commercialContracts'
import {
  signCommercialContract,
  declineCommercialContractSignature,
} from '../../lib/commercialContractSignatures'
import {
  CONTRACT_STATUS_LABEL,
  SERVICE_LEVEL_LABEL,
  PICKUP_FREQUENCY_LABEL,
  type CommercialContract,
} from '../../data/commercialContractData'
import { supabase } from '../../lib/supabase'

// ── Style constants ───────────────────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.09)',
  borderRadius: 14,
  padding:      16,
  marginBottom: 16,
}

const INPUT: React.CSSProperties = {
  width:        '100%',
  padding:      '10px 12px',
  borderRadius: 10,
  background:   'rgba(255,255,255,0.06)',
  border:       '1px solid rgba(255,255,255,0.12)',
  color:        '#fff',
  fontSize:     14,
  outline:      'none',
  boxSizing:    'border-box',
}

const FIELD_LABEL: React.CSSProperties = {
  fontSize:     11,
  fontWeight:   600,
  color:        'rgba(255,255,255,0.45)',
  display:      'block',
  marginBottom: 4,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatCurrency(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
}

// ── Term row ──────────────────────────────────────────────────────────────────

function TermRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Main screen
// ═════════════════════════════════════════════════════════════════════════════

export default function CommercialContractSignature() {
  const { contractId } = useParams<{ contractId: string }>()
  const navigate       = useNavigate()
  const { user }       = useAuthStore()

  const [contract,       setContract]       = useState<CommercialContract | null>(null)
  const [accountId,      setAccountId]      = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [working,        setWorking]        = useState(false)
  const [toast,          setToast]          = useState<string | null>(null)

  // Signature form fields
  const [signerName,     setSignerName]     = useState('')
  const [signerTitle,    setSignerTitle]    = useState('')
  const [signerEmail,    setSignerEmail]    = useState('')
  const [signatureText,  setSignatureText]  = useState('')
  const [authorized,     setAuthorized]     = useState(false)

  // Decline flow
  const [showDecline,    setShowDecline]    = useState(false)
  const [declineReason,  setDeclineReason]  = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load contract ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!contractId || !user) return

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        // Resolve account_id for this user
        const { data: acctData } = await supabase
          .from('commercial_accounts')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!acctData) {
          setError('No commercial account found for your profile.')
          setLoading(false)
          return
        }

        setAccountId(acctData.id)

        // Load active (or pending_signature) contract
        const result = await getActiveCommercialContract(acctData.id)
        if (!result.ok) {
          setError(result.error ?? 'Failed to load contract.')
          setLoading(false)
          return
        }
        if (!result.data || result.data.id !== contractId) {
          setError('Contract not found or you do not have access to it.')
          setLoading(false)
          return
        }
        setContract(result.data)

        // Pre-fill email from user profile
        if (user.email) setSignerEmail(user.email)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    })()
  }, [contractId, user])

  // ── Sign ──────────────────────────────────────────────────────────────────

  const handleSign = useCallback(async () => {
    if (!contract || !accountId || !signerName.trim() || !signatureText.trim() || !authorized) return
    setWorking(true)
    try {
      const result = await signCommercialContract({
        contractId:         contract.id,
        accountId,
        signerUserId:       user?.id ?? null,
        signerName:         signerName.trim(),
        signerTitle:        signerTitle.trim() || null,
        signerEmail:        signerEmail.trim() || null,
        signatureText:      signatureText.trim(),
        signatureIp:        null,   // client-side — not collected from browser
        signatureUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 250) : null,
      })

      if (result.ok) {
        showToast('Contract signed! Redirecting…')
        setTimeout(() => navigate('/commercial/contracts'), 1800)
      } else {
        showToast(result.error ?? 'Signature failed. Please try again.')
      }
    } finally {
      setWorking(false)
    }
  }, [contract, accountId, user, signerName, signerTitle, signerEmail, signatureText, authorized, navigate])

  // ── Decline ───────────────────────────────────────────────────────────────

  const handleDecline = useCallback(async () => {
    if (!contract || !declineReason.trim()) return
    setWorking(true)
    try {
      const result = await declineCommercialContractSignature(contract.id, declineReason.trim(), user?.id)
      if (result.ok) {
        showToast('Decline recorded. Redirecting…')
        setTimeout(() => navigate('/commercial/contracts'), 1800)
      } else {
        showToast(result.error ?? 'Failed to record decline.')
      }
    } finally {
      setWorking(false)
    }
  }, [contract, declineReason, user, navigate])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <PageHeader />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <Spinner />
        </div>
      </AppShell>
    )
  }

  if (error || !contract) {
    return (
      <AppShell>
        <PageHeader />
        <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }}>
          <button
            onClick={() => navigate('/commercial/contracts')}
            style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 0', marginBottom: 16 }}
          >
            ← Back to Contracts
          </button>
          <div style={{ padding: '16px 20px', borderRadius: 14, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#f87171', margin: 0 }}>
              {error ?? 'Contract could not be loaded.'}
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (contract.signature_status === 'signed') {
    return (
      <AppShell>
        <PageHeader />
        <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }}>
          <button
            onClick={() => navigate('/commercial/contracts')}
            style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 0', marginBottom: 16 }}
          >
            ← Back to Contracts
          </button>
          <div style={{ padding: '20px', borderRadius: 16, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>✅</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#4ade80', margin: '0 0 4px' }}>Contract Already Signed</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              This contract was signed on {contract.signed_at ? formatDate(contract.signed_at) : 'record'}.
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  const canSign = signerName.trim().length > 0 && signatureText.trim().length > 0 && authorized && !working

  return (
    <AppShell>
      <PageHeader />
      <div style={{ padding: '0 16px 100px', maxWidth: 600, margin: '0 auto' }}>

        {/* ── Back nav ── */}
        <button
          onClick={() => navigate('/commercial/contracts')}
          style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Contracts
        </button>

        {/* ── Title ── */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
            ✍️ Review & Sign Contract
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Review all terms carefully before signing. Your typed name serves as your electronic acknowledgement.
          </p>
        </div>

        {/* ── Legal disclaimer ── */}
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
            ⚠️ <strong style={{ color: '#fbbf24' }}>Legal Notice:</strong> Cyan's Brooklynn Recycling does not provide legal advice.
            By signing you acknowledge you have read and agree to the terms below.
            This is a typed electronic acknowledgement only.
          </p>
        </div>

        {/* ── Contract status ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <StatusBadge
            variant={contract.status === 'active' ? 'green' : contract.status === 'expired' || contract.status === 'cancelled' ? 'red' : 'yellow'}
            label={CONTRACT_STATUS_LABEL[contract.status]}
          />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>·</span>
          <span style={{
            padding:    '2px 8px',
            borderRadius: 999,
            fontSize:   10,
            fontWeight: 700,
            background: 'rgba(251,191,36,0.15)',
            border:     '1px solid rgba(251,191,36,0.35)',
            color:      '#fbbf24',
          }}>
            Awaiting Your Signature
          </span>
        </div>

        {/* ── Contract terms (read-only) ── */}
        <div style={{ ...GLASS, borderColor: 'rgba(0,200,255,0.15)' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#00c8ff', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
            📋 Contract Terms
          </p>

          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>
            {contract.contract_title}
          </p>

          <TermRow label="Service Level"      value={SERVICE_LEVEL_LABEL[contract.service_level]} />
          <TermRow label="Pickup Frequency"   value={PICKUP_FREQUENCY_LABEL[contract.pickup_frequency]} />
          <TermRow label="Bin Count"          value={contract.bin_count.toString()} />
          {contract.bin_types.length > 0 && (
            <TermRow label="Bin Types"        value={contract.bin_types.join(', ')} />
          )}
          <TermRow label="Start Date"         value={formatDate(contract.start_date)} />
          <TermRow label="End Date"           value={formatDate(contract.end_date)} />
          {contract.renewal_date && (
            <TermRow label="Renewal Date"     value={formatDate(contract.renewal_date)} />
          )}
          {contract.contract_value_monthly !== null && (
            <TermRow label="Monthly Value"    value={formatCurrency(contract.contract_value_monthly)} />
          )}
          {contract.contract_value_annual !== null && (
            <TermRow label="Annual Value"     value={formatCurrency(contract.contract_value_annual)} />
          )}

          <div style={{ paddingTop: 10 }}>
            <TermRow
              label="Emergency Pickup"
              value={<span style={{ color: contract.emergency_pickup_allowed ? '#4ade80' : '#f87171' }}>
                {contract.emergency_pickup_allowed ? 'Allowed' : 'Not included'}
              </span>}
            />
            <TermRow
              label="Overflow Pickup"
              value={<span style={{ color: contract.overflow_pickup_allowed ? '#4ade80' : '#f87171' }}>
                {contract.overflow_pickup_allowed ? 'Allowed' : 'Not included'}
              </span>}
            />
            <TermRow
              label="Contamination Policy"
              value={<span style={{ color: contract.contamination_policy_accepted ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                {contract.contamination_policy_accepted ? 'Accepted' : 'Pending'}
              </span>}
            />
          </div>

          {contract.notes && (
            <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', margin: '0 0 4px', letterSpacing: '0.05em' }}>Notes</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>{contract.notes}</p>
            </div>
          )}
        </div>

        {/* ── Contamination policy statement ── */}
        <div style={{ ...GLASS }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            ♻️ Contamination Policy
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.7 }}>
            The commercial account holder agrees to ensure all materials placed in recycling bins are clean, dry,
            and free of contamination. Cyan's Brooklynn Recycling reserves the right to reject contaminated
            loads, assess fees, or suspend service for repeated violations per the Service Agreement.
          </p>
        </div>

        {/* ── Signature form ── */}
        <div style={{ ...GLASS, borderColor: 'rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.04)' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>
            ✍️ Your Electronic Signature
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={FIELD_LABEL}>Full Name *</label>
            <input
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Your full legal name"
              style={INPUT}
              maxLength={120}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={FIELD_LABEL}>Title / Role</label>
              <input
                value={signerTitle}
                onChange={e => setSignerTitle(e.target.value)}
                placeholder="e.g. Operations Manager"
                style={INPUT}
                maxLength={80}
              />
            </div>
            <div>
              <label style={FIELD_LABEL}>Email Address</label>
              <input
                type="email"
                value={signerEmail}
                onChange={e => setSignerEmail(e.target.value)}
                placeholder="you@company.com"
                style={INPUT}
                maxLength={150}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ ...FIELD_LABEL, color: '#a78bfa' }}>
              Type Your Full Name to Sign *
              <span style={{ display: 'block', fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                Typing your name below constitutes your electronic acknowledgement of the above terms.
              </span>
            </label>
            <input
              value={signatureText}
              onChange={e => setSignatureText(e.target.value)}
              placeholder="Type your full name exactly…"
              style={{
                ...INPUT,
                fontFamily:   'Georgia, serif',
                fontSize:     18,
                fontStyle:    'italic',
                borderColor:  signatureText.trim().length > 0 ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.12)',
                background:   signatureText.trim().length > 0 ? 'rgba(139,92,246,0.08)' : INPUT.background,
              }}
              maxLength={120}
            />
          </div>

          {/* Authorization checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
            <input
              type="checkbox"
              checked={authorized}
              onChange={e => setAuthorized(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#a78bfa', marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              I confirm that I am authorized to sign on behalf of this commercial account, I have read all contract
              terms above, and I agree to be bound by them. I understand this is an electronic acknowledgement.
            </span>
          </label>

          {/* Sign button */}
          <PrimaryButton
            fullWidth
            disabled={!canSign}
            onClick={() => { void handleSign() }}
          >
            {working ? '⏳ Signing…' : '✍️ Sign Contract'}
          </PrimaryButton>

          {!canSign && !working && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>
              {!signerName.trim() ? 'Enter your full name to continue.' :
               !signatureText.trim() ? 'Type your name in the signature field.' :
               !authorized ? 'Check the authorization box to continue.' : ''}
            </p>
          )}
        </div>

        {/* ── Decline section ── */}
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          {!showDecline ? (
            <button
              onClick={() => setShowDecline(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(248,113,113,0.6)', cursor: 'pointer', fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}
            >
              I cannot sign — decline or request review
            </button>
          ) : (
            <div style={{ ...GLASS, borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.04)', textAlign: 'left' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#f87171', margin: '0 0 8px' }}>Decline Signature</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Declining will notify Cyan's Brooklynn Recycling to review the contract. Please provide a reason.
              </p>
              <textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="Reason for declining (required)…"
                rows={3}
                style={{ ...INPUT, resize: 'none', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setShowDecline(false); setDeclineReason('') }}
                  style={{ padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', flex: 1 }}
                >
                  Back
                </button>
                <button
                  onClick={() => { void handleDecline() }}
                  disabled={!declineReason.trim() || working}
                  style={{ padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', cursor: declineReason.trim() && !working ? 'pointer' : 'default', opacity: declineReason.trim() && !working ? 1 : 0.5, flex: 1 }}
                >
                  {working ? 'Submitting…' : 'Confirm Decline'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1a1f2e', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 12, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, zIndex: 10000, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </AppShell>
  )
}
