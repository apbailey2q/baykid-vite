// ─────────────────────────────────────────────────────────────────────────────
// CO.2 — Commercial Contracts Screen
// Route: /commercial/contracts
// ─────────────────────────────────────────────────────────────────────────────
//
// Commercial account service contract dashboard.
// Shows service level, pickup frequency, emergency/overflow permissions,
// contamination policy, contract dates, and renewal status.
//
// NOTE: No commercial_contracts DB table exists yet. This screen reads
// service_plan / plan_name from commercial_accounts as a proxy and shows
// placeholder data for contract-specific fields. When a contracts table is
// created, update getCommercialContract() to query it.
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
import { getCommercialContract }             from '../../lib/commercialCompliance'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_COLOR,
  SERVICE_LEVEL_LABEL,
  PICKUP_FREQUENCY_LABEL,
  daysUntilExpiry,
  isContractExpiringSoon,
  emptyContract,
  type CommercialContract,
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

// ── Main component ────────────────────────────────────────────────────────────

export default function CommercialContracts() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()

  const [pageState,  setPageState]  = useState<PageState>('loading')
  const [contract,   setContract]   = useState<CommercialContract | null>(null)

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
    const result = await getCommercialContract(account.id)
    if (!result.ok) { setPageState('error'); return }

    // Use placeholder contract if none is configured yet
    setContract(result.data ?? emptyContract(account.id))
    setPageState('ready')
  }, [user])

  useEffect(() => { void load() }, [load])

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

  const daysLeft    = daysUntilExpiry(contract.endDate)
  const expiringSoon = isContractExpiringSoon(contract.endDate)
  const isNoContract = !contract.contractId

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
        {isNoContract && (
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
              Placeholder data is shown below.
            </p>
          </div>
        )}

        {/* ── Contract status header card ── */}
        <div style={{ marginBottom: 16 }}><GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
                {contract.contractTitle}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                {SERVICE_LEVEL_LABEL[contract.serviceLevel]} Plan
              </p>
            </div>
            <span style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: `${CONTRACT_STATUS_COLOR[contract.status]}22`,
              color: CONTRACT_STATUS_COLOR[contract.status],
              border: `1px solid ${CONTRACT_STATUS_COLOR[contract.status]}44`,
            }}>
              {CONTRACT_STATUS_LABEL[contract.status]}
            </span>
          </div>

          {/* Renewal alert */}
          {expiringSoon && daysLeft !== null && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(251,191,36,0.1)', borderRadius: 10, border: '1px solid rgba(251,191,36,0.25)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                ⚠️ Contract renews in {daysLeft} day{daysLeft === 1 ? '' : 's'}
              </p>
            </div>
          )}
        </GlassCard></div>

        {/* ── Service details ── */}
        <div style={{ ...GLASS, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
            Service Details
          </p>
          <InfoRow label="Service Level"     value={SERVICE_LEVEL_LABEL[contract.serviceLevel]} />
          <InfoRow label="Pickup Frequency"  value={PICKUP_FREQUENCY_LABEL[contract.pickupFrequency]} />
          <InfoRow label="Bin Count"         value={contract.binCount} />
        </div>

        {/* ── Permissions ── */}
        <div style={{ ...GLASS, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
            Permissions & Policies
          </p>
          <InfoRow
            label="Emergency Pickup"
            value={<BooleanPill value={contract.emergencyPickupAllowed} trueLabel="Authorized" falseLabel="Not Authorized" />}
          />
          <InfoRow
            label="Overflow Pickup"
            value={<BooleanPill value={contract.overflowPickupAllowed} trueLabel="Authorized" falseLabel="Not Authorized" />}
          />
          <InfoRow
            label="Contamination Policy"
            value={<BooleanPill value={contract.contaminationPolicyAccepted} trueLabel="Accepted" falseLabel="Pending" />}
          />
        </div>

        {/* ── Contract dates ── */}
        <div style={{ ...GLASS, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
            Contract Dates
          </p>
          <InfoRow label="Start Date"   value={formatDate(contract.startDate)} />
          <InfoRow
            label="End Date"
            value={
              contract.endDate
                ? <span style={{ color: expiringSoon ? '#fbbf24' : '#fff' }}>{formatDate(contract.endDate)}</span>
                : '—'
            }
          />
          <InfoRow
            label="Renewal Date"
            value={formatDate(contract.renewalDate ?? contract.endDate)}
          />
        </div>

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
