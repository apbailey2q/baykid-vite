// ─────────────────────────────────────────────────────────────────────────────
// CO.2 — Admin Commercial Compliance View
// Route: /admin/commercial-compliance
// ─────────────────────────────────────────────────────────────────────────────
//
// Admin interface for reviewing commercial account compliance, documents,
// service holds, reactivation requests, and contract status.
//
// Tabs:
//   All Accounts | Missing Documents | Pending Review | Expiring Soon |
//   Expired | Service Hold | Needs Reactivation | Contracts
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }                       from 'react-router-dom'
// useQuery not needed — compliance summaries are loaded imperatively per account
import { supabase }                          from '../../lib/supabase'
import { useAuthStore }                      from '../../store/authStore'
import { AppShell }                          from '../../components/ui/AppShell'
import { PageHeader }                        from '../../components/ui/PageHeader'
import { PrimaryButton }                     from '../../components/ui/PrimaryButton'
import { StatusBadge }                       from '../../components/ui/StatusBadge'
import { Spinner }                           from '../../components/ui/Spinner'
import { EmptyState }                        from '../../components/ui/EmptyState'
import {
  getCommercialComplianceSummary,
  startCommercialServiceHold,
  cancelCommercialServiceHold,
  approveCommercialReactivation,
  type CommercialComplianceSummary,
  type CommercialComplianceDoc,
} from '../../lib/commercialCompliance'
import {
  COMMERCIAL_DOCUMENT_DEFINITIONS,
  COMMERCIAL_CATEGORY_LABELS,
  COMMERCIAL_CATEGORY_COLOR,
} from '../../data/commercialComplianceData'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_COLOR,
} from '../../data/commercialContractData'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey =
  | 'all'
  | 'missing'
  | 'pending'
  | 'expiring'
  | 'expired'
  | 'hold'
  | 'reactivation'
  | 'contracts'

interface AccountRow {
  id:             string
  business_name:  string
  contact_name:   string | null
  contact_email:  string | null
  contact_phone:  string | null
  account_status: 'active' | 'suspended' | 'pending'
  service_plan:   string | null
  plan_name:      string | null
  user_id:        string | null
  created_at:     string
  summary?:       CommercialComplianceSummary
  summaryLoading: boolean
}

interface DocRow extends CommercialComplianceDoc {
  account_business_name: string
  account_id:            string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',          label: 'All Accounts'      },
  { key: 'missing',      label: 'Missing Documents' },
  { key: 'pending',      label: 'Pending Review'    },
  { key: 'expiring',     label: 'Expiring Soon'     },
  { key: 'expired',      label: 'Expired'           },
  { key: 'hold',         label: 'Service Hold'      },
  { key: 'reactivation', label: 'Needs Reactivation'},
  { key: 'contracts',    label: 'Contracts'         },
]

const GLASS: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  padding:      16,
}

const ACCOUNT_STATUS_BADGE: Record<string, { variant: 'green' | 'red' | 'yellow'; label: string }> = {
  active:    { variant: 'green',  label: 'Active'    },
  suspended: { variant: 'red',    label: 'Suspended' },
  pending:   { variant: 'yellow', label: 'Pending'   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ── Account Compliance Card ───────────────────────────────────────────────────

function AccountComplianceCard({
  acct,
  onAction,
}: {
  acct:     AccountRow
  onAction: (action: string, accountId: string) => void
}) {
  const s = acct.summary
  const badge = ACCOUNT_STATUS_BADGE[acct.account_status] ?? { variant: 'yellow' as const, label: acct.account_status }

  return (
    <div style={{ ...GLASS, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>{acct.business_name}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
            {acct.contact_name ?? '—'} · {acct.contact_email ?? '—'}
          </p>
        </div>
        <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
      </div>

      {/* Compliance stats */}
      {acct.summaryLoading ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Spinner />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Loading compliance…</span>
        </div>
      ) : s ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            { label: 'Approved', value: s.approved,    color: '#4ade80' },
            { label: 'Missing',  value: s.missing,     color: s.missing > 0  ? '#f87171' : 'rgba(255,255,255,0.3)' },
            { label: 'Expiring', value: s.expiringSoon,color: s.expiringSoon > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' },
            { label: 'Rejected', value: s.rejected,    color: s.rejected > 0 ? '#f97316' : 'rgba(255,255,255,0.3)' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', minWidth: 52 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: stat.color, margin: 0 }}>{stat.value}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{stat.label}</p>
            </div>
          ))}
          <div style={{ textAlign: 'center', minWidth: 52 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#00c8ff', margin: 0 }}>{s.completionPct}%</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Done</p>
          </div>
          {s.onServiceHold && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
                {s.reactivationPending ? '🔄 Reactivation Requested' : '🔒 On Hold'}
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Admin actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => onAction('view_docs', acct.id)}
          style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(0,200,255,0.12)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.2)', cursor: 'pointer' }}
        >
          📄 Documents
        </button>
        {s?.onServiceHold ? (
          <>
            {s.reactivationPending && (
              <button
                onClick={() => onAction('approve_reactivation', acct.id)}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', cursor: 'pointer' }}
              >
                ✓ Approve Reactivation
              </button>
            )}
            <button
              onClick={() => onAction('cancel_hold', acct.id)}
              style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.15)', cursor: 'pointer' }}
            >
              🔓 Cancel Hold
            </button>
          </>
        ) : (
          <button
            onClick={() => onAction('start_hold', acct.id)}
            style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(249,115,22,0.10)', color: '#f97316', border: '1px solid rgba(249,115,22,0.18)', cursor: 'pointer' }}
          >
            🔒 Start Hold
          </button>
        )}
        <button
          onClick={() => onAction('view_contracts', acct.id)}
          style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)', cursor: 'pointer' }}
        >
          📋 Contract
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminCommercialCompliance() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()

  const [tab,       setTab]       = useState<TabKey>('all')
  const [accounts,  setAccounts]  = useState<AccountRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState<string | null>(null)
  const [holdModal, setHoldModal] = useState<{ accountId: string; businessName: string } | null>(null)
  const [holdReason, setHoldReason] = useState('')
  const [working,   setWorking]   = useState<string | null>(null)

  // All compliance docs across accounts (for document-centric tabs)
  const [allDocs,   setAllDocs]   = useState<DocRow[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Load accounts ────────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('commercial_accounts')
      .select('id, business_name, contact_name, contact_email, contact_phone, account_status, service_plan, plan_name, user_id, created_at')
      .order('business_name', { ascending: true })

    if (error || !data) { setLoading(false); return }

    const rows: AccountRow[] = (data as AccountRow[]).map(a => ({
      ...a,
      summary:        undefined,
      summaryLoading: true,
    }))
    setAccounts(rows)
    setLoading(false)

    // Load summaries in background (async per account)
    for (const acct of rows) {
      void getCommercialComplianceSummary(acct.id).then(result => {
        setAccounts(prev => prev.map(a =>
          a.id === acct.id ? { ...a, summary: result.data, summaryLoading: false } : a,
        ))
      })
    }
  }, [])

  // ── Load all documents ───────────────────────────────────────────────────────

  const loadAllDocs = useCallback(async () => {
    if (tab !== 'missing' && tab !== 'pending' && tab !== 'expiring' && tab !== 'expired') return
    setDocsLoading(true)

    const statusFilter: Record<string, string[]> = {
      missing:  ['missing'],
      pending:  ['pending_review'],
      expiring: ['approved', 'expiring_soon'],
      expired:  ['expired'],
    }

    const statuses = statusFilter[tab]
    if (!statuses) { setDocsLoading(false); return }

    const { data: docs, error } = await supabase
      .from('compliance_documents')
      .select('*')
      .eq('owner_type', 'commercial')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error || !docs) { setDocsLoading(false); return }

    // Enrich with account business_name
    const userIds = [...new Set((docs as DocRow[]).map(d => d.owner_user_id).filter(Boolean) as string[])]
    let userToAccount: Map<string, { id: string; business_name: string }> = new Map()

    if (userIds.length > 0) {
      const { data: accts } = await supabase
        .from('commercial_accounts')
        .select('id, business_name, user_id')
        .in('user_id', userIds)
      ;(accts ?? []).forEach((a: { id: string; business_name: string; user_id: string }) => {
        userToAccount.set(a.user_id, { id: a.id, business_name: a.business_name })
      })
    }

    const enriched = (docs as CommercialComplianceDoc[]).map(d => ({
      ...d,
      account_business_name: userToAccount.get(d.owner_user_id ?? '')?.business_name ?? 'Unknown',
      account_id:            userToAccount.get(d.owner_user_id ?? '')?.id ?? '',
    }))

    setAllDocs(enriched)
    setDocsLoading(false)
  }, [tab])

  useEffect(() => { void loadAccounts() }, [loadAccounts])
  useEffect(() => { void loadAllDocs() }, [loadAllDocs])

  // ── Admin actions ─────────────────────────────────────────────────────────────

  const handleAction = useCallback(async (action: string, accountId: string) => {
    const acct = accounts.find(a => a.id === accountId)
    if (!acct) return

    if (action === 'view_docs') {
      // Admin views a commercial account's documents via the admin compliance tab — show inline
      showToast(`Viewing documents for ${acct.business_name}`)
      return
    }

    if (action === 'view_contracts') {
      showToast(`Contract management for ${acct.business_name} — full contracts table coming in CO.3`)
      return
    }

    if (action === 'start_hold') {
      setHoldModal({ accountId, businessName: acct.business_name })
      setHoldReason('')
      return
    }

    if (action === 'cancel_hold') {
      setWorking(accountId)
      const result = await cancelCommercialServiceHold(accountId, user?.id ?? '')
      setWorking(null)
      if (result.ok) {
        showToast(`Service hold cancelled for ${acct.business_name}`)
        void loadAccounts()
      } else {
        showToast(result.error ?? 'Failed to cancel hold')
      }
      return
    }

    if (action === 'approve_reactivation') {
      setWorking(accountId)
      const result = await approveCommercialReactivation(accountId, user?.id ?? '')
      setWorking(null)
      if (result.ok) {
        showToast(`${acct.business_name} reactivated`)
        void loadAccounts()
      } else {
        showToast(result.error ?? 'Failed to approve reactivation')
      }
      return
    }
  }, [accounts, user, loadAccounts, showToast])

  const handleStartHold = useCallback(async () => {
    if (!holdModal || !holdReason.trim()) return
    setWorking(holdModal.accountId)
    const result = await startCommercialServiceHold(
      holdModal.accountId,
      holdReason.trim(),
      user?.id ?? '',
    )
    setWorking(null)
    setHoldModal(null)
    setHoldReason('')
    if (result.ok) {
      showToast(`Service hold started for ${holdModal.businessName}`)
      void loadAccounts()
    } else {
      showToast(result.error ?? 'Failed to start hold')
    }
  }, [holdModal, holdReason, user, loadAccounts, showToast])

  // ── Filtered account lists ───────────────────────────────────────────────────

  const holdAccounts         = accounts.filter(a => a.summary?.onServiceHold && !a.summary?.reactivationPending)
  const reactivationAccounts = accounts.filter(a => a.summary?.reactivationPending)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader />
      <div style={{ padding: '0 16px 96px', maxWidth: 720, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => navigate('/dashboard/admin')}
            style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← Admin Dashboard
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
            🏢 Commercial Compliance
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            Review commercial account documents, contracts, service holds, and reactivation requests.
          </p>
        </div>

        {/* ── Summary chips ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: 'Total Accounts',  value: accounts.length,                                                color: '#00c8ff' },
            { label: 'Service Hold',    value: holdAccounts.length + reactivationAccounts.length,              color: holdAccounts.length + reactivationAccounts.length > 0 ? '#f97316' : 'rgba(255,255,255,0.3)' },
            { label: 'Reactivation',    value: reactivationAccounts.length,                                    color: reactivationAccounts.length > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' },
            { label: 'Missing Docs',    value: accounts.reduce((n, a) => n + (a.summary?.missing ?? 0), 0),    color: accounts.some(a => (a.summary?.missing ?? 0) > 0) ? '#f87171' : 'rgba(255,255,255,0.3)' },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20, scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flexShrink:       0,
                padding:          '8px 14px',
                fontSize:         12,
                fontWeight:       700,
                cursor:           'pointer',
                background:       'none',
                border:           'none',
                borderBottom:     `2px solid ${tab === t.key ? '#00c8ff' : 'transparent'}`,
                color:            tab === t.key ? '#00c8ff' : 'rgba(255,255,255,0.45)',
                whiteSpace:       'nowrap',
                transition:       'color 0.15s',
              }}
            >
              {t.label}
              {t.key === 'hold'         && holdAccounts.length > 0         && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 800, background: '#f97316', color: '#fff', borderRadius: 999, padding: '0 5px' }}>{holdAccounts.length}</span>}
              {t.key === 'reactivation' && reactivationAccounts.length > 0 && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 800, background: '#fbbf24', color: '#000', borderRadius: 999, padding: '0 5px' }}>{reactivationAccounts.length}</span>}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}

        {loading && tab === 'all' && (
          <div className="flex justify-center" style={{ padding: 40 }}><Spinner /></div>
        )}

        {/* ALL ACCOUNTS tab */}
        {tab === 'all' && !loading && (
          accounts.length === 0
            ? <EmptyState icon="🏢" title="No Commercial Accounts" description="No commercial accounts found." />
            : accounts.map(acct => (
                <AccountComplianceCard key={acct.id} acct={acct} onAction={handleAction} />
              ))
        )}

        {/* DOCUMENT TABS (missing / pending / expiring / expired) */}
        {(['missing', 'pending', 'expiring', 'expired'] as TabKey[]).includes(tab) && (
          docsLoading
            ? <div className="flex justify-center" style={{ padding: 40 }}><Spinner /></div>
            : allDocs.length === 0
              ? <EmptyState icon="✅" title="Nothing Here" description={`No ${tab} documents found across commercial accounts.`} />
              : allDocs.map(doc => {
                  const def    = COMMERCIAL_DOCUMENT_DEFINITIONS.find(d => d.id === doc.document_type)
                  const catColor = def ? COMMERCIAL_CATEGORY_COLOR[def.category] : 'rgba(255,255,255,0.3)'
                  const days   = daysUntilExpiry(doc.expiration_date)
                  return (
                    <div key={doc.id} style={{ ...GLASS, borderLeft: `3px solid ${catColor}`, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>{doc.document_title}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>
                            {doc.account_business_name}
                            {def && ` · ${COMMERCIAL_CATEGORY_LABELS[def.category]}`}
                          </p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                          {doc.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {days !== null && (
                        <p style={{ fontSize: 11, color: days <= 7 ? '#f87171' : days <= 30 ? '#fbbf24' : 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                          {days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d (${formatDate(doc.expiration_date)})`}
                        </p>
                      )}
                      {doc.review_notes && (
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                          Note: {doc.review_notes}
                        </p>
                      )}
                    </div>
                  )
                })
        )}

        {/* SERVICE HOLD tab */}
        {tab === 'hold' && (
          holdAccounts.length === 0
            ? <EmptyState icon="🔓" title="No Active Service Holds" description="No commercial accounts are currently on service hold." />
            : holdAccounts.map(acct => (
                <AccountComplianceCard key={acct.id} acct={acct} onAction={handleAction} />
              ))
        )}

        {/* REACTIVATION tab */}
        {tab === 'reactivation' && (
          reactivationAccounts.length === 0
            ? <EmptyState icon="✅" title="No Reactivation Requests" description="No pending reactivation requests." />
            : reactivationAccounts.map(acct => (
                <AccountComplianceCard key={acct.id} acct={acct} onAction={handleAction} />
              ))
        )}

        {/* CONTRACTS tab */}
        {tab === 'contracts' && (
          <div>
            <div style={{ padding: '12px 16px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', margin: '0 0 4px' }}>
                📋 Contract Management — CO.3 Scope
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                Full contract tracking with a <code>commercial_contracts</code> table, digital signing, version history, and renewal alerts is scoped for CO.3.
                Below is the current service plan status from <code>commercial_accounts</code>.
              </p>
            </div>
            {accounts.length === 0
              ? <EmptyState icon="📋" title="No Accounts" description="No commercial accounts found." />
              : accounts.map(acct => {
                  const contractStatus = acct.account_status === 'active' ? 'active' : 'needs_review'
                  return (
                    <div key={acct.id} style={{ ...GLASS, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>{acct.business_name}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                            Plan: {acct.plan_name ?? acct.service_plan ?? '—'} · Since {formatDate(acct.created_at)}
                          </p>
                        </div>
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: `${CONTRACT_STATUS_COLOR[contractStatus]}22`,
                          color: CONTRACT_STATUS_COLOR[contractStatus],
                          border: `1px solid ${CONTRACT_STATUS_COLOR[contractStatus]}33`,
                        }}>
                          {CONTRACT_STATUS_LABEL[contractStatus]}
                        </span>
                      </div>
                    </div>
                  )
                })
            }
          </div>
        )}

      </div>

      {/* ── Service Hold Modal ── */}
      {holdModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9998, padding: 16,
        }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, border: '1px solid rgba(255,255,255,0.12)' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
              🔒 Start Service Hold
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
              {holdModal.businessName}
            </p>
            <textarea
              value={holdReason}
              onChange={e => setHoldReason(e.target.value)}
              placeholder="Reason for service hold (e.g., missing certificate of insurance)"
              rows={3}
              style={{
                width: '100%', padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13,
                resize: 'none', boxSizing: 'border-box', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <PrimaryButton
                variant="secondary"
                fullWidth
                onClick={() => { setHoldModal(null); setHoldReason('') }}
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton
                fullWidth
                disabled={!holdReason.trim() || working === holdModal.accountId}
                onClick={handleStartHold}
              >
                {working === holdModal.accountId ? 'Starting…' : 'Start Hold'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30,30,40,0.95)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 600,
          color: '#fff', zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </AppShell>
  )
}
