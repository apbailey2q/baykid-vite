// AdminManagementOnboarding.tsx — Admin management roster with approval controls
//
// Phase MG.3 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Tabs: All | Pending | Active | Suspended | Terminated |
//       Needs Retraining | Missing Agreements | Missing Training
//
// Per-profile actions: Approve, Suspend, Terminate, Revoke Cert, Restore Cert,
//                       Require Retraining
// Permission Editor: inline toggle per profile
// Audit log: last admin action per profile
//
// Safety rule (Phase 8): Restore Certification is blocked unless:
//   • onboarding_completed === true
//   • all required agreements accepted
//   • assessment passed

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { ManagementAdminActionType, ManagementAdminAction } from '../../types'
import ManagementPermissionsEditor from '../../components/management/ManagementPermissionsEditor'
import {
  MANAGEMENT_AGREEMENT_VERSION,
  REQUIRED_AGREEMENT_CODES,
} from '../../data/managementAgreementData'

const BRAND      = '#00c8ff'
const SUCCESS    = '#4ade80'
const WARN       = '#fbbf24'
const DANGER     = '#f87171'
const PURPLE     = '#a78bfa'

// ── Enriched profile type ─────────────────────────────────────────────────────

interface RawProfile {
  id:                      string
  user_id:                 string
  management_type:         string
  department:              string
  status:                  string
  certified:               boolean
  certified_at:            string | null
  onboarding_completed:    boolean
  retraining_required:     boolean
  retraining_required_at:  string | null
  retraining_reason:       string | null
  created_at:              string
}

interface EnrichedProfile {
  profile:           RawProfile
  userEmail:         string | null
  userFullName:      string | null
  agreementsAccepted: number
  trainingCompleted:  number
  assessmentScore:    number | null
  assessmentPassed:   boolean
  lastAction:         ManagementAdminAction | null
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabKey = 'all' | 'pending' | 'active' | 'suspended' | 'terminated' | 'retraining' | 'missing_agreements' | 'missing_training'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',                label: 'All' },
  { key: 'pending',            label: 'Pending' },
  { key: 'active',             label: 'Active' },
  { key: 'suspended',          label: 'Suspended' },
  { key: 'terminated',         label: 'Terminated' },
  { key: 'retraining',         label: 'Needs Retraining' },
  { key: 'missing_agreements', label: 'Missing Agreements' },
  { key: 'missing_training',   label: 'Missing Training' },
]

function filterProfiles(enriched: EnrichedProfile[], tab: TabKey): EnrichedProfile[] {
  switch (tab) {
    case 'pending':            return enriched.filter(e => e.profile.status === 'pending_onboarding')
    case 'active':             return enriched.filter(e => e.profile.status === 'active')
    case 'suspended':          return enriched.filter(e => e.profile.status === 'suspended')
    case 'terminated':         return enriched.filter(e => e.profile.status === 'terminated')
    case 'retraining':         return enriched.filter(e => e.profile.retraining_required)
    case 'missing_agreements': return enriched.filter(e => e.agreementsAccepted < REQUIRED_AGREEMENT_CODES.length)
    case 'missing_training':   return enriched.filter(e => e.trainingCompleted < 10)
    default:                   return enriched
  }
}

// ── Action definitions ────────────────────────────────────────────────────────

interface ActionDef {
  type:           ManagementAdminActionType
  label:          string
  icon:           string
  color:          string
  requiresReason: boolean
  reasonPlaceholder?: string
}

const ACTION_DEFS: ActionDef[] = [
  {
    type:           'approved',
    label:          'Approve',
    icon:           '✅',
    color:          SUCCESS,
    requiresReason: false,
  },
  {
    type:           'suspended',
    label:          'Suspend',
    icon:           '⏸️',
    color:          WARN,
    requiresReason: true,
    reasonPlaceholder: 'Required: reason for suspension',
  },
  {
    type:           'terminated',
    label:          'Terminate',
    icon:           '🚫',
    color:          DANGER,
    requiresReason: true,
    reasonPlaceholder: 'Required: reason for termination',
  },
  {
    type:           'certification_revoked',
    label:          'Revoke Cert',
    icon:           '❌',
    color:          DANGER,
    requiresReason: true,
    reasonPlaceholder: 'Required: reason for revoking certification',
  },
  {
    type:           'certification_restored',
    label:          'Restore Cert',
    icon:           '🔄',
    color:          BRAND,
    requiresReason: false,
  },
  {
    type:           'retraining_required',
    label:          'Require Retraining',
    icon:           '🎓',
    color:          PURPLE,
    requiresReason: true,
    reasonPlaceholder: 'Required: reason and scope of retraining',
  },
]

// ── Pending action state ──────────────────────────────────────────────────────

interface PendingAction {
  profileId:      string
  profileDisplay: string
  def:            ActionDef
  safetyWarnings: string[]
  blocked:        boolean
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminManagementOnboarding() {
  const { user } = useAuthStore()

  const [enriched,    setEnriched]    = useState<EnrichedProfile[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<TabKey>('all')
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionReason, setActionReason]  = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ── Load all data ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setGlobalError(null)
    try {
      // Phase 1: management profiles
      const { data: rawProfiles, error: pErr } = await supabase
        .from('management_profiles')
        .select('id, user_id, management_type, department, status, certified, certified_at, onboarding_completed, retraining_required, retraining_required_at, retraining_reason, created_at')
        .order('created_at', { ascending: false })

      if (pErr) throw pErr
      if (!rawProfiles || rawProfiles.length === 0) {
        setEnriched([])
        setLoading(false)
        return
      }

      const profileIds = rawProfiles.map(p => p.id as string)
      const userIds    = rawProfiles.map(p => p.user_id as string)

      // Phase 2: parallel queries
      const [acceptResult, trainResult, actionResult, progressResult, userResult] = await Promise.all([
        supabase
          .from('management_agreement_acceptances')
          .select('management_profile_id, agreement_code')
          .in('management_profile_id', profileIds)
          .eq('agreement_version', MANAGEMENT_AGREEMENT_VERSION)
          .eq('accepted', true),

        supabase
          .from('management_training_completions')
          .select('management_profile_id')
          .in('management_profile_id', profileIds)
          .eq('completed', true),

        supabase
          .from('management_admin_actions')
          .select('*')
          .in('management_profile_id', profileIds)
          .order('created_at', { ascending: false }),

        supabase
          .from('management_onboarding_progress')
          .select('management_profile_id, assessment_passed, assessment_score')
          .in('management_profile_id', profileIds),

        supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds),
      ])

      // Build lookup maps
      const acceptMap: Record<string, Set<string>> = {}
      for (const row of acceptResult.data ?? []) {
        const pid = row.management_profile_id as string
        if (!acceptMap[pid]) acceptMap[pid] = new Set()
        acceptMap[pid].add(row.agreement_code as string)
      }

      const trainCountMap: Record<string, number> = {}
      for (const row of trainResult.data ?? []) {
        const pid = row.management_profile_id as string
        trainCountMap[pid] = (trainCountMap[pid] ?? 0) + 1
      }

      // Last action per profile (data already ordered desc)
      const lastActionMap: Record<string, ManagementAdminAction> = {}
      for (const row of actionResult.data ?? []) {
        const pid = row.management_profile_id as string
        if (!lastActionMap[pid]) lastActionMap[pid] = row as ManagementAdminAction
      }

      // Progress per profile
      const progressMap: Record<string, { assessment_passed: boolean; assessment_score: number | null }> = {}
      for (const row of progressResult.data ?? []) {
        progressMap[row.management_profile_id as string] = {
          assessment_passed: Boolean(row.assessment_passed),
          assessment_score:  row.assessment_score as number | null,
        }
      }

      // User info
      const userMap: Record<string, { full_name: string | null; email: string | null }> = {}
      for (const row of userResult.data ?? []) {
        userMap[row.id as string] = {
          full_name: row.full_name as string | null,
          email:     row.email as string | null,
        }
      }

      // Build enriched list
      const result: EnrichedProfile[] = rawProfiles.map(prof => {
        const p       = prof as RawProfile
        const accepts = acceptMap[p.id] ?? new Set<string>()
        const prog    = progressMap[p.id]
        const uinfo   = userMap[p.user_id]
        return {
          profile:           p,
          userEmail:         uinfo?.email ?? null,
          userFullName:      uinfo?.full_name ?? null,
          agreementsAccepted: accepts.size,
          trainingCompleted:  trainCountMap[p.id] ?? 0,
          assessmentScore:    prog?.assessment_score ?? null,
          assessmentPassed:   prog?.assessment_passed ?? false,
          lastAction:         lastActionMap[p.id] ?? null,
        }
      })

      setEnriched(result)
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load management data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Safety check for certification restore ────────────────────────────────
  function certRestoreSafety(e: EnrichedProfile): { warnings: string[]; blocked: boolean } {
    const warnings: string[] = []
    if (!e.profile.onboarding_completed)
      warnings.push('Onboarding not completed')
    if (e.agreementsAccepted < REQUIRED_AGREEMENT_CODES.length)
      warnings.push(`Agreements: ${e.agreementsAccepted}/${REQUIRED_AGREEMENT_CODES.length} accepted`)
    if (!e.assessmentPassed)
      warnings.push('Management assessment not passed')
    return { warnings, blocked: warnings.length > 0 }
  }

  // ── Open action panel ─────────────────────────────────────────────────────
  function openAction(e: EnrichedProfile, def: ActionDef) {
    let safetyWarnings: string[] = []
    let blocked = false

    if (def.type === 'certification_restored') {
      const check = certRestoreSafety(e)
      safetyWarnings = check.warnings
      blocked        = check.blocked
    }

    const displayName = e.userFullName ?? e.userEmail ?? `${e.profile.management_type} · ${e.profile.department}`
    setActionReason('')
    setActionError(null)
    setPendingAction({ profileId: e.profile.id, profileDisplay: displayName, def, safetyWarnings, blocked })
  }

  // ── Execute action ────────────────────────────────────────────────────────
  async function executeAction() {
    if (!pendingAction || !user) return
    const { profileId, def, safetyWarnings: _, blocked } = pendingAction
    if (blocked) return

    if (def.requiresReason && actionReason.trim().length < 3) {
      setActionError('Please provide a reason (at least 3 characters).')
      return
    }

    setSubmitting(true)
    setActionError(null)
    try {
      const now = new Date().toISOString()

      // Determine profile update payload
      const profileUpdates: Record<string, unknown> = {}
      let previousStatus: string | undefined
      let newStatus: string | undefined

      const enrichedEntry = enriched.find(e => e.profile.id === profileId)
      if (enrichedEntry) previousStatus = enrichedEntry.profile.status

      switch (def.type) {
        case 'approved':
          profileUpdates.status       = 'active'
          profileUpdates.certified    = true
          profileUpdates.certified_at = now
          newStatus = 'active'
          break
        case 'suspended':
          profileUpdates.status = 'suspended'
          newStatus = 'suspended'
          break
        case 'terminated':
          profileUpdates.status    = 'terminated'
          profileUpdates.certified = false
          newStatus = 'terminated'
          break
        case 'certification_revoked':
          profileUpdates.certified    = false
          profileUpdates.certified_at = null
          break
        case 'certification_restored':
          profileUpdates.certified    = true
          profileUpdates.certified_at = now
          break
        case 'retraining_required':
          profileUpdates.retraining_required    = true
          profileUpdates.retraining_required_at = now
          profileUpdates.retraining_reason      = actionReason.trim()
          break
        // permissions_updated and note_added handled elsewhere
      }

      // 1. Update management_profiles if any field changes
      if (Object.keys(profileUpdates).length > 0) {
        const { error: upErr } = await supabase
          .from('management_profiles')
          .update(profileUpdates)
          .eq('id', profileId)
        if (upErr) throw upErr
      }

      // 2. Create audit log entry
      const { error: logErr } = await supabase
        .from('management_admin_actions')
        .insert({
          management_profile_id: profileId,
          admin_user_id:         user.id,
          action_type:           def.type,
          reason:                actionReason.trim() || null,
          previous_status:       previousStatus ?? null,
          new_status:            newStatus ?? null,
          metadata:              { profile_updates: profileUpdates },
        })
      if (logErr) throw logErr

      setPendingAction(null)
      await loadAll()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = filterProfiles(enriched, activeTab)

  const tabCounts: Partial<Record<TabKey, number>> = {
    all:                enriched.length,
    pending:            enriched.filter(e => e.profile.status === 'pending_onboarding').length,
    active:             enriched.filter(e => e.profile.status === 'active').length,
    suspended:          enriched.filter(e => e.profile.status === 'suspended').length,
    terminated:         enriched.filter(e => e.profile.status === 'terminated').length,
    retraining:         enriched.filter(e => e.profile.retraining_required).length,
    missing_agreements: enriched.filter(e => e.agreementsAccepted < REQUIRED_AGREEMENT_CODES.length).length,
    missing_training:   enriched.filter(e => e.trainingCompleted < 10).length,
  }

  // ── Status display helpers ────────────────────────────────────────────────
  const statusColor: Record<string, string> = {
    active:              SUCCESS,
    pending_onboarding:  WARN,
    suspended:           DANGER,
    terminated:          '#6b7280',
  }

  function statusLabel(s: string) {
    return s.replace(/_/g, ' ')
  }

  const lastActionLabel: Record<string, string> = {
    approved:              '✅ Approved',
    suspended:             '⏸️ Suspended',
    terminated:            '🚫 Terminated',
    certification_revoked:  '❌ Cert Revoked',
    certification_restored: '🔄 Cert Restored',
    retraining_required:   '🎓 Retraining Set',
    permissions_updated:   '🔧 Permissions Updated',
    note_added:            '📝 Note Added',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>CYAN'S BROOKLYNN RECYCLING</p>
            <p className="text-white font-bold text-lg leading-tight">Management Oversight</p>
          </div>
          <div className="flex gap-3">
            <Link to="/management/agreement-compliance"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: WARN, textDecoration: 'none' }}>
              📋 Agreements
            </Link>
            <Link to="/management/dashboard"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
              Dashboard
            </Link>
            <Link to="/dashboard/admin"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
              ← Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Global error ── */}
        {globalError && (
          <div className="p-3 rounded-xl text-sm text-red-300 mb-6"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {globalError}
          </div>
        )}

        {/* ── Summary row ── */}
        <div className="flex flex-wrap gap-4 mb-6">
          {[
            ['Total',      enriched.length,                                                           'rgba(255,255,255,0.6)'],
            ['Active',     enriched.filter(e => e.profile.status === 'active').length,                SUCCESS],
            ['Pending',    enriched.filter(e => e.profile.status === 'pending_onboarding').length,    WARN],
            ['Suspended',  enriched.filter(e => e.profile.status === 'suspended').length,             DANGER],
            ['Certified',  enriched.filter(e => e.profile.certified).length,                          BRAND],
            ['Retraining', enriched.filter(e => e.profile.retraining_required).length,                PURPLE],
          ].map(([label, count, color]) => (
            <div key={label as string} className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-lg font-bold" style={{ color: color as string }}>{count as number}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label as string}</p>
            </div>
          ))}
          <button
            onClick={loadAll}
            disabled={loading}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: BRAND }}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex overflow-x-auto gap-1 mb-6 pb-1"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const count = tabCounts[tab.key] ?? 0
            const active = activeTab === tab.key
            const hasAlert = tab.key !== 'all' && tab.key !== 'active' && count > 0
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="shrink-0 px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors whitespace-nowrap"
                style={{
                  borderBottomColor: active ? BRAND : 'transparent',
                  color: active ? BRAND : hasAlert ? WARN : 'rgba(255,255,255,0.45)',
                  background: active ? 'rgba(0,200,255,0.06)' : 'transparent',
                }}
              >
                {tab.label} {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
              </button>
            )
          })}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
              style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {activeTab === 'all'
              ? 'No management profiles found. Profiles are created by admin when onboarding a new manager.'
              : `No profiles match the "${TABS.find(t => t.key === activeTab)?.label}" filter.`}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(e => {
              const isExpanded  = expandedId === e.profile.id
              const sColor      = statusColor[e.profile.status] ?? '#9ca3af'
              const displayName = e.userFullName ?? e.userEmail ?? `${e.profile.management_type}`
              const dateStr     = new Date(e.profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })

              return (
                <div key={e.profile.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ border: `1px solid ${isExpanded ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.07)'}` }}>

                  {/* ── Card header ── */}
                  <div className="px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex flex-wrap items-start gap-4">

                      {/* Identity */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white capitalize">{displayName}</p>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-lg capitalize"
                            style={{ color: sColor, background: `${sColor}18`, border: `1px solid ${sColor}30` }}>
                            {statusLabel(e.profile.status)}
                          </span>
                          {e.profile.certified && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                              style={{ color: BRAND, background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)' }}>
                              ✓ Certified
                            </span>
                          )}
                          {e.profile.retraining_required && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                              style={{ color: PURPLE, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)' }}>
                              🎓 Retraining
                            </span>
                          )}
                        </div>
                        <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {e.profile.management_type} · {e.profile.department}
                          {e.userEmail && <> · <span style={{ color: 'rgba(255,255,255,0.3)' }}>{e.userEmail}</span></>}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          Added {dateStr} · ID {e.profile.id.slice(0, 8)}
                        </p>
                      </div>

                      {/* Metrics */}
                      <div className="flex gap-4 text-center shrink-0">
                        <div>
                          <p className="text-sm font-bold"
                            style={{ color: e.agreementsAccepted >= REQUIRED_AGREEMENT_CODES.length ? SUCCESS : WARN }}>
                            {e.agreementsAccepted}/{REQUIRED_AGREEMENT_CODES.length}
                          </p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Agreements</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold"
                            style={{ color: e.trainingCompleted >= 10 ? SUCCESS : WARN }}>
                            {e.trainingCompleted}/10
                          </p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Training</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold"
                            style={{ color: e.assessmentPassed ? SUCCESS : e.assessmentScore !== null ? DANGER : 'rgba(255,255,255,0.35)' }}>
                            {e.assessmentScore !== null ? `${e.assessmentScore}/20` : '—'}
                          </p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Score</p>
                        </div>
                      </div>
                    </div>

                    {/* Last admin action */}
                    {e.lastAction && (
                      <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Last action: <span style={{ color: 'rgba(255,255,255,0.55)' }}>{lastActionLabel[e.lastAction.action_type] ?? e.lastAction.action_type}</span>
                          {e.lastAction.reason && <> — "{e.lastAction.reason}"</>}
                          {' · '}{new Date(e.lastAction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {ACTION_DEFS.map(def => {
                        const isCertRestore = def.type === 'certification_restored'
                        const { blocked } = isCertRestore ? certRestoreSafety(e) : { blocked: false }
                        return (
                          <button
                            key={def.type}
                            onClick={() => openAction(e, def)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                            style={{
                              background:  `${def.color}15`,
                              border:      `1px solid ${def.color}35`,
                              color:       blocked ? 'rgba(255,255,255,0.25)' : def.color,
                              opacity:     blocked ? 0.5 : 1,
                            }}
                          >
                            {def.icon} {def.label}
                            {blocked && ' 🔒'}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : e.profile.id)}
                        className="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: isExpanded ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.04)',
                          border:     `1px solid ${isExpanded ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                          color:      isExpanded ? BRAND : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        🔧 Edit Permissions {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {/* ── Expanded: Permissions Editor ── */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-3" style={{ borderTop: '1px solid rgba(0,200,255,0.1)', background: 'rgba(0,200,255,0.03)' }}>
                      <p className="text-xs font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        PERMISSIONS — {displayName.toUpperCase()}
                      </p>
                      <ManagementPermissionsEditor
                        profileId={e.profile.id}
                        adminUserId={user?.id}
                        onSaved={loadAll}
                        compact
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Action Confirmation Panel (overlay) ── */}
      {pendingAction && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => !submitting && setPendingAction(null)}
          />
          {/* Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 pb-8"
            style={{ background: '#0d1a33', border: '1px solid rgba(0,200,255,0.2)', maxWidth: 560, margin: '0 auto' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{pendingAction.def.icon}</span>
              <div>
                <p className="text-base font-bold text-white">{pendingAction.def.label}</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{pendingAction.profileDisplay}</p>
              </div>
              <button
                className="ml-auto text-sm px-3 py-1 rounded-xl"
                style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}
                onClick={() => !submitting && setPendingAction(null)}
              >
                Cancel
              </button>
            </div>

            {/* Safety warnings */}
            {pendingAction.safetyWarnings.length > 0 && (
              <div className="p-3 rounded-xl mb-4 text-xs"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: DANGER }}>
                <p className="font-bold mb-1">🔒 Certification Restore Blocked</p>
                {pendingAction.safetyWarnings.map(w => (
                  <p key={w}>• {w}</p>
                ))}
                <p className="mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  All requirements must be met before certification can be restored.
                </p>
              </div>
            )}

            {/* Reason input */}
            {pendingAction.def.requiresReason && !pendingAction.blocked && (
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Reason (required)
                </label>
                <textarea
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  placeholder={pendingAction.def.reasonPlaceholder}
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>
            )}

            {actionError && (
              <p className="text-xs mb-3" style={{ color: DANGER }}>{actionError}</p>
            )}

            {!pendingAction.blocked && (
              <button
                onClick={executeAction}
                disabled={submitting || (pendingAction.def.requiresReason && actionReason.trim().length < 3)}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-35"
                style={{ background: pendingAction.def.color, color: '#000' }}
              >
                {submitting ? 'Processing…' : `Confirm — ${pendingAction.def.label}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
