// ─────────────────────────────────────────────────────────────────────────────
// CO.5 — Contract Signature Certificate Component
// ─────────────────────────────────────────────────────────────────────────────
//
// Displays a formal-style certificate confirming that the signer typed their
// name and acknowledged authorization to sign on behalf of the commercial account.
//
// This is a typed electronic acknowledgement ONLY.
// Platform does NOT provide legal advice, external notarization, or
// third-party e-signature validation (CLAUDE.md).
// ─────────────────────────────────────────────────────────────────────────────

import type { CommercialContractSignature, CommercialContract } from '../../data/commercialContractData'

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContractSignatureCertificateProps {
  signature: CommercialContractSignature
  contract?: CommercialContract | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month:  'long',
      day:    'numeric',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

function CertRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display:       'flex',
      padding:       '8px 0',
      borderBottom:  '1px solid rgba(0,0,0,0.07)',
      gap:           16,
      alignItems:    'flex-start',
    }}>
      <span style={{
        fontSize:   11,
        fontWeight: 700,
        color:      '#6b7280',
        minWidth:   160,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        paddingTop: 1,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontSize:   13,
        color:      '#111827',
        fontWeight: 500,
        lineHeight: 1.5,
      }}>
        {value}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function ContractSignatureCertificate({ signature, contract }: ContractSignatureCertificateProps) {
  return (
    <div style={{
      background:   '#fff',
      borderRadius: 16,
      border:       '2px solid #d1d5db',
      padding:      '28px 28px 24px',
      maxWidth:     560,
      fontFamily:   'Georgia, "Times New Roman", serif',
      color:        '#111827',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 6px', fontFamily: 'system-ui, sans-serif' }}>
          Cyan's Brooklynn Recycling Enterprise LLC
        </p>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px', letterSpacing: '0.01em' }}>
          Electronic Signature Certificate
        </p>
        {contract && (
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontFamily: 'system-ui, sans-serif' }}>
            {contract.contract_title}
          </p>
        )}
      </div>

      {/* Certificate fields */}
      <div style={{ marginBottom: 20 }}>
        <CertRow label="Contract ID"   value={<code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{signature.contract_id}</code>} />
        <CertRow label="Account ID"    value={<code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{signature.account_id}</code>} />
        <CertRow label="Signer Name"   value={<strong style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 15 }}>{signature.signer_name}</strong>} />
        {signature.signer_title && (
          <CertRow label="Title / Role"  value={signature.signer_title} />
        )}
        {signature.signer_email && (
          <CertRow label="Email"         value={signature.signer_email} />
        )}
        <CertRow label="Signed At"     value={fmtDate(signature.signed_at)} />
        <CertRow label="Contract Ver." value={signature.contract_version} />
        <CertRow
          label="Signature"
          value={
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 15, color: '#1d4ed8' }}>
              &ldquo;{signature.signature_text}&rdquo;
            </span>
          }
        />
        <CertRow
          label="Snapshot Hash"
          value={
            <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>
              {/* Snapshot hash is not cryptographically computed — placeholder for record-keeping */}
              contract-snapshot-v1 · ID: {signature.id.slice(0, 16)}…
            </span>
          }
        />
      </div>

      {/* Legal acknowledgement block */}
      <div style={{
        background:   '#f9fafb',
        border:       '1px solid #e5e7eb',
        borderRadius: 10,
        padding:      '12px 16px',
        marginBottom: 16,
      }}>
        <p style={{ fontSize: 11, color: '#374151', margin: 0, lineHeight: 1.8, fontFamily: 'system-ui, sans-serif' }}>
          This certificate records that the signer typed their name and acknowledged
          authorization to sign on behalf of the commercial account. This is a typed
          electronic acknowledgement only. Cyan&apos;s Brooklynn Recycling Enterprise LLC
          does not provide legal advice, external notarization, or third-party e-signature
          validation. The signature text and contract snapshot are preserved in the platform
          database as an immutable audit record.
        </p>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: 9, color: '#9ca3af', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}>
          Signature ID: {signature.id} · Generated {new Date().toLocaleDateString('en-US')}
        </p>
      </div>
    </div>
  )
}
