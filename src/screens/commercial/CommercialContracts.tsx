// ─────────────────────────────────────────────────────────────────────────────
// CO.3 — Commercial Contracts Screen
// Route: /commercial/contracts
// ─────────────────────────────────────────────────────────────────────────────
//
// Displays the active service contract for the logged-in commercial account
// with full details (service level, pickup frequency, permissions, dates) and
// a contract history timeline.
//
// Data source: commercial_contracts + commercial_contract_history tables.
// Falls back to emptyContract() placeholder if no DB record exists.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }                       from 'react-router-dom'
import { supabase }                          from '../../lib/supabase'
import { useAuthStore }                      from '../../store/authStore'
import { AppShell }                          from '../../components/ui/AppShell'
import { PageHeader }                        from '../../components/ui/PageHeader'
import { GlassCard }                         from '../../components/ui/GlassCard'
import { PrimaryButton }                     from '../../components/ui/PrimaryButton'
import { Spinner }                           from '../../components/ui/Spinner'
import { EmptyState }                        from '../../components/ui/EmptyState'
import {
  getActiveCommercialContract,
  getCommercialContracts,
  getCommercialContractHistory,
} from '../../lib/commercialContracts'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_COLOR,
  SERVICE_LEVEL_LABEL,
  PICKUP_FREQUENCY_LABEL,
  ACTION_TYPE_LABEL,
  daysUntilExpiry,
  isContractExpiringSoon,
  emptyContract,
  type CommercialContract,
  type CommercialContractHistory,
} from '../../data/commercialContractData'

// ── Types ─────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'ready' | 'error' | 'no_account'

// ── Constants ─────────────────────────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  padding:      16,
}

// ── Helper components ─────────────────────────────────────────────────────────

function InfoRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: color ?? '#fff', fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>
        {value}
      </span>
    </div>
  )
}

function BooleanPill({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <span style={{
      padding:      '2px 8px',
      borderRadius: 999,
      fontSize:     11,
      fontWeight:   700,
      background:   value ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
      color:        value ? '#4ade80' : 'rgba(255,255,255,0.4)',
      border:       `1px solid ${value ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.12)'}`,
    }}>
      {value ? trueLabel : falseLabel}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommercialContracts() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()

  const [pageState,  setPageState]  = useState<PageState>('loading')
  const [contract,   setContract]   = useState<CommercialContract | null>(null)
  const [allContracts, setAllContracts] = useState<CommercialContract[]>([])
  const [history,    setHistory]    = useState<CommercialContractHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) { setPageState('no_account'); return }
    setPageState('loading')

    const { data: account } = await supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!account?.id) { setPageState('no_account'); return }

    const [activeResult, allResult] = await Promise.all([
      getActiveCommercialContract(account.id),
      getCommercialContracts(account.id),
    ])

    if (!activeResult.ok) { setPageState('error'); return }

    const active = activeResult.data
    setContract(active ?? emptyContract(account.id))
    setAllContracts(allResult.data ?? [])

    // Load history for the active contract
    if (active?.id) {
      const histResult = await getCommercialContractHistory(active.id)
      setHistory(histResult.data ?? [])
    }

    setPageState('ready')
  }, [user])

  useEffect(() => { void load() }, [load])

  // Reload history when tab opens
  useEffect(() => {
    if (!showHistory || !contract?.id || !contract.id) return
    void (async () => {
      const histResult = await getCommercialContractHistory(contract.id)
      setHistory(histResult.data ?? [])
    })()
  }, [showHistory, contract])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <AppShell>
        <PageHeader />
        <div className="flex justify-center items-center" style={{ minHeight: 200 }}>
          <Spinner />
        </div>
      </AppShell>
    )
  }

  if (pageState === 'no_account') {
    return (
      <AppShell>
        <PageHeader />
        <EmptyState
          icon="📋"
          title="No Commercial Account"
          description="You need a commercial account to view contracts."
          action={{ label: 'Go to Dashboard', onClick: () => navigate('/dashboard/commercial') }}
        />
      </AppShell>
    )
  }

  if (pageState === 'error') {
    return (
      <AppShell>
        <PageHeader />
        <EmptyState
          icon="⚠️"
          title="Failed to Load Contract"
          description="Could not load contract data. Please try again."
          action={{ label: 'Retry', onClick: () => void load() }}
        />
      </AppShell>
    )
  }

  if (!contract) return null

  const isPlaceholder  = !contract.id
  const daysLeft       = daysUntilExpiry(contract.end_date)
  const expiringSoon   = isContractExpiringSoon(contract.end_date)

  return (
    <AppShell>
      <PageHeader />
      <div style={{ padding: '0 16px 96px', maxWidth: 600, margin: '0 auto' }}>

        {/* ── Back button ── */}
        <button
          onClick={() => navigate('/dashboard/commercial')}
          style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '8px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Dashboard
        </button>

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
            📋 Contracts & Service Agreement
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            View your active service agreement, permissions, and renewal schedule.
          </p>
        </div>

        {/* ── No contract notice ── */}
        {isPlaceholder && (
          <div style={{
            background:   'rgba(251,191,36,0.08)',
            border:       '1px solid rgba(251,191,36,0.25)',
            borderRadius: 14,
            padding:      '12px 16px',
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', margin: '0 0 4px' }}>
              📋 No Active Contract On File
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.5 }}>
              Contact Cyan&apos;s Brooklynn Recycling to set up your service agreement.
            </p>
          </div>
        )}

        {/* ── Contract status header card ── */}
        <div style={{ marginBottom: 16 }}><GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
                {contract.contract_title}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                {SERVICE_LEVEL_LABEL[contract.service_level]} Plan
              </p>
            </div>
            <span style={{
              flexShrink: 0,
              padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, marginLeft: 8,
              background: `${CONTRACT_STATUS_COLOR[contract.status]}22`,
              color: CONTRACT_STATUS_COLOR[contract.status],
              border: `1px solid ${CONTRACT_STATUS_COLOR[contract.status]}44`,
            }}>
              {CONTRACT_STATUS_LABEL[contract.status]}
            </span>
          </div>

          {/* Renewal / expiry alert */}
          {expiringSoon && daysLeft !== null && daysLeft >= 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(251,191,36,0.1)', borderRadius: 10, border: '1px solid rgba(251,191,36,0.25)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                ⚠️ Contract expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}
              </p>
            </div>
          )}
          {daysLeft !== null && daysLeft < 0 && contract.status === 'active' && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: 10, border: '1px solid rgba(248,113,113,0.25)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171', margin: 0 }}>
                ⛔ Contract end date has passed — contact support
              </p>
            </div>
          )}
        </GlassCard></div>

        {/* ── Service details ── */}
        <div style={{ ...GLASS, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
            Service Details
          </p>
          <InfoRow label="Service Level"     value={SERVICE_LEVEL_LABEL[contract.service_level]} />
          <InfoRow label="Pickup Frequency"  value={PICKUP_FREQUENCY_LABEL[contract.pickup_frequency]} />
          <InfoRow label="Bin Count"         value={contract.bin_count} />
          {contract.bin_types.length > 0 && (
            <InfoRow label="Bin Types" value={contract.bin_types.join(', ')} />
          )}
        </div>

        {/* ── Permissions ── */}
        <div style={{ ...GLASS, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
            Permissions & Policies
          </p>
          <InfoRow
            label="Emergency Pickup"
            value={<BooleanPill value={contract.emergency_pickup_allowed} trueLabel="Authorized" falseLabel="Not Authorized" />}
          />
          <InfoRow
            label="Overflow Pickup"
            value={<BooleanPill value={contract.overflow_pickup_allowed} trueLabel="Authorized" falseLabel="Not Authorized" />}
          />
          <InfoRow
            label="Contamination Policy"
            value={<BooleanPill value={contract.contamination_policy_accepted} trueLabel="Accepted" falseLabel="Pending" />}
          />
        </div>

        {/* ── Contract dates ── */}
        <div style={{ ...GLASS, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
            Contract Dates
          </p>
          <InfoRow label="Start Date"   value={formatDate(contract.start_date)} />
          <InfoRow
            label="End Date"
            value={
              contract.end_date
                ? <span style={{ color: expiringSoon ? '#fbbf24' : daysLeft !== null && daysLeft < 0 ? '#f87171' : '#fff' }}>
                    {formatDate(contract.end_date)}
                  </span>
                : '—'
            }
          />
          <InfoRow
            label="Renewal Date"
            value={formatDate(contract.renewal_date ?? contract.end_date)}
          />
        </div>

        {/* ── Contract value (informational only) ── */}
        {(contract.contract_value_monthly !== null || contract.contract_value_annual !== null) && (
          <div style={{ ...GLASS, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
              Service Value
            </p>
            {contract.contract_value_monthly !== null && (
              <InfoRow label="Monthly"  value={formatCurrency(contract.contract_value_monthly)} />
            )}
            {contract.contract_value_annual !== null && (
              <InfoRow label="Annual"   value={formatCurrency(contract.contract_value_annual)} />
            )}
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '8px 0 0', lineHeight: 1.5 }}>
              * For reference only. Cyan&apos;s Brooklynn Recycling does not process payments through this platform.
            </p>
          </div>
        )}

        {/* ── Notes ── */}
        {contract.notes && (
          <div style={{ ...GLASS, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
              Notes
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.6 }}>
              {contract.notes}
            </p>
          </div>
        )}

        {/* ── Contract history ── */}
        {!isPlaceholder && (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setShowHistory(p => !p)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>📅 Contract History</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {showHistory ? '▲ Hide' : `▼ Show${history.length > 0 ? ` (${history.length})` : ''}`}
              </span>
            </button>
            {showHistory && (
              <div style={{ borderRadius: '0 0 12px 12px', border: '1px solid rgba(255,255,255,0.09)', borderTop: 'none', padding: '4px 0 4px' }}>
                {history.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                    No history recorded yet.
                  </p>
                ) : (
                  history.map((h, i) => (
                    <div
                      key={h.id}
                      style={{
                        padding:      '10px 16px',
                        borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        display:      'flex',
                        gap:          12,
                        alignItems:   'flex-start',
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>
                        {h.action_type === 'created'        ? '✅' :
                         h.action_type === 'renewed'        ? '🔄' :
                         h.action_type === 'cancelled'      ? '❌' :
                         h.action_type === 'expired'        ? '⏰' :
                         h.action_type === 'status_changed' ? '🔀' :
                         h.action_type === 'note_added'     ? '📝' : '📋'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>
                          {ACTION_TYPE_LABEL[h.action_type]}
                        </p>
                        {h.change_summary && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 2px', lineHeight: 1.4 }}>
                            {h.change_summary}
                          </p>
                        )}
                        {h.previous_status && h.new_status && (
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                            {h.previous_status} → {h.new_status}
                          </p>
                        )}
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
                          {formatDateShort(h.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ── All contracts ── */}
        {allContracts.length > 1 && (
          <div style={{ ...GLASS, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
              Contract History ({allContracts.length} records)
            </p>
            {allContracts.map(c => (
              <div
                key={c.id}
                style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  padding:        '8px 0',
                  borderBottom:   '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>{c.contract_title}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
                    {formatDateShort(c.start_date)} – {formatDateShort(c.end_date)}
                  </p>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, flexShrink: 0,
                  background: `${CONTRACT_STATUS_COLOR[c.status]}22`,
                  color: CONTRACT_STATUS_COLOR[c.status],
                  border: `1px solid ${CONTRACT_STATUS_COLOR[c.status]}44`,
                }}>
                  {CONTRACT_STATUS_LABEL[c.status]}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryButton
            fullWidth
            variant="secondary"
            onClick={() => navigate('/commercial/documents')}
          >
            📄 View Compliance Documents
          </PrimaryButton>
          <PrimaryButton
            fullWidth
            variant="secondary"
            onClick={() => navigate('/dashboard/commercial/support')}
          >
            📞 Contact Support About Contract
          </PrimaryButton>
        </div>

        {/* ── Disclaimer ── */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
          For contract amendments, renewals, or service level changes, contact<br />
          Cyan&apos;s Brooklynn Recycling Enterprise LLC directly.
        </p>

      </div>
    </AppShell>
  )
}
