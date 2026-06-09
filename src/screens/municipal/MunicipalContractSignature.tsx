// MunicipalContractSignature.tsx — MU.3
//
// Cyan's Brooklynn Recycling Enterprise LLC
//
// Route: /municipal/contracts/sign/:contractId
// Access: admin + municipal roles (per routePermissions.ts)
//
// Municipal partner reviews the contract terms and either:
//   • Signs (typed name + authorization acknowledgment), or
//   • Declines / requests review (reason required)
//
// No external e-signature service. No payment processing. No bank account
// fields. No "BayKid" user-facing text.

import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import {
  SERVICE_LEVEL_LABELS, PROGRAM_TYPE_LABELS, REPORTING_FREQUENCY_LABELS,
} from '../../data/municipalContractData'
import {
  signMunicipalContract,
  declineMunicipalContractSignature,
} from '../../lib/municipalContractSignatures'
import type { MunicipalContract, MunicipalReportingRequirement } from '../../types'

// ── Local styles ────────────────────────────────────────────────────────────
const PAGE: React.CSSProperties = { padding: '24px 16px', maxWidth: 880, margin: '0 auto', color: '#e6edf6' }
const CARD: React.CSSProperties = {
  background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.18)',
  borderRadius: 14, padding: 22, marginBottom: 18,
}
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
  letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, marginTop: 12,
}
const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.22)',
  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const TEXTAREA: React.CSSProperties = {
  ...INPUT, minHeight: 80, resize: 'vertical', fontFamily: 'inherit',
}
const SIGNATURE_INPUT: React.CSSProperties = {
  ...INPUT,
  fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive',
  fontSize: 28,
  height: 56,
}
const FIELD_ROW: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14,
  padding: '6px 0', alignItems: 'baseline', borderBottom: '1px solid rgba(255,255,255,0.05)',
}
const FIELD_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
  letterSpacing: '0.05em', textTransform: 'uppercase',
}
const FIELD_VALUE: React.CSSProperties = { fontSize: 14, color: '#fff', wordBreak: 'break-word' }

export default function MunicipalContractSignature() {
  const { contractId } = useParams<{ contractId: string }>()
  const { user } = useAuthStore()

  const [contract, setContract] = useState<MunicipalContract | null>(null)
  const [reqs, setReqs]         = useState<MunicipalReportingRequirement[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Form state
  const [signerName, setSignerName]   = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [signerEmail, setSignerEmail] = useState(user?.email ?? '')
  const [signatureText, setSignatureText] = useState('')
  const [authorized, setAuthorized]   = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess]       = useState<{ message: string } | null>(null)

  // Decline modal state
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!contractId) {
      setLoadError('Contract ID missing in URL.')
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('municipal_contracts')
          .select('*')
          .eq('id', contractId)
          .maybeSingle()
        if (cancelled) return
        if (error || !data) {
          setLoadError(error?.message ?? 'Contract not found or you do not have access.')
        } else {
          setContract(data as MunicipalContract)
          // Best-effort fetch of reporting requirements scoped to this contract.
          try {
            const { data: reqRows } = await supabase
              .from('municipal_reporting_requirements')
              .select('*')
              .eq('contract_id', contractId)
            if (!cancelled) setReqs((reqRows ?? []) as MunicipalReportingRequirement[])
          } catch { /* ignore */ }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [contractId])

  const canSubmit = useMemo(() =>
    signerName.trim().length > 0 &&
    signerEmail.trim().length > 0 &&
    signatureText.trim().length > 0 &&
    authorized &&
    !submitting,
  [signerName, signerEmail, signatureText, authorized, submitting])

  const handleSign = async () => {
    if (!contract || !canSubmit) return
    setSubmitting(true); setSubmitError(null)
    const r = await signMunicipalContract({
      contract,
      signerName,
      signerTitle: signerTitle || null,
      signerEmail,
      signatureText,
    })
    setSubmitting(false)
    if (!r.ok) {
      setSubmitError(r.error ?? 'Could not record signature.')
      return
    }
    setSuccess({ message: 'Contract signed successfully.' })
  }

  const handleDecline = async () => {
    if (!contract) return
    setSubmitting(true); setSubmitError(null)
    const r = await declineMunicipalContractSignature(contract.id, declineReason)
    setSubmitting(false)
    if (!r.ok) {
      setSubmitError(r.error ?? 'Could not record decline.')
      return
    }
    setDeclineOpen(false)
    setSuccess({ message: 'Decline recorded. The contract has been moved to "needs review".' })
  }

  if (loading) {
    return <div style={PAGE}><p style={{ color: 'rgba(255,255,255,0.7)' }}>Loading…</p></div>
  }
  if (loadError || !contract) {
    return (
      <div style={PAGE}>
        <div style={CARD}>
          <p style={{ color: '#fca5a5' }}>❌ {loadError ?? 'Contract not found.'}</p>
          <Link to="/municipal/contracts" style={{ color: '#00c8ff' }}>← Back to contracts</Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={PAGE}>
        <div style={CARD}>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', marginBottom: 8 }}>✅ {success.message}</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            Reference: <code>{contract.id.slice(0, 8)}</code>
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link to="/municipal/contracts" style={btnStyle('primary')}>Back to contracts</Link>
            <Link to={`/municipal/contracts/print/${contract.id}`} style={btnStyle('secondary')}>Print contract</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={PAGE}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
        Review & Sign Municipal Contract
      </h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 18 }}>
        Cyan&rsquo;s Brooklynn Recycling Enterprise LLC
      </p>

      {/* ── Contract summary ── */}
      <section style={CARD}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
          {contract.contract_title}
        </h2>
        <Row label="Agency"             value={contract.agency_name ?? '—'} />
        <Row label="Agency type"        value={contract.agency_type ?? '—'} />
        <Row label="Service level"      value={SERVICE_LEVEL_LABELS[contract.service_level] ?? contract.service_level} />
        <Row label="Program type"       value={PROGRAM_TYPE_LABELS[contract.program_type] ?? contract.program_type} />
        <Row label="Service zones"      value={(contract.service_zones ?? []).join(', ') || '—'} />
        <Row label="Reporting frequency" value={REPORTING_FREQUENCY_LABELS[contract.reporting_frequency] ?? contract.reporting_frequency} />
        <Row label="Start date"         value={contract.start_date ?? '—'} />
        <Row label="End date"           value={contract.end_date ?? '—'} />
        <Row label="Renewal date"       value={contract.renewal_date ?? '—'} />
        {contract.notes && <Row label="Notes" value={contract.notes} />}
      </section>

      {reqs.length > 0 && (
        <section style={CARD}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
            Reporting Requirements
          </h2>
          {reqs.map(r => (
            <Row key={r.id} label={r.report_type} value={`${r.frequency} · status: ${r.status}`} />
          ))}
        </section>
      )}

      {/* ── Signing form ── */}
      <section style={CARD}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
          Signature
        </h2>

        <label style={LABEL}>Signer name *</label>
        <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)}
               placeholder="e.g. Jane Doe" style={INPUT} />

        <label style={LABEL}>Signer title</label>
        <input type="text" value={signerTitle} onChange={e => setSignerTitle(e.target.value)}
               placeholder="e.g. Director of Public Works" style={INPUT} />

        <label style={LABEL}>Signer email *</label>
        <input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)}
               placeholder="jane.doe@city.gov" style={INPUT} />

        <label style={LABEL}>Typed signature *</label>
        <input type="text" value={signatureText} onChange={e => setSignatureText(e.target.value)}
               placeholder="Type your full name to sign" style={SIGNATURE_INPUT} />

        <label className="flex items-start gap-2 cursor-pointer mt-4" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)}
                 style={{ accentColor: '#00c8ff', marginTop: 4 }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
            I am authorized to sign this municipal agreement on behalf of the agency.
          </span>
        </label>

        {submitError && (
          <p style={{ marginTop: 10, fontSize: 13, color: '#fca5a5' }}>{submitError}</p>
        )}

        <div className="flex gap-2 flex-wrap mt-4">
          <button onClick={handleSign} disabled={!canSubmit} style={btnStyle('primary', !canSubmit)}>
            {submitting ? 'Recording signature…' : 'Sign contract'}
          </button>
          <button onClick={() => setDeclineOpen(true)} disabled={submitting} style={btnStyle('secondary', submitting)}>
            Decline / Request review
          </button>
          <Link to="/municipal/contracts" style={btnStyle('ghost')}>Back</Link>
        </div>

        <p style={{ marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
          This is an internal signature record. It does not constitute notarization, legal validation,
          or third-party verification.
        </p>
      </section>

      {/* ── Decline modal ── */}
      {declineOpen && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ ...CARD, maxWidth: 480, width: '100%', margin: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
              Decline / Request review
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
              Describe what needs to be revised. The contract will be moved to &ldquo;needs review&rdquo; status.
            </p>
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)}
                      rows={4} placeholder="Reason for declining" style={TEXTAREA} />
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => setDeclineOpen(false)} style={btnStyle('ghost')}>Cancel</button>
              <button onClick={handleDecline} disabled={!declineReason.trim() || submitting}
                      style={btnStyle('danger', !declineReason.trim() || submitting)}>
                {submitting ? 'Submitting…' : 'Submit decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={FIELD_ROW}>
      <div style={FIELD_LABEL}>{label}</div>
      <div style={FIELD_VALUE}>{value}</div>
    </div>
  )
}

function btnStyle(variant: 'primary' | 'secondary' | 'ghost' | 'danger', disabled = false): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', textDecoration: 'none',
    opacity: disabled ? 0.55 : 1, border: '1px solid', display: 'inline-block',
  }
  switch (variant) {
    case 'primary':   return { ...base, background: 'rgba(0,200,255,0.15)',  borderColor: 'rgba(0,200,255,0.40)',  color: '#00c8ff' }
    case 'secondary': return { ...base, background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.18)', color: '#fff' }
    case 'ghost':     return { ...base, background: 'transparent',           borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.75)' }
    case 'danger':    return { ...base, background: 'rgba(239,68,68,0.12)',  borderColor: 'rgba(239,68,68,0.40)',  color: '#fca5a5' }
  }
}
