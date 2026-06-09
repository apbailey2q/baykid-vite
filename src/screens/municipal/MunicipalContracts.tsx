// MunicipalContracts.tsx — Municipal Partner Contract Read-Only View
//
// MU.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Route: /municipal/contracts
//
// Municipal users see their active contract terms, history timeline, and
// reporting requirements linked to the contract.
//
// Rules:
//   Municipal users may only VIEW — no edit controls
//   No payment processing, no ACH, no bank data (CLAUDE.md)
//   No "BayKid" in user-facing text

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import type {
  MunicipalContract, MunicipalContractHistory, MunicipalReportingRequirement,
  MunicipalContractSignature,
} from '../../types'
// MU.3 — signature certificate + exports
import { getLatestMunicipalContractSignature } from '../../lib/municipalContractSignatures'
import {
  copyMunicipalContractSummary, downloadMunicipalContractSummary,
} from '../../lib/municipalContractExports'
import MunicipalSignatureCertificate from '../../components/municipal/MunicipalSignatureCertificate'
import {
  SERVICE_LEVEL_LABELS, PROGRAM_TYPE_LABELS, REPORTING_FREQUENCY_LABELS,
  CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS,
  daysUntilDate, isMunicipalContractExpiringSoon,
} from '../../data/municipalContractData'

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.15)',
  borderRadius: 12,
  padding: '1.25rem',
  marginBottom: '1rem',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MunicipalContracts() {
  const { user }   = useAuthStore()
  const navigate   = useNavigate()
  const [profileId, setProfileId]   = useState<string | null>(null)
  const [contracts, setContracts]   = useState<MunicipalContract[]>([])
  const [selected, setSelected]     = useState<MunicipalContract | null>(null)
  const [history, setHistory]       = useState<MunicipalContractHistory[]>([])
  const [reports, setReports]       = useState<MunicipalReportingRequirement[]>([])
  const [loading, setLoading]       = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  // MU.3 — signature lookup for the selected contract + certificate visibility
  const [signature, setSignature]     = useState<MunicipalContractSignature | null>(null)
  const [showCertificate, setShowCertificate] = useState(false)
  const [copyToast, setCopyToast]     = useState('')

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      // Get municipal profile
      const { data: profile } = await supabase
        .from('municipal_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile) { setLoading(false); return }
      setProfileId(profile.id)

      const [contractRes, reportRes] = await Promise.all([
        supabase.from('municipal_contracts').select('*').eq('municipal_profile_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('municipal_reporting_requirements').select('*').eq('municipal_profile_id', profile.id).eq('status', 'active').order('next_due_date', { ascending: true }),
      ])

      const contractList = (contractRes.data ?? []) as MunicipalContract[]
      setContracts(contractList)
      setReports((reportRes.data ?? []) as MunicipalReportingRequirement[])

      // Auto-select the active/most recent contract
      const active = contractList.find(c => c.status === 'active')
        ?? contractList.find(c => c.status === 'pending_review')
        ?? contractList[0]
        ?? null
      setSelected(active)
      setLoading(false)
    })()
  }, [user?.id])

  const loadHistory = async (contractId: string) => {
    const { data } = await supabase
      .from('municipal_contract_history')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })
    setHistory((data ?? []) as MunicipalContractHistory[])
  }

  const handleSelectContract = (c: MunicipalContract) => {
    setSelected(c)
    setShowHistory(false)
    setHistory([])
    setShowCertificate(false)
  }

  // MU.3 — refresh signature row when the selected contract changes
  useEffect(() => {
    let cancelled = false
    if (!selected || selected.signature_status !== 'signed') {
      setSignature(null)
      return
    }
    ;(async () => {
      const sig = await getLatestMunicipalContractSignature(selected.id)
      if (!cancelled) setSignature(sig)
    })()
    return () => { cancelled = true }
  }, [selected?.id, selected?.signature_status, selected])

  const handleCopy = async () => {
    if (!selected) return
    const r = await copyMunicipalContractSummary(selected, signature)
    setCopyToast(r.ok ? 'Summary copied to clipboard.' : `Copy failed: ${r.error}`)
    setTimeout(() => setCopyToast(''), 3000)
  }

  const handleDownload = () => {
    if (!selected) return
    downloadMunicipalContractSummary(selected, signature)
    setCopyToast('Summary downloaded.')
    setTimeout(() => setCopyToast(''), 3000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#00c8ff' }}>Loading…</span>
      </div>
    )
  }

  if (!profileId) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8' }}>No municipal partner profile found.</p>
        <button onClick={() => navigate('/municipal/onboarding')} style={{ marginTop: '1rem', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 8, color: '#00c8ff', fontWeight: 600, padding: '0.6rem 1.2rem', cursor: 'pointer' }}>
          Start Onboarding →
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Cyan's Brooklynn Recycling Enterprise LLC
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: 0 }}>
            📄 Municipal Contracts
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 4 }}>
            View your service agreement terms and reporting requirements.
          </p>
        </div>

        {/* No contracts state */}
        {contracts.length === 0 && (
          <div style={{ ...CARD, textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            <h2 style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 600 }}>No Service Agreements Yet</h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: 400, margin: '0 auto' }}>
              Your municipal service agreement will appear here once an administrator creates it for your agency.
              If your onboarding application is approved, a service agreement will be drafted for your review.
            </p>
          </div>
        )}

        {/* Contract list (if more than 1) */}
        {contracts.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
            {contracts.map(c => {
              const st = CONTRACT_STATUS_COLORS[c.status] ?? CONTRACT_STATUS_COLORS.draft
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectContract(c)}
                  style={{
                    background: selected?.id === c.id ? st.bg : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selected?.id === c.id ? st.color + '66' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, color: selected?.id === c.id ? st.color : '#94a3b8',
                    fontWeight: 600, fontSize: '0.82rem', padding: '0.4rem 0.9rem', cursor: 'pointer',
                  }}
                >
                  {c.contract_title} — {CONTRACT_STATUS_LABELS[c.status]}
                </button>
              )
            })}
          </div>
        )}

        {/* Selected contract detail */}
        {selected && (
          <>
            {/* Expiring soon banner */}
            {isMunicipalContractExpiringSoon(selected) && (
              <div style={{ ...CARD, borderColor: 'rgba(255,214,0,0.4)', background: 'rgba(255,214,0,0.06)', marginBottom: '1rem', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <div style={{ color: '#FFD600', fontWeight: 600 }}>Contract Expiring Soon</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                    This agreement expires in {daysUntilDate(selected.end_date)} days ({selected.end_date}).
                    Contact Cyan's Brooklynn Recycling to initiate renewal.
                  </div>
                </div>
              </div>
            )}

            {/* Contract title + status */}
            <div style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ color: '#e0f7ff', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0' }}>
                    {selected.contract_title}
                  </h2>
                  {selected.agency_name && (
                    <div style={{ color: '#7ec8e3', fontSize: '0.88rem' }}>{selected.agency_name}</div>
                  )}
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {/* MU.3 — Signature status row */}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Signature:
                </span>
                <span style={{
                  fontSize: '0.78rem', fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                  ...sigBadgeStyle(selected.signature_status),
                }}>
                  {sigStatusLabel(selected.signature_status)}
                </span>
                {selected.signed_at && (
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    on {new Date(selected.signed_at).toLocaleDateString()}
                  </span>
                )}
                {signature?.signer_name && (
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    by {signature.signer_name}
                  </span>
                )}
              </div>

              {/* MU.3 — Pending signature banner */}
              {selected.signature_status === 'pending_signature' && (
                <div style={{
                  marginTop: 12, padding: '0.8rem 1rem', background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.35)', borderRadius: 8,
                  display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>✍️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem' }}>
                      Awaiting your signature
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      An administrator has requested your signature on this agreement. Review the terms and sign when ready.
                    </div>
                  </div>
                </div>
              )}

              {/* MU.3 — Action buttons */}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected.signature_status === 'pending_signature' && (
                  <Link to={`/municipal/contracts/sign/${selected.id}`}
                        style={partnerBtnStyle('primary')}>
                    ✍ Review & Sign Contract
                  </Link>
                )}
                <Link to={`/municipal/contracts/print/${selected.id}`}
                      style={partnerBtnStyle('secondary')}>
                  🖨 Print Contract
                </Link>
                <button onClick={handleCopy} style={partnerBtnStyle('secondary')}>
                  📋 Copy Summary
                </button>
                <button onClick={handleDownload} style={partnerBtnStyle('secondary')}>
                  ⬇ Download Summary
                </button>
                {selected.signature_status === 'signed' && signature && (
                  <button onClick={() => setShowCertificate(s => !s)}
                          style={partnerBtnStyle('secondary')}>
                    📜 {showCertificate ? 'Hide' : 'View'} Signature Certificate
                  </button>
                )}
              </div>

              {copyToast && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(0,200,255,0.08)',
                              border: '1px solid rgba(0,200,255,0.25)', borderRadius: 6,
                              fontSize: '0.78rem', color: '#00c8ff' }}>
                  {copyToast}
                </div>
              )}

              {/* Disclaimer */}
              <div style={{ marginTop: '1rem', padding: '0.6rem 0.8rem', background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 6, fontSize: '0.78rem', color: '#7ec8e3' }}>
                This record documents service terms and reporting requirements only.
                It does not process payments. Cyan's Brooklynn Recycling Enterprise LLC does not provide legal advice regarding contract enforceability.
              </div>

              {/* MU.3 — Inline signature certificate */}
              {showCertificate && signature && (
                <div style={{ marginTop: '1rem' }}>
                  <MunicipalSignatureCertificate contract={selected} signature={signature} />
                </div>
              )}
            </div>

            {/* Service terms */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>

              <div style={CARD}>
                <SectionHeader>Service Terms</SectionHeader>
                <ContractRow label="Service Level"    value={SERVICE_LEVEL_LABELS[selected.service_level] ?? selected.service_level} />
                <ContractRow label="Program Type"     value={PROGRAM_TYPE_LABELS[selected.program_type] ?? selected.program_type} />
                <ContractRow label="Reporting"        value={REPORTING_FREQUENCY_LABELS[selected.reporting_frequency] ?? selected.reporting_frequency} />
                {selected.contamination_threshold_percent != null && (
                  <ContractRow label="Contamination Limit" value={`${selected.contamination_threshold_percent}%`} />
                )}
              </div>

              <div style={CARD}>
                <SectionHeader>Contract Dates</SectionHeader>
                <ContractRow label="Start Date"    value={selected.start_date   ?? 'Not set'} />
                <ContractRow label="End Date"      value={selected.end_date     ?? 'Not set'} />
                <ContractRow label="Renewal Date"  value={selected.renewal_date ?? 'Not set'} />
                {selected.end_date && (
                  <ContractRow
                    label="Days Remaining"
                    value={(() => {
                      const d = daysUntilDate(selected.end_date)
                      if (d === null) return 'N/A'
                      if (d < 0)  return `${Math.abs(d)} days past end`
                      return `${d} days`
                    })()}
                  />
                )}
              </div>

              <div style={CARD}>
                <SectionHeader>Reporting Requirements</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ReqFlag label="Council Reporting"   active={selected.council_reporting_required} />
                  <ReqFlag label="Grant Reporting"     active={selected.grant_reporting_required} />
                  <ReqFlag label="Public Education"    active={selected.public_education_required} />
                </div>
              </div>

              {(selected.service_zones.length > 0 || selected.covered_locations.length > 0) && (
                <div style={CARD}>
                  <SectionHeader>Service Zones & Locations</SectionHeader>
                  {selected.service_zones.length > 0 && (
                    <div style={{ marginBottom: '0.6rem' }}>
                      <div style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>SERVICE ZONES</div>
                      {selected.service_zones.map(z => <ZoneTag key={z} value={z} />)}
                    </div>
                  )}
                  {selected.covered_locations.length > 0 && (
                    <div>
                      <div style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>COVERED LOCATIONS</div>
                      {selected.covered_locations.map(l => <ZoneTag key={l} value={l} />)}
                    </div>
                  )}
                </div>
              )}

              {(selected.estimated_monthly_volume_lbs != null || selected.estimated_annual_diversion_lbs != null) && (
                <div style={CARD}>
                  <SectionHeader>Volume Estimates</SectionHeader>
                  {selected.estimated_monthly_volume_lbs != null && (
                    <ContractRow label="Monthly Volume" value={`${selected.estimated_monthly_volume_lbs.toLocaleString()} lbs`} />
                  )}
                  {selected.estimated_annual_diversion_lbs != null && (
                    <ContractRow label="Annual Diversion" value={`${selected.estimated_annual_diversion_lbs.toLocaleString()} lbs`} />
                  )}
                  <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#64748b' }}>
                    Estimates are for planning purposes only.
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {selected.notes && (
              <div style={CARD}>
                <SectionHeader>Notes</SectionHeader>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, lineHeight: 1.6 }}>{selected.notes}</p>
              </div>
            )}

            {/* Active reporting requirements linked to this contract */}
            {reports.length > 0 && (
              <div style={CARD}>
                <SectionHeader>Active Reporting Requirements ({reports.length})</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reports.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div>
                        <div style={{ color: '#e0f7ff', fontWeight: 600, fontSize: '0.88rem' }}>{r.report_title}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 2 }}>
                          {REPORTING_FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                          {r.next_due_date ? ` · Due: ${r.next_due_date}` : ''}
                        </div>
                      </div>
                      {r.next_due_date && (
                        <DueBadge dueDate={r.next_due_date} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            <div style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <SectionHeader>Contract History</SectionHeader>
                <button
                  onClick={async () => {
                    if (!showHistory) await loadHistory(selected.id)
                    setShowHistory(v => !v)
                  }}
                  style={{ background: 'none', border: 'none', color: '#7ec8e3', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  {showHistory ? 'Hide ▲' : 'Show ▼'}
                </button>
              </div>
              {showHistory && (
                history.length === 0
                  ? <p style={{ color: '#64748b', fontSize: '0.84rem' }}>No history records.</p>
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {history.map(h => (
                        <div key={h.id} style={{ display: 'flex', gap: 12, fontSize: '0.84rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                          <div style={{ color: '#7ec8e3', flexShrink: 0, minWidth: 100, fontSize: '0.75rem' }}>
                            {new Date(h.created_at).toLocaleDateString()}
                          </div>
                          <div>
                            <div style={{ color: '#e0f7ff', fontWeight: 600, textTransform: 'capitalize' }}>
                              {h.action_type.replace(/_/g, ' ')}
                            </div>
                            {h.change_summary && (
                              <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 2 }}>{h.change_summary}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
      {children}
    </div>
  )
}

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: '0.85rem' }}>
      <span style={{ color: '#7ec8e3', minWidth: 120, fontWeight: 600, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#e0f7ff' }}>{value}</span>
    </div>
  )
}

function ReqFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
      <span>{active ? '✅' : '⬜'}</span>
      <span style={{ color: active ? '#4ade80' : '#64748b' }}>{label}</span>
    </div>
  )
}

function ZoneTag({ value }: { value: string }) {
  return (
    <span style={{ display: 'inline-block', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 6, color: '#7ec8e3', fontSize: '0.78rem', padding: '2px 8px', marginRight: 4, marginBottom: 4 }}>
      {value}
    </span>
  )
}

function StatusBadge({ status }: { status: MunicipalContract['status'] }) {
  const c = CONTRACT_STATUS_COLORS[status] ?? CONTRACT_STATUS_COLORS.draft
  return (
    <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: c.color, background: c.bg, border: `1px solid ${c.color}44` }}>
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  )
}

// MU.3 — Signature badge + button styling helpers ───────────────────────────

function sigBadgeStyle(status: MunicipalContract['signature_status']): React.CSSProperties {
  const map: Record<MunicipalContract['signature_status'], { color: string; bg: string }> = {
    not_requested:     { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
    pending_signature: { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
    signed:            { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
    declined:          { color: '#f87171', bg: 'rgba(248,113,113,0.10)' },
    expired:           { color: '#c084fc', bg: 'rgba(168,85,247,0.10)' },
  }
  const m = map[status] ?? map.not_requested
  return { color: m.color, background: m.bg, border: `1px solid ${m.color}44` }
}

function sigStatusLabel(status: MunicipalContract['signature_status']): string {
  switch (status) {
    case 'not_requested':     return 'Not requested'
    case 'pending_signature': return 'Pending signature'
    case 'signed':            return 'Signed'
    case 'declined':          return 'Declined'
    case 'expired':           return 'Expired'
  }
}

function partnerBtnStyle(variant: 'primary' | 'secondary'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '0.5rem 0.9rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700,
    cursor: 'pointer', textDecoration: 'none', display: 'inline-block', border: '1px solid',
  }
  if (variant === 'primary') {
    return { ...base, background: 'rgba(0,200,255,0.15)', borderColor: 'rgba(0,200,255,0.4)', color: '#00c8ff' }
  }
  return { ...base, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)', color: '#e0f7ff' }
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const days = daysUntilDate(dueDate)
  if (days === null) return null
  const overdue = days < 0
  const soon    = days <= 7
  const color   = overdue ? '#f87171' : soon ? '#FFD600' : '#4ade80'
  const text    = overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d`
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
      {text}
    </span>
  )
}
