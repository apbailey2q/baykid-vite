// ─────────────────────────────────────────────────────────────────────────────
// CO.5 — Commercial Contract Print View
// Route: /commercial/contracts/print/:contractId
// ─────────────────────────────────────────────────────────────────────────────
//
// Clean printable/PDF-saveable view of a commercial service contract.
// Uses window.print() — no external PDF libraries required.
//
// PROHIBITED: Stripe, ACH, bank account numbers, routing numbers,
//   GPS tracking, external payment processors (CLAUDE.md).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase }               from '../../lib/supabase'
import { Spinner }                from '../../components/ui/Spinner'
import {
  CONTRACT_STATUS_LABEL,
  SERVICE_LEVEL_LABEL,
  PICKUP_FREQUENCY_LABEL,
  SIGNATURE_STATUS_LABEL,
  type CommercialContract,
  type CommercialContractSignature,
} from '../../data/commercialContractData'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function fmtCurrency(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
}

// ── Print styles injected once ────────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  body { background: #fff !important; color: #000 !important; }
  .no-print { display: none !important; }
  .print-page { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: 100% !important; }
  @page { margin: 1.5cm; }
}
`

// ── Row component ─────────────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: string }) {
  return (
    <tr>
      <td style={{ padding: '7px 12px 7px 0', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'top', whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6', width: '30%' }}>
        {label}
      </td>
      <td style={{ padding: '7px 0', fontSize: 13, color: highlight ?? '#111827', borderBottom: '1px solid #f3f4f6', lineHeight: 1.5 }}>
        {value}
      </td>
    </tr>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 6, borderBottom: '2px solid #e5e7eb', marginBottom: 8 }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Main screen
// ═════════════════════════════════════════════════════════════════════════════

export default function CommercialContractPrintView() {
  const { contractId } = useParams<{ contractId: string }>()
  const navigate       = useNavigate()

  const [contract,     setContract]     = useState<CommercialContract | null>(null)
  const [signature,    setSignature]    = useState<CommercialContractSignature | null>(null)
  const [businessName, setBusinessName] = useState<string>('')
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  // Inject print CSS once
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = PRINT_STYLES
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  // Load data
  useEffect(() => {
    if (!contractId) return
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        // Load contract (RLS enforces access)
        const { data: c, error: cErr } = await supabase
          .from('commercial_contracts')
          .select('*')
          .eq('id', contractId)
          .single()

        if (cErr || !c) {
          setError(cErr?.message ?? 'Contract not found.')
          return
        }
        setContract(c as CommercialContract)

        // Load business name
        const { data: acct } = await supabase
          .from('commercial_accounts')
          .select('business_name')
          .eq('id', (c as CommercialContract).account_id)
          .maybeSingle()
        if (acct) setBusinessName((acct as { business_name: string }).business_name)

        // Load latest signature
        const { data: sigs } = await supabase
          .from('commercial_contract_signatures')
          .select('*')
          .eq('contract_id', contractId)
          .order('signed_at', { ascending: false })
          .limit(1)
        if (sigs && sigs.length > 0) setSignature(sigs[0] as CommercialContractSignature)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    })()
  }, [contractId])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f9fafb' }}>
        <Spinner />
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', maxWidth: 500, margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          className="no-print"
          style={{ marginBottom: 16, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14 }}
        >
          ← Back
        </button>
        <div style={{ padding: 20, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
          <p style={{ fontWeight: 700, color: '#dc2626', margin: 0 }}>{error ?? 'Contract not found.'}</p>
        </div>
      </div>
    )
  }

  const printedAt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const hasValue  = contract.contract_value_monthly != null || contract.contract_value_annual != null

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Screen-only controls */}
      <div className="no-print" style={{ maxWidth: 700, margin: '0 auto 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          style={{ background: '#2563eb', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', marginLeft: 'auto' }}
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* Print page */}
      <div
        className="print-page"
        style={{
          background:   '#fff',
          borderRadius: 16,
          border:       '1px solid #e5e7eb',
          padding:      '40px 48px',
          maxWidth:     700,
          margin:       '0 auto',
          boxShadow:    '0 4px 24px rgba(0,0,0,0.08)',
          color:        '#111827',
          fontFamily:   'Georgia, serif',
        }}
      >
        {/* Document header */}
        <div style={{ textAlign: 'center', marginBottom: 32, paddingBottom: 20, borderBottom: '2px solid #111827' }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 6px', fontFamily: 'system-ui' }}>
            Cyan's Brooklynn Recycling Enterprise LLC
          </p>
          <p style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>
            Commercial Service Agreement
          </p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px', fontStyle: 'italic' }}>
            {contract.contract_title}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#374151', fontFamily: 'system-ui', fontWeight: 600 }}>
              Status: <span style={{ fontWeight: 700 }}>{CONTRACT_STATUS_LABEL[contract.status]}</span>
            </span>
            <span style={{ fontSize: 11, color: '#374151', fontFamily: 'system-ui', fontWeight: 600 }}>
              Signature: <span style={{ fontWeight: 700 }}>{SIGNATURE_STATUS_LABEL[contract.signature_status]}</span>
            </span>
          </div>
        </div>

        {/* Company & Account */}
        <Section title="Parties">
          <Row label="Service Provider" value="Cyan's Brooklynn Recycling Enterprise LLC" />
          {businessName && <Row label="Account / Customer" value={businessName} />}
          <Row label="Account ID" value={<code style={{ fontSize: 11, background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{contract.account_id}</code>} />
          <Row label="Contract ID" value={<code style={{ fontSize: 11, background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{contract.id}</code>} />
        </Section>

        {/* Service terms */}
        <Section title="Service Terms">
          <Row label="Service Level"     value={SERVICE_LEVEL_LABEL[contract.service_level]} />
          <Row label="Pickup Frequency"  value={PICKUP_FREQUENCY_LABEL[contract.pickup_frequency]} />
          <Row label="Bin Count"         value={contract.bin_count.toString()} />
          {contract.bin_types.length > 0 && (
            <Row label="Bin Types"       value={contract.bin_types.join(', ')} />
          )}
        </Section>

        {/* Permissions */}
        <Section title="Permissions & Policies">
          <Row
            label="Emergency Pickup"
            value={contract.emergency_pickup_allowed ? 'Authorized' : 'Not Authorized'}
            highlight={contract.emergency_pickup_allowed ? '#15803d' : '#b91c1c'}
          />
          <Row
            label="Overflow Pickup"
            value={contract.overflow_pickup_allowed ? 'Authorized' : 'Not Authorized'}
            highlight={contract.overflow_pickup_allowed ? '#15803d' : '#b91c1c'}
          />
          <Row
            label="Contamination Policy"
            value={contract.contamination_policy_accepted ? 'Accepted' : 'Pending Acceptance'}
            highlight={contract.contamination_policy_accepted ? '#15803d' : '#92400e'}
          />
        </Section>

        {/* Dates */}
        <Section title="Contract Dates">
          <Row label="Start Date"   value={fmtDate(contract.start_date)} />
          <Row label="End Date"     value={fmtDate(contract.end_date)} />
          <Row label="Renewal Date" value={fmtDate(contract.renewal_date)} />
        </Section>

        {/* Service value — always with disclaimer when present */}
        {hasValue && (
          <Section title="Service Value">
            {contract.contract_value_monthly != null && (
              <Row label="Monthly Value" value={fmtCurrency(contract.contract_value_monthly)} />
            )}
            {contract.contract_value_annual != null && (
              <Row label="Annual Value"  value={fmtCurrency(contract.contract_value_annual)} />
            )}
            <tr>
              <td colSpan={2} style={{ padding: '8px 0 0', fontSize: 10, color: '#9ca3af', lineHeight: 1.6, fontFamily: 'system-ui', borderBottom: '1px solid #f3f4f6' }}>
                ⚠ This record documents service terms only and does not process payments.
                Cyan&apos;s Brooklynn Recycling does not charge or process payments through this platform.
                These values are for bookkeeping reference after the fact only.
              </td>
            </tr>
          </Section>
        )}

        {/* Notes */}
        {contract.notes && (
          <Section title="Notes">
            <tr>
              <td colSpan={2} style={{ padding: '6px 0', fontSize: 13, color: '#374151', lineHeight: 1.6, borderBottom: '1px solid #f3f4f6' }}>
                {contract.notes}
              </td>
            </tr>
          </Section>
        )}

        {/* Signature record */}
        {signature ? (
          <div style={{ marginBottom: 28, padding: '20px 20px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, fontFamily: 'system-ui' }}>
              ✅ Signature Record
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="Signer Name"   value={<span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 15 }}>{signature.signer_name}</span>} />
                {signature.signer_title && <Row label="Title / Role"  value={signature.signer_title} />}
                {signature.signer_email && <Row label="Email"         value={signature.signer_email} />}
                <Row label="Signed At"     value={fmtDate(signature.signed_at)} />
                <Row label="Contract Ver." value={signature.contract_version} />
                <Row label="Signature"     value={<em style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#1d4ed8' }}>&ldquo;{signature.signature_text}&rdquo;</em>} />
              </tbody>
            </table>
            <p style={{ fontSize: 10, color: '#6b7280', marginTop: 10, lineHeight: 1.6, fontFamily: 'system-ui', margin: '10px 0 0' }}>
              This is a typed electronic acknowledgement. Platform does not provide legal advice or third-party e-signature validation.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 28, padding: '14px 20px', background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', margin: 0, fontFamily: 'system-ui' }}>
              Signature Status: {SIGNATURE_STATUS_LABEL[contract.signature_status]}
            </p>
          </div>
        )}

        {/* Document footer */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 9, color: '#9ca3af', margin: 0, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cyan's Brooklynn Recycling Enterprise LLC — Confidential Service Record
          </p>
          <p style={{ fontSize: 9, color: '#9ca3af', margin: 0, fontFamily: 'system-ui' }}>
            Printed: {printedAt}
          </p>
        </div>
      </div>
    </div>
  )
}
