// MunicipalSignatureCertificate.tsx — MU.3
//
// Cyan's Brooklynn Recycling Enterprise LLC
//
// Renders a printable certificate for a signed municipal contract. Does NOT
// claim notarization, legal validation, or third-party verification — it is
// a record of the typed signature + authorization acknowledgment that the
// signer made in the app.

import type { MunicipalContract, MunicipalContractSignature } from '../../types'

interface Props {
  contract:  MunicipalContract
  signature: MunicipalContractSignature
}

const CARD: React.CSSProperties = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.25)',
  borderRadius: 14,
  padding: '24px 22px',
  color: '#e6edf6',
  maxWidth: 720,
  margin: '0 auto',
}

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)',
}

const VALUE: React.CSSProperties = {
  fontSize: 14, color: '#fff', marginTop: 4, wordBreak: 'break-word',
}

const ROW: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, alignItems: 'baseline',
  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
}

export default function MunicipalSignatureCertificate({ contract, signature }: Props) {
  const signedDate = new Date(signature.signed_at)
  return (
    <article style={CARD} aria-label="Municipal Contract Signature Certificate">
      <header style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(0,200,255,0.25)' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(0,200,255,0.85)', textTransform: 'uppercase', margin: 0 }}>
          Cyan&rsquo;s Brooklynn Recycling Enterprise LLC
        </p>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginTop: 8, marginBottom: 4 }}>
          Municipal Contract Signature Certificate
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
          Internal record of typed signature and authorization acknowledgment.
        </p>
      </header>

      <div role="list">
        <CertRow label="Contract ID"      value={contract.id} mono />
        <CertRow label="Agreement"        value={contract.contract_title} />
        <CertRow label="Agency"           value={contract.agency_name ?? '—'} />
        <CertRow label="Agency type"      value={contract.agency_type ?? '—'} />
        <CertRow label="Service level"    value={contract.service_level} />
        <CertRow label="Program type"     value={contract.program_type} />
        <CertRow label="Service zones"    value={(contract.service_zones ?? []).join(', ') || '—'} />
        <CertRow label="Start date"       value={contract.start_date ?? '—'} />
        <CertRow label="End date"         value={contract.end_date ?? '—'} />
        <CertRow label="Renewal date"     value={contract.renewal_date ?? '—'} />

        <div style={{ height: 14 }} />

        <CertRow label="Signer name"      value={signature.signer_name} />
        <CertRow label="Signer title"     value={signature.signer_title ?? '—'} />
        <CertRow label="Signer email"     value={signature.signer_email ?? '—'} />
        <CertRow
          label="Typed signature"
          value={signature.signature_text}
          extraStyle={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive', fontSize: 22 }}
        />
        <CertRow
          label="Signed at"
          value={`${signedDate.toLocaleString()} (UTC: ${signedDate.toISOString()})`}
        />
        <CertRow label="Contract version" value={signature.contract_version} mono />
      </div>

      <p style={{
        marginTop: 20, padding: '14px 16px', fontSize: 12, lineHeight: 1.6,
        color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
      }}>
        This certificate records that the signer typed their name and acknowledged
        authorization to sign on behalf of the municipal agency. It does not constitute
        notarization, legal validation, or third-party verification.
      </p>
    </article>
  )
}

function CertRow({
  label, value, mono, extraStyle,
}: { label: string; value: string; mono?: boolean; extraStyle?: React.CSSProperties }) {
  return (
    <div style={ROW} role="listitem">
      <div style={LABEL}>{label}</div>
      <div style={{
        ...VALUE,
        ...(mono ? { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 } : {}),
        ...(extraStyle ?? {}),
      }}>
        {value}
      </div>
    </div>
  )
}
