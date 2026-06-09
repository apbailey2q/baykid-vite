// MunicipalContractPrintView.tsx — MU.3
//
// Cyan's Brooklynn Recycling Enterprise LLC
//
// Route: /municipal/contracts/print/:contractId
// Access: admin + municipal roles
//
// Print-friendly white-on-black-flipped layout. Uses window.print() — no PDF
// libraries, no external services. If the contract has a signature, includes
// the certificate block at the bottom.

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  SERVICE_LEVEL_LABELS, PROGRAM_TYPE_LABELS, REPORTING_FREQUENCY_LABELS,
} from '../../data/municipalContractData'
import { getLatestMunicipalContractSignature } from '../../lib/municipalContractSignatures'
import MunicipalSignatureCertificate from '../../components/municipal/MunicipalSignatureCertificate'
import type {
  MunicipalContract, MunicipalContractSignature, MunicipalReportingRequirement,
} from '../../types'

// Print-mode CSS injected once on mount so the printed page is on white paper
// regardless of the app's dark theme.
const PRINT_CSS = `
@media print {
  body { background: white !important; color: black !important; }
  .no-print { display: none !important; }
  .print-page { background: white !important; color: black !important; }
  .print-card { background: white !important; border: 1px solid #ccc !important; color: black !important; }
  .print-label { color: #555 !important; }
  .print-value { color: black !important; }
  .print-mute  { color: #666 !important; }
  a { color: black !important; text-decoration: none !important; }
}
`

export default function MunicipalContractPrintView() {
  const { contractId } = useParams<{ contractId: string }>()
  const [contract, setContract]   = useState<MunicipalContract | null>(null)
  const [reqs, setReqs]           = useState<MunicipalReportingRequirement[]>([])
  const [signature, setSignature] = useState<MunicipalContractSignature | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!contractId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Missing contract ID.')
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      try {
        const { data, error: cErr } = await supabase
          .from('municipal_contracts').select('*').eq('id', contractId).maybeSingle()
        if (cancelled) return
        if (cErr || !data) {
          setError(cErr?.message ?? 'Contract not found.')
        } else {
          setContract(data as MunicipalContract)
          try {
            const { data: rs } = await supabase
              .from('municipal_reporting_requirements').select('*').eq('contract_id', contractId)
            if (!cancelled) setReqs((rs ?? []) as MunicipalReportingRequirement[])
          } catch { /* ignore */ }
          if ((data as MunicipalContract).signature_status === 'signed') {
            const sig = await getLatestMunicipalContractSignature(contractId)
            if (!cancelled) setSignature(sig)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [contractId])

  if (loading) return <div style={pageStyle}><p style={{ color: 'rgba(255,255,255,0.7)' }}>Loading…</p></div>
  if (error || !contract) {
    return (
      <div style={pageStyle}>
        <p style={{ color: '#fca5a5' }}>❌ {error ?? 'Contract not found.'}</p>
        <Link to="/municipal/contracts" style={{ color: '#00c8ff' }}>← Back to contracts</Link>
      </div>
    )
  }

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="print-page" style={pageStyle}>

        {/* Toolbar — hidden in print */}
        <div className="no-print" style={{
          display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 16,
          padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Link to="/municipal/contracts" style={{ color: '#00c8ff', textDecoration: 'none', fontSize: 13 }}>
            ← Back to contracts
          </Link>
          <button onClick={() => window.print()} style={{
            background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.40)',
            color: '#00c8ff', padding: '8px 14px', borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            🖨️ Print / Save as PDF
          </button>
        </div>

        <header style={{ textAlign: 'center', marginBottom: 22 }}>
          <p className="print-mute" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(0,200,255,0.85)', textTransform: 'uppercase', margin: 0 }}>
            Cyan&rsquo;s Brooklynn Recycling Enterprise LLC
          </p>
          <h1 className="print-value" style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 6, marginBottom: 0 }}>
            {contract.contract_title}
          </h1>
        </header>

        <Section title="Agency information" className="print-card">
          <FieldRow label="Agency"        value={contract.agency_name ?? '—'} />
          <FieldRow label="Agency type"   value={contract.agency_type ?? '—'} />
        </Section>

        <Section title="Contract information" className="print-card">
          <FieldRow label="Service level"     value={SERVICE_LEVEL_LABELS[contract.service_level] ?? contract.service_level} />
          <FieldRow label="Program type"      value={PROGRAM_TYPE_LABELS[contract.program_type] ?? contract.program_type} />
          <FieldRow label="Reporting frequency" value={REPORTING_FREQUENCY_LABELS[contract.reporting_frequency] ?? contract.reporting_frequency} />
          <FieldRow label="Start date"        value={contract.start_date ?? '—'} />
          <FieldRow label="End date"          value={contract.end_date ?? '—'} />
          <FieldRow label="Renewal date"      value={contract.renewal_date ?? '—'} />
          <FieldRow label="Status"            value={contract.status} />
          <FieldRow label="Signature status"  value={contract.signature_status} />
          {contract.notes && <FieldRow label="Notes" value={contract.notes} />}
        </Section>

        <Section title="Service zones" className="print-card">
          <p className="print-value" style={{ fontSize: 13, color: '#fff' }}>
            {(contract.service_zones ?? []).join(', ') || '—'}
          </p>
        </Section>

        <Section title="Covered locations" className="print-card">
          <p className="print-value" style={{ fontSize: 13, color: '#fff' }}>
            {(contract.covered_locations ?? []).join(', ') || '—'}
          </p>
        </Section>

        {reqs.length > 0 && (
          <Section title="Reporting requirements" className="print-card">
            {reqs.map(r => (
              <FieldRow key={r.id} label={r.report_type} value={`${r.frequency} · status: ${r.status}`} />
            ))}
          </Section>
        )}

        {/* Signature section */}
        <Section title="Signature" className="print-card">
          {signature && contract.signature_status === 'signed' ? (
            <div style={{ background: 'white' }}>
              <MunicipalSignatureCertificate contract={contract} signature={signature} />
            </div>
          ) : (
            <p className="print-mute" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Not yet signed. Signature status: <strong className="print-value" style={{ color: '#fff' }}>{contract.signature_status}</strong>
            </p>
          )}
        </Section>

        <footer className="print-mute" style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 20 }}>
          Printed from Cyan&rsquo;s Brooklynn Recycling Enterprise LLC platform · Contract {contract.id}
        </footer>
      </div>
    </>
  )
}

// ── Style helpers ──────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  padding: '24px 16px', maxWidth: 820, margin: '0 auto', color: '#e6edf6',
}

function Section({
  title, children, className,
}: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className} style={{
      background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.18)',
      borderRadius: 14, padding: 18, marginBottom: 14,
    }}>
      <h2 className="print-mute" style={{
        fontSize: 11, fontWeight: 700, color: 'rgba(0,200,255,0.85)',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12,
      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
      alignItems: 'baseline',
    }}>
      <span className="print-label" style={{
        fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span className="print-value" style={{ fontSize: 13, color: '#fff', wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  )
}
