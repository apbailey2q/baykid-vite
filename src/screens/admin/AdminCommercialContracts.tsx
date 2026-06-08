// ─────────────────────────────────────────────────────────────────────────────
// CO.3 — Admin Commercial Contracts Editor
// Route: /admin/commercial-contracts
// ─────────────────────────────────────────────────────────────────────────────
//
// Admin interface for creating, editing, renewing, and cancelling commercial
// service contracts.
//
// Tabs:
//   All | Draft | Pending Signature | Active | Expiring Soon |
//   Expired | Cancelled | Needs Review
//
// IMPORTANT: This editor records service terms only. It does NOT process
// payments. contract_value_* fields are for bookkeeping after the fact only.
// No Stripe, ACH, bank account, or routing number logic (CLAUDE.md PROHIBITED).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }                       from 'react-router-dom'
import { supabase }                          from '../../lib/supabase'
import { useAuthStore }                      from '../../store/authStore'
import { AppShell }                          from '../../components/ui/AppShell'
import { PageHeader }                        from '../../components/ui/PageHeader'
import { PrimaryButton }                     from '../../components/ui/PrimaryButton'
import { StatusBadge }                       from '../../components/ui/StatusBadge'
import { Spinner }                           from '../../components/ui/Spinner'
import { EmptyState }                        from '../../components/ui/EmptyState'
import {
  getCommercialContracts,
  getContractsExpiringSoon,
  createCommercialContract,
  updateCommercialContract,
  changeCommercialContractStatus,
  renewCommercialContract,
  cancelCommercialContract,
  getCommercialContractHistory,
  createCommercialContractRenewalAlert,
  markExpiredCommercialContracts,
  getContractsNeedingRenewalReview,
  type CreateContractInput,
} from '../../lib/commercialContracts'
import {
  requestCommercialContractSignature,
  getCommercialContractSignatures,
  type SignContractInput as _SignContractInput,
} from '../../lib/commercialContractSignatures'
import {
  copyCommercialContractSummary,
  downloadCommercialContractSummary,
  buildContractQAChecklist,
  downloadRenewalAuditReport,
  type QAChecklist,
} from '../../lib/commercialContractExports'
import { CommercialContractQAChecklist } from '../../components/commercial/CommercialContractQAChecklist'
import { ContractSignatureCertificate }  from '../../components/commercial/ContractSignatureCertificate'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_COLOR,
  SIGNATURE_STATUS_LABEL,
  SIGNATURE_STATUS_COLOR,
  SERVICE_LEVEL_LABEL,
  PICKUP_FREQUENCY_LABEL,
  ACTION_TYPE_LABEL,
  daysUntilExpiry,
  isContractExpiringSoon,
  isContractExpired,
  type CommercialContract,
  type CommercialContractHistory,
  type CommercialContractSignature,
  type CommercialContractStatus,
  type CommercialContractServiceLevel,
  type CommercialContractPickupFrequency,
} from '../../data/commercialContractData'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey =
  | 'all'
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'cancelled'
  | 'needs_review'

interface AccountOption {
  id:            string
  business_name: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',               label: 'All'               },
  { key: 'draft',             label: 'Draft'             },
  { key: 'pending_signature', label: 'Pending Signature' },
  { key: 'active',            label: 'Active'            },
  { key: 'expiring',          label: 'Expiring Soon'     },
  { key: 'expired',           label: 'Expired'           },
  { key: 'cancelled',         label: 'Cancelled'         },
  { key: 'needs_review',      label: 'Needs Review'      },
]

const SERVICE_LEVELS: CommercialContractServiceLevel[] = [
  'standard', 'priority', 'enterprise', 'municipal', 'custom',
]

const PICKUP_FREQUENCIES: CommercialContractPickupFrequency[] = [
  'daily', 'weekly', 'biweekly', 'monthly', 'on_demand', 'custom',
]

const ALL_STATUSES: CommercialContractStatus[] = [
  'draft', 'pending_signature', 'active', 'expired', 'cancelled', 'needs_review',
]

const GLASS: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  padding:      16,
}

const INPUT: React.CSSProperties = {
  width:        '100%',
  padding:      '9px 12px',
  borderRadius: 10,
  background:   'rgba(255,255,255,0.06)',
  border:       '1px solid rgba(255,255,255,0.12)',
  color:        '#fff',
  fontSize:     13,
  outline:      'none',
  boxSizing:    'border-box',
}

const SELECT: React.CSSProperties = { ...INPUT }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
}

function statusVariant(s: CommercialContractStatus): 'green' | 'red' | 'yellow' | 'blue' {
  if (s === 'active')                          return 'green'
  if (s === 'expired' || s === 'cancelled')    return 'red'
  if (s === 'needs_review' || s === 'pending_signature') return 'yellow'
  return 'blue'
}

// ── Empty form state ──────────────────────────────────────────────────────────

function defaultForm(accountId = ''): CreateContractInput {
  return {
    account_id:                    accountId,
    contract_title:                'Commercial Service Agreement',
    service_level:                 'standard',
    pickup_frequency:              'weekly',
    bin_count:                     1,
    bin_types:                     [],
    emergency_pickup_allowed:      false,
    overflow_pickup_allowed:       false,
    contamination_policy_accepted: false,
    start_date:                    null,
    end_date:                      null,
    renewal_date:                  null,
    status:                        'draft',
    contract_value_monthly:        null,
    contract_value_annual:         null,
    notes:                         null,
    created_by:                    null,
    updated_by:                    null,
  }
}

// ── Contract row card ─────────────────────────────────────────────────────────

function ContractCard({
  contract,
  businessName,
  onEdit,
  onRenew,
  onCancel,
  onStatusChange,
  onViewHistory,
  onSendForSignature,
  onPrint,
  onCopySummary,
  onDownloadSummary,
  onQAChecklist,
  onSigCertificate,
}: {
  contract:           CommercialContract
  businessName?:      string
  onEdit:             (c: CommercialContract) => void
  onRenew:            (c: CommercialContract) => void
  onCancel:           (c: CommercialContract) => void
  onStatusChange:     (c: CommercialContract) => void
  onViewHistory:      (c: CommercialContract) => void
  onSendForSignature: (c: CommercialContract) => void
  onPrint:            (c: CommercialContract) => void
  onCopySummary:      (c: CommercialContract) => void
  onDownloadSummary:  (c: CommercialContract) => void
  onQAChecklist:      (c: CommercialContract) => void
  onSigCertificate:   (c: CommercialContract) => void
}) {
  const days         = daysUntilExpiry(contract.end_date)
  const expiringSoon = isContractExpiringSoon(contract.end_date)
  const expired      = isContractExpired(contract.end_date)

  return (
    <div style={{
      ...GLASS,
      marginBottom: 10,
      borderLeft: `3px solid ${CONTRACT_STATUS_COLOR[contract.status]}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>
            {contract.contract_title}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
            {businessName && <>{businessName} · </>}
            {SERVICE_LEVEL_LABEL[contract.service_level]} · {PICKUP_FREQUENCY_LABEL[contract.pickup_frequency]}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <StatusBadge variant={statusVariant(contract.status)} label={CONTRACT_STATUS_LABEL[contract.status]} size="sm" />
          {/* CO.4 — signature status badge */}
          {contract.signature_status !== 'not_requested' && (
            <span style={{
              padding:       '2px 8px',
              borderRadius:  999,
              fontSize:      9,
              fontWeight:    800,
              background:    SIGNATURE_STATUS_COLOR[contract.signature_status] + '22',
              border:        `1px solid ${SIGNATURE_STATUS_COLOR[contract.signature_status]}55`,
              color:         SIGNATURE_STATUS_COLOR[contract.signature_status],
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {SIGNATURE_STATUS_LABEL[contract.signature_status]}
            </span>
          )}
        </div>
      </div>

      {/* Key facts row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        {[
          { label: 'Bins',     value: contract.bin_count.toString() },
          { label: 'Start',    value: formatDate(contract.start_date) },
          { label: 'End',      value: contract.end_date
              ? <span style={{ color: expired ? '#f87171' : expiringSoon ? '#fbbf24' : 'rgba(255,255,255,0.7)' }}>
                  {formatDate(contract.end_date)}
                  {days !== null && !expired && ` (${days}d)`}
                </span>
              : <span style={{ color: 'rgba(255,255,255,0.3)' }}>No end date</span>
          },
          ...(contract.contract_value_monthly !== null
            ? [{ label: '$/mo', value: formatCurrency(contract.contract_value_monthly) }]
            : []),
        ].map(f => (
          <div key={f.label}>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>{f.label}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)', margin: 0 }}>{f.value}</p>
          </div>
        ))}
      </div>

      {/* Expiry alert */}
      {expiringSoon && days !== null && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', margin: 0 }}>
            ⚠️ Expires in {days} day{days === 1 ? '' : 's'} — renewal review needed
          </p>
        </div>
      )}
      {expired && contract.status === 'active' && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#f87171', margin: 0 }}>
            ⛔ End date has passed — update or renew this contract
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => onEdit(contract)}          style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(0,200,255,0.1)',  border: '1px solid rgba(0,200,255,0.25)',  color: '#00c8ff',  cursor: 'pointer' }}>✏️ Edit</button>
        <button onClick={() => onStatusChange(contract)}  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', cursor: 'pointer' }}>🔀 Status</button>
        {/* CO.4 — Send for Signature: shown unless already signed or cancelled */}
        {contract.status !== 'cancelled' && contract.signature_status !== 'signed' && (
          <button onClick={() => onSendForSignature(contract)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', cursor: 'pointer' }}>✉️ Send for Sig</button>
        )}
        {contract.status !== 'cancelled' && (
          <button onClick={() => onRenew(contract)}       style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(74,222,128,0.1)',  border: '1px solid rgba(74,222,128,0.25)',  color: '#4ade80',  cursor: 'pointer' }}>🔄 Renew</button>
        )}
        {contract.status !== 'cancelled' && (
          <button onClick={() => onCancel(contract)}      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(248,113,113,0.1)',border: '1px solid rgba(248,113,113,0.25)',color: '#f87171', cursor: 'pointer' }}>❌ Cancel</button>
        )}
        <button onClick={() => onViewHistory(contract)}   style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>📅 History</button>
      </div>

      {/* CO.5 — export / QA action row */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => onPrint(contract)}           style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>🖨️ Print</button>
        <button onClick={() => onCopySummary(contract)}     style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>📋 Copy</button>
        <button onClick={() => onDownloadSummary(contract)} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>⬇️ Download</button>
        <button onClick={() => onQAChecklist(contract)}     style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', cursor: 'pointer' }}>🔍 QA Checklist</button>
        {contract.signature_status === 'signed' && (
          <button onClick={() => onSigCertificate(contract)} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', cursor: 'pointer' }}>📜 Sig Certificate</button>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminCommercialContracts() {
  const navigate        = useNavigate()
  const { user }        = useAuthStore()

  const [tab,           setTab]           = useState<TabKey>('all')
  const [contracts,     setContracts]     = useState<CommercialContract[]>([])
  const [expiring,      setExpiring]      = useState<CommercialContract[]>([])
  const [accounts,      setAccounts]      = useState<AccountOption[]>([])
  const [loading,       setLoading]       = useState(true)
  const [working,       setWorking]       = useState(false)
  const [toast,         setToast]         = useState<string | null>(null)

  // Modal state
  const [editModal,     setEditModal]     = useState<CommercialContract | null>(null)
  const [isCreating,    setIsCreating]    = useState(false)
  const [formData,      setFormData]      = useState<CreateContractInput>(defaultForm())
  const [renewModal,    setRenewModal]    = useState<CommercialContract | null>(null)
  const [renewEndDate,  setRenewEndDate]  = useState('')
  const [renewalDate,   setRenewalDate]   = useState('')
  const [cancelModal,   setCancelModal]   = useState<CommercialContract | null>(null)
  const [cancelReason,  setCancelReason]  = useState('')
  const [statusModal,   setStatusModal]   = useState<CommercialContract | null>(null)
  const [newStatus,     setNewStatus]     = useState<CommercialContractStatus>('active')
  const [statusReason,  setStatusReason]  = useState('')
  const [historyModal,   setHistoryModal]   = useState<CommercialContract | null>(null)
  const [historyRows,    setHistoryRows]    = useState<CommercialContractHistory[]>([])
  const [histLoading,    setHistLoading]    = useState(false)
  // CO.4 signature
  const [sigModal,       setSigModal]       = useState<CommercialContract | null>(null)
  const [sigHistory,     setSigHistory]     = useState<CommercialContractSignature[]>([])
  const [sigHistLoading, setSigHistLoading] = useState(false)
  // CO.4 renewal check
  const [renewalNeeded,  setRenewalNeeded]  = useState<CommercialContract[]>([])
  const [renewCheckBusy, setRenewCheckBusy] = useState(false)
  // CO.5 export / QA modals
  const [qaModal,        setQaModal]        = useState<{ contract: CommercialContract; checklist: QAChecklist } | null>(null)
  const [certModal,      setCertModal]      = useState<{ contract: CommercialContract; signature: CommercialContractSignature } | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // Load all commercial accounts
      const { data: acctData } = await supabase
        .from('commercial_accounts')
        .select('id, business_name')
        .order('business_name', { ascending: true })

      const accts = (acctData ?? []) as AccountOption[]
      setAccounts(accts)

      // Load all contracts across all accounts
      const allContracts: CommercialContract[] = []
      await Promise.all(
        accts.map(async a => {
          const r = await getCommercialContracts(a.id)
          if (r.ok && r.data) allContracts.push(...r.data)
        }),
      )

      // Sort by created_at descending
      allContracts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setContracts(allContracts)

      const expR = await getContractsExpiringSoon(30)
      setExpiring(expR.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filtered: CommercialContract[] = (() => {
    switch (tab) {
      case 'all':               return contracts
      case 'expiring':          return expiring
      case 'draft':
      case 'pending_signature':
      case 'active':
      case 'expired':
      case 'cancelled':
      case 'needs_review':      return contracts.filter(c => c.status === tab)
      default:                  return contracts
    }
  })()

  // Map accountId → business_name for display
  const acctMap = Object.fromEntries(accounts.map(a => [a.id, a.business_name]))

  // ── Create / edit submit ────────────────────────────────────────────────────

  const handleSubmitForm = useCallback(async () => {
    if (!formData.account_id) { showToast('Select an account first'); return }
    setWorking(true)
    try {
      let result
      if (isCreating) {
        result = await createCommercialContract({ ...formData, updated_by: user?.id ?? null }, user?.id)
      } else if (editModal) {
        result = await updateCommercialContract(editModal.id, { ...formData, updated_by: user?.id ?? null }, user?.id)
      }
      if (result?.ok) {
        showToast(isCreating ? 'Contract created' : 'Contract updated')
        setEditModal(null)
        setIsCreating(false)
        void loadAll()
      } else {
        showToast(result?.error ?? 'Failed')
      }
    } finally {
      setWorking(false)
    }
  }, [formData, isCreating, editModal, user, showToast, loadAll])

  // ── Renew submit ─────────────────────────────────────────────────────────────

  const handleRenew = useCallback(async () => {
    if (!renewModal || !renewEndDate) return
    setWorking(true)
    try {
      const result = await renewCommercialContract(renewModal.id, renewalDate || renewEndDate, renewEndDate, user?.id)
      if (result.ok) {
        // Trigger renewal alert for admin records
        if (result.data) void createCommercialContractRenewalAlert(result.data)
        showToast('Contract renewed')
        setRenewModal(null)
        setRenewEndDate('')
        setRenewalDate('')
        void loadAll()
      } else {
        showToast(result.error ?? 'Failed to renew')
      }
    } finally {
      setWorking(false)
    }
  }, [renewModal, renewEndDate, renewalDate, user, showToast, loadAll])

  // ── Cancel submit ────────────────────────────────────────────────────────────

  const handleCancel = useCallback(async () => {
    if (!cancelModal || !cancelReason.trim()) return
    setWorking(true)
    try {
      const result = await cancelCommercialContract(cancelModal.id, cancelReason, user?.id)
      if (result.ok) {
        showToast('Contract cancelled')
        setCancelModal(null)
        setCancelReason('')
        void loadAll()
      } else {
        showToast(result.error ?? 'Failed to cancel')
      }
    } finally {
      setWorking(false)
    }
  }, [cancelModal, cancelReason, user, showToast, loadAll])

  // ── Status change submit ──────────────────────────────────────────────────────

  const handleStatusChange = useCallback(async () => {
    if (!statusModal || !statusReason.trim()) return
    setWorking(true)
    try {
      const result = await changeCommercialContractStatus(statusModal.id, newStatus, statusReason, user?.id)
      if (result.ok) {
        showToast(`Status changed to ${CONTRACT_STATUS_LABEL[newStatus]}`)
        setStatusModal(null)
        setStatusReason('')
        void loadAll()
      } else {
        showToast(result.error ?? 'Failed')
      }
    } finally {
      setWorking(false)
    }
  }, [statusModal, newStatus, statusReason, user, showToast, loadAll])

  // ── View history ──────────────────────────────────────────────────────────────

  const handleViewHistory = useCallback(async (c: CommercialContract) => {
    setHistoryModal(c)
    setHistLoading(true)
    setSigHistory([])
    const [histResult, sigResult] = await Promise.all([
      getCommercialContractHistory(c.id),
      getCommercialContractSignatures(c.id),
    ])
    setHistoryRows(histResult.data ?? [])
    setSigHistory(sigResult.data ?? [])
    setHistLoading(false)
  }, [])

  // ── CO.4 Send for Signature ───────────────────────────────────────────────────

  const handleSendForSignature = useCallback(async (c: CommercialContract) => {
    setSigModal(c)
    setSigHistLoading(true)
    const result = await getCommercialContractSignatures(c.id)
    setSigHistory(result.data ?? [])
    setSigHistLoading(false)
  }, [])

  const handleConfirmSendForSignature = useCallback(async () => {
    if (!sigModal) return
    setWorking(true)
    try {
      const result = await requestCommercialContractSignature(sigModal.id, user?.id)
      if (result.ok) {
        showToast('Signature request sent')
        setSigModal(null)
        void loadAll()
      } else {
        showToast(result.error ?? 'Failed to send signature request')
      }
    } finally {
      setWorking(false)
    }
  }, [sigModal, user, showToast, loadAll])

  // ── CO.4 Run Renewal Check ────────────────────────────────────────────────────

  const handleRunRenewalCheck = useCallback(async () => {
    setRenewCheckBusy(true)
    try {
      const [expiredResult, renewalResult] = await Promise.all([
        markExpiredCommercialContracts(user?.id),
        getContractsNeedingRenewalReview(30),
      ])
      if (expiredResult.ok && (expiredResult.data?.markedCount ?? 0) > 0) {
        showToast(`${expiredResult.data!.markedCount} contract(s) marked expired`)
        void loadAll()
      }
      setRenewalNeeded(renewalResult.data ?? [])
      if (!expiredResult.ok) showToast(expiredResult.error ?? 'Expiry check failed')
    } finally {
      setRenewCheckBusy(false)
    }
  }, [user, showToast, loadAll])

  // ── CO.5 Export / QA handlers ─────────────────────────────────────────────────

  const handlePrint = useCallback((c: CommercialContract) => {
    window.open(`/commercial/contracts/print/${c.id}`, '_blank', 'noopener,noreferrer')
  }, [])

  const handleCopySummary = useCallback(async (c: CommercialContract) => {
    // Fetch latest signature for the copy
    const sigResult = await getCommercialContractSignatures(c.id)
    const sig = sigResult.data?.[0] ?? null
    const result = await copyCommercialContractSummary(c, sig)
    showToast(result.ok ? 'Contract summary copied to clipboard' : (result.error ?? 'Copy failed'))
  }, [showToast])

  const handleDownloadSummary = useCallback(async (c: CommercialContract) => {
    const sigResult = await getCommercialContractSignatures(c.id)
    const sig = sigResult.data?.[0] ?? null
    downloadCommercialContractSummary(c, sig)
    showToast('Summary downloaded')
  }, [showToast])

  const handleQAChecklist = useCallback((c: CommercialContract) => {
    const checklist = buildContractQAChecklist(c)
    setQaModal({ contract: c, checklist })
  }, [])

  const handleSigCertificate = useCallback(async (c: CommercialContract) => {
    const sigResult = await getCommercialContractSignatures(c.id)
    const sig = sigResult.data?.[0] ?? null
    if (!sig) { showToast('No signature record found'); return }
    setCertModal({ contract: c, signature: sig })
  }, [showToast])

  const handleDownloadRenewalAudit = useCallback(() => {
    downloadRenewalAuditReport(contracts)
    showToast('Renewal audit report downloaded')
  }, [contracts, showToast])

  // ── Open edit modal ────────────────────────────────────────────────────────────

  const openEdit = useCallback((c: CommercialContract) => {
    setEditModal(c)
    setIsCreating(false)
    setFormData({
      account_id:                    c.account_id,
      contract_title:                c.contract_title,
      service_level:                 c.service_level,
      pickup_frequency:              c.pickup_frequency,
      bin_count:                     c.bin_count,
      bin_types:                     c.bin_types,
      emergency_pickup_allowed:      c.emergency_pickup_allowed,
      overflow_pickup_allowed:       c.overflow_pickup_allowed,
      contamination_policy_accepted: c.contamination_policy_accepted,
      start_date:                    c.start_date,
      end_date:                      c.end_date,
      renewal_date:                  c.renewal_date,
      status:                        c.status,
      contract_value_monthly:        c.contract_value_monthly,
      contract_value_annual:         c.contract_value_annual,
      notes:                         c.notes,
      created_by:                    c.created_by,
      updated_by:                    null,
    })
  }, [])

  const openCreate = useCallback(() => {
    setEditModal(null)
    setIsCreating(true)
    setFormData(defaultForm(accounts[0]?.id ?? ''))
  }, [accounts])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader />
      <div style={{ padding: '0 16px 96px', maxWidth: 760, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => navigate('/dashboard/admin')}
            style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← Admin Dashboard
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
                📋 Commercial Contracts
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                Create, renew, cancel, and review commercial service agreements.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => { void handleRunRenewalCheck() }}
                disabled={renewCheckBusy}
                style={{ padding: '9px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: renewCheckBusy ? 'rgba(255,255,255,0.05)' : 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', cursor: renewCheckBusy ? 'default' : 'pointer' }}
              >
                {renewCheckBusy ? '⏳ Checking…' : '🔍 Run Renewal Check'}
              </button>
              {/* CO.5 — Download Renewal Audit Report */}
              <button
                onClick={handleDownloadRenewalAudit}
                disabled={contracts.length === 0}
                style={{ padding: '9px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', cursor: contracts.length === 0 ? 'default' : 'pointer' }}
              >
                ⬇️ Renewal Audit
              </button>
              <PrimaryButton onClick={openCreate}>+ New Contract</PrimaryButton>
            </div>
          </div>

          {/* Payment disclaimer */}
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              ⚠️ This contract editor records service terms only. It does not process payments.
            </p>
          </div>
        </div>

        {/* ── Summary chips ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: 'Total',    value: contracts.length,                              color: '#00c8ff' },
            { label: 'Active',   value: contracts.filter(c => c.status === 'active').length,   color: '#4ade80' },
            { label: 'Expiring', value: expiring.length,                               color: expiring.length > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' },
            { label: 'Expired',  value: contracts.filter(c => c.status === 'expired').length,  color: contracts.some(c => c.status === 'expired') ? '#f87171' : 'rgba(255,255,255,0.3)' },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', minWidth: 64 }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── CO.4 Renewal check results banner ── */}
        {renewalNeeded.length > 0 && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', margin: '0 0 6px' }}>
              🕐 {renewalNeeded.length} contract{renewalNeeded.length !== 1 ? 's' : ''} need renewal review within 30 days
            </p>
            {renewalNeeded.map(c => (
              <p key={c.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '2px 0' }}>
                • {c.contract_title} — ends {c.end_date ?? c.renewal_date ?? 'unknown'}
              </p>
            ))}
            <button
              onClick={() => setRenewalNeeded([])}
              style={{ marginTop: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20, scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flexShrink:   0,
                padding:      '8px 14px',
                background:   'none',
                border:       'none',
                borderBottom: tab === t.key ? '2px solid #00c8ff' : '2px solid transparent',
                color:        tab === t.key ? '#00c8ff' : 'rgba(255,255,255,0.45)',
                fontWeight:   700,
                fontSize:     12,
                cursor:       'pointer',
                whiteSpace:   'nowrap',
              }}
            >
              {t.label}
              {t.key === 'expiring' && expiring.length > 0 && (
                <span style={{ marginLeft: 4, background: '#fbbf24', color: '#000', borderRadius: 999, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>
                  {expiring.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Contract list ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="📋" title="No Contracts" description="No contracts match this filter." />
        ) : (
          filtered.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              businessName={acctMap[c.account_id]}
              onEdit={openEdit}
              onRenew={c2 => { setRenewModal(c2); setRenewEndDate(''); setRenewalDate('') }}
              onCancel={c2 => { setCancelModal(c2); setCancelReason('') }}
              onStatusChange={c2 => { setStatusModal(c2); setNewStatus(c2.status); setStatusReason('') }}
              onViewHistory={handleViewHistory}
              onSendForSignature={handleSendForSignature}
              onPrint={handlePrint}
              onCopySummary={c2 => { void handleCopySummary(c2) }}
              onDownloadSummary={c2 => { void handleDownloadSummary(c2) }}
              onQAChecklist={handleQAChecklist}
              onSigCertificate={c2 => { void handleSigCertificate(c2) }}
            />
          ))
        )}

      </div>

      {/* ════════════════════════════════════════════
          EDIT / CREATE MODAL
      ════════════════════════════════════════════ */}
      {(editModal !== null || isCreating) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9998, padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 500, border: '1px solid rgba(255,255,255,0.12)', marginTop: 20 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
              {isCreating ? '📋 New Contract' : '✏️ Edit Contract'}
            </p>

            {/* Payment disclaimer */}
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', marginBottom: 16 }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                This editor records service terms only. It does not process payments.
              </p>
            </div>

            {/* Account */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Account *</label>
              <select
                value={formData.account_id}
                onChange={e => setFormData(p => ({ ...p, account_id: e.target.value }))}
                disabled={!isCreating}
                style={{ ...SELECT, opacity: isCreating ? 1 : 0.6 }}
              >
                <option value="">Select account…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.business_name}</option>)}
              </select>
            </div>

            {/* Contract title */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Contract Title *</label>
              <input
                value={formData.contract_title}
                onChange={e => setFormData(p => ({ ...p, contract_title: e.target.value }))}
                style={INPUT}
              />
            </div>

            {/* Service level + pickup frequency */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Service Level</label>
                <select
                  value={formData.service_level}
                  onChange={e => setFormData(p => ({ ...p, service_level: e.target.value as CommercialContractServiceLevel }))}
                  style={SELECT}
                >
                  {SERVICE_LEVELS.map(s => <option key={s} value={s}>{SERVICE_LEVEL_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Pickup Frequency</label>
                <select
                  value={formData.pickup_frequency}
                  onChange={e => setFormData(p => ({ ...p, pickup_frequency: e.target.value as CommercialContractPickupFrequency }))}
                  style={SELECT}
                >
                  {PICKUP_FREQUENCIES.map(f => <option key={f} value={f}>{PICKUP_FREQUENCY_LABEL[f]}</option>)}
                </select>
              </div>
            </div>

            {/* Bin count */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Bin Count</label>
              <input
                type="number"
                min={0}
                value={formData.bin_count}
                onChange={e => setFormData(p => ({ ...p, bin_count: parseInt(e.target.value, 10) || 0 }))}
                style={INPUT}
              />
            </div>

            {/* Bin types */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Bin Types <span style={{ fontWeight: 400 }}>(comma-separated)</span></label>
              <input
                value={formData.bin_types.join(', ')}
                onChange={e => setFormData(p => ({ ...p, bin_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                placeholder="e.g. cardboard, mixed recycling, organics"
                style={INPUT}
              />
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {(['start_date', 'end_date', 'renewal_date'] as const).map(field => (
                <div key={field}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>
                    {field.replace('_', ' ').replace('date', '').trim()} Date
                  </label>
                  <input
                    type="date"
                    value={formData[field] ?? ''}
                    onChange={e => setFormData(p => ({ ...p, [field]: e.target.value || null }))}
                    style={{ ...INPUT, colorScheme: 'dark' }}
                  />
                </div>
              ))}
            </div>

            {/* Status */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData(p => ({ ...p, status: e.target.value as CommercialContractStatus }))}
                style={SELECT}
              >
                {ALL_STATUSES.map(s => <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            {/* Permissions */}
            <div style={{ ...GLASS, marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', margin: '0 0 8px' }}>Permissions</p>
              {([
                ['emergency_pickup_allowed',      'Emergency Pickup Allowed'],
                ['overflow_pickup_allowed',       'Overflow Pickup Allowed'],
                ['contamination_policy_accepted', 'Contamination Policy Accepted'],
              ] as const).map(([field, label]) => (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData[field] as boolean}
                    onChange={e => setFormData(p => ({ ...p, [field]: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: '#00c8ff' }}
                  />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{label}</span>
                </label>
              ))}
            </div>

            {/* Contract values (informational only) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Monthly Value ($) <span style={{ fontWeight: 400 }}>optional</span></label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.contract_value_monthly ?? ''}
                  onChange={e => setFormData(p => ({ ...p, contract_value_monthly: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="0.00"
                  style={INPUT}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Annual Value ($) <span style={{ fontWeight: 400 }}>optional</span></label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.contract_value_annual ?? ''}
                  onChange={e => setFormData(p => ({ ...p, contract_value_annual: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="0.00"
                  style={INPUT}
                />
              </div>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '-8px 0 12px', lineHeight: 1.5 }}>
              * Values are for bookkeeping only. Platform does not charge or process payments.
            </p>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea
                value={formData.notes ?? ''}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value || null }))}
                placeholder="Optional internal notes…"
                rows={3}
                style={{ ...INPUT, resize: 'none' }}
              />
            </div>

            {/* Submit / cancel */}
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton
                variant="secondary"
                fullWidth
                onClick={() => { setEditModal(null); setIsCreating(false) }}
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton
                fullWidth
                disabled={working || !formData.account_id || !formData.contract_title.trim()}
                onClick={handleSubmitForm}
              >
                {working ? 'Saving…' : isCreating ? 'Create Contract' : 'Save Changes'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          RENEW MODAL
      ════════════════════════════════════════════ */}
      {renewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, border: '1px solid rgba(255,255,255,0.12)' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>🔄 Renew Contract</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>{renewModal.contract_title}</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>New End Date *</label>
              <input type="date" value={renewEndDate} onChange={e => setRenewEndDate(e.target.value)} style={{ ...INPUT, colorScheme: 'dark' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Renewal Date <span style={{ fontWeight: 400 }}>(optional, defaults to end date)</span></label>
              <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} style={{ ...INPUT, colorScheme: 'dark' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton variant="secondary" fullWidth onClick={() => setRenewModal(null)}>Cancel</PrimaryButton>
              <PrimaryButton fullWidth disabled={!renewEndDate || working} onClick={handleRenew}>
                {working ? 'Renewing…' : 'Renew Contract'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          CANCEL MODAL
      ════════════════════════════════════════════ */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, border: '1px solid rgba(255,255,255,0.12)' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>❌ Cancel Contract</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>{cancelModal.contract_title}</p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation…"
              rows={3}
              style={{ ...INPUT, resize: 'none', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton variant="secondary" fullWidth onClick={() => setCancelModal(null)}>Back</PrimaryButton>
              <PrimaryButton fullWidth disabled={!cancelReason.trim() || working} onClick={handleCancel}>
                {working ? 'Cancelling…' : 'Confirm Cancel'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          STATUS CHANGE MODAL
      ════════════════════════════════════════════ */}
      {statusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, border: '1px solid rgba(255,255,255,0.12)' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>🔀 Change Status</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>{statusModal.contract_title}</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>New Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value as CommercialContractStatus)} style={SELECT}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Reason / Note *</label>
              <textarea
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                placeholder="Explain why the status is changing…"
                rows={2}
                style={{ ...INPUT, resize: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton variant="secondary" fullWidth onClick={() => setStatusModal(null)}>Cancel</PrimaryButton>
              <PrimaryButton fullWidth disabled={!statusReason.trim() || working} onClick={handleStatusChange}>
                {working ? 'Saving…' : 'Update Status'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          HISTORY MODAL
      ════════════════════════════════════════════ */}
      {historyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9998, padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, border: '1px solid rgba(255,255,255,0.12)', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>📅 Contract History</p>
              <button onClick={() => setHistoryModal(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px' }}>{historyModal.contract_title}</p>
            {histLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
            ) : historyRows.length === 0 ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '16px 0' }}>No history recorded yet.</p>
            ) : (
              historyRows.map((h, i) => (
                <div key={h.id} style={{ padding: '10px 0', borderBottom: i < historyRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {h.action_type === 'created' ? '✅' : h.action_type === 'renewed' ? '🔄' : h.action_type === 'cancelled' ? '❌' : h.action_type === 'expired' ? '⏰' : h.action_type === 'note_added' ? '📝' : '🔀'}
                  </span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>{ACTION_TYPE_LABEL[h.action_type]}</p>
                    {h.change_summary && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 2px' }}>{h.change_summary}</p>}
                    {h.previous_status && h.new_status && (
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '0 0 2px' }}>{h.previous_status} → {h.new_status}</p>
                    )}
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                      {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))
            )}
            {/* CO.4 — Signature records */}
            {sigHistory.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(139,92,246,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>✍️ Signatures</p>
                {sigHistory.map(s => (
                  <div key={s.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', margin: '0 0 2px' }}>
                      {s.signer_name}{s.signer_title ? ` · ${s.signer_title}` : ''}
                    </p>
                    {s.signer_email && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 2px' }}>{s.signer_email}</p>
                    )}
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '0 0 2px' }}>
                      Signed: {new Date(s.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', margin: 0 }}>Version: {s.contract_version}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <PrimaryButton fullWidth variant="secondary" onClick={() => setHistoryModal(null)}>Close</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          CO.4 — SEND FOR SIGNATURE MODAL
      ════════════════════════════════════════════ */}
      {sigModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, border: '1px solid rgba(139,92,246,0.3)' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>✉️ Send for Signature</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>{sigModal.contract_title}</p>

            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.6 }}>
                This will mark the contract as <strong style={{ color: '#a78bfa' }}>Pending Signature</strong> and notify the commercial account representative to review and sign. The representative will see a "Review & Sign" button on their contracts screen.
              </p>
            </div>

            {/* Current signature status */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', fontWeight: 600 }}>Current Signature Status</p>
              <span style={{
                padding:       '3px 10px',
                borderRadius:  999,
                fontSize:      11,
                fontWeight:    700,
                background:    SIGNATURE_STATUS_COLOR[sigModal.signature_status] + '22',
                border:        `1px solid ${SIGNATURE_STATUS_COLOR[sigModal.signature_status]}55`,
                color:         SIGNATURE_STATUS_COLOR[sigModal.signature_status],
              }}>
                {SIGNATURE_STATUS_LABEL[sigModal.signature_status]}
              </span>
            </div>

            {/* Existing signatures */}
            {sigHistLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}><Spinner /></div>
            ) : sigHistory.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, margin: '0 0 6px' }}>Previous Signatures ({sigHistory.length})</p>
                {sigHistory.map(s => (
                  <p key={s.id} style={{ fontSize: 11, color: '#a78bfa', margin: '2px 0' }}>
                    ✍️ {s.signer_name} · {new Date(s.signed_at).toLocaleDateString()}
                  </p>
                ))}
              </div>
            ) : null}

            {sigModal.signature_status === 'signed' && (
              <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', margin: 0 }}>✅ This contract is already signed.</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton variant="secondary" fullWidth onClick={() => setSigModal(null)}>Cancel</PrimaryButton>
              <PrimaryButton
                fullWidth
                disabled={working || sigModal.signature_status === 'signed' || sigModal.status === 'cancelled'}
                onClick={() => { void handleConfirmSendForSignature() }}
              >
                {working ? 'Sending…' : 'Send Request'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          CO.5 — QA CHECKLIST MODAL
      ════════════════════════════════════════════ */}
      {qaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9998, padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 500, border: '1px solid rgba(251,191,36,0.25)', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>🔍 QA Checklist</p>
              <button onClick={() => setQaModal(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px' }}>{qaModal.contract.contract_title}</p>
            <CommercialContractQAChecklist checklist={qaModal.checklist} />
            <div style={{ marginTop: 16 }}>
              <PrimaryButton fullWidth variant="secondary" onClick={() => setQaModal(null)}>Close</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          CO.5 — SIGNATURE CERTIFICATE MODAL
      ════════════════════════════════════════════ */}
      {certModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9998, padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 580, border: '1px solid rgba(139,92,246,0.3)', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>📜 Signature Certificate</p>
              <button onClick={() => setCertModal(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <ContractSignatureCertificate
              signature={certModal.signature}
              contract={certModal.contract}
            />
            <div style={{ marginTop: 16 }}>
              <PrimaryButton fullWidth variant="secondary" onClick={() => setCertModal(null)}>Close</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1a1f2e', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 12, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, zIndex: 10000, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </AppShell>
  )
}
