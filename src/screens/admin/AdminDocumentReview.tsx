// AdminDocumentReview.tsx — Admin compliance document review center
//
// Phase MG.4 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Tabs: All | Pending Review | Missing | Expiring Soon | Expired |
//       Rejected | Countdown Active | Temporarily Deactivated
//
// Admin actions per document:
//   Approve · Reject (reason required) · Mark Missing ·
//   Start Countdown · Cancel Countdown · Reactivate · Add Note
//
// Each action creates a compliance notification to the document owner.
//
// Route: /admin/document-review
// Access: admin only

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { ComplianceDocument, ComplianceDocumentStatus } from '../../types'
import {
  createComplianceNotification,
  createDocumentRejectedNotification,
  createCountdownStartedNotification,
  createReactivationNotification,
} from '../../lib/complianceNotifications'
import {
  getDaysUntilExpiration,
  getCountdownLabel,
  shouldTemporarilyDeactivate,
} from '../../lib/documentExpiration'

const BRAND   = '#00c8ff'
const SUCCESS = '#4ade80'
const WARN    = '#fbbf24'
const DANGER  = '#f87171'
const ORANGE  = '#f97316'
const PURPLE  = '#a78bfa'

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabKey =
  | 'all'
  | 'pending_review'
  | 'missing'
  | 'expiring_soon'
  | 'expired'
  | 'rejected'
  | 'countdown'
  | 'deactivated'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',           label: 'All' },
  { key: 'pending_review',label: 'Pending Review' },
  { key: 'missing',       label: 'Missing' },
  { key: 'expiring_soon', label: 'Expiring Soon' },
  { key: 'expired',       label: 'Expired' },
  { key: 'rejected',      label: 'Rejected' },
  { key: 'countdown',     label: 'Countdown Active' },
  { key: 'deactivated',   label: 'Temporarily Deactivated' },
]

function filterDocs(docs: ComplianceDocument[], tab: TabKey): ComplianceDocument[] {
  switch (tab) {
    case 'pending_review': return docs.filter(d => d.status === 'pending_review')
    case 'missing':        return docs.filter(d => d.status === 'missing')
    case 'expiring_soon':  return docs.filter(d => d.status === 'expiring_soon')
    case 'expired':        return docs.filter(d => d.status === 'expired')
    case 'rejected':       return docs.filter(d => d.status === 'rejected')
    case 'countdown':      return docs.filter(d => !!d.deactivation_countdown_started_at && !d.temporary_deactivation_at)
    case 'deactivated':    return docs.filter(d => !!d.temporary_deactivation_at && !d.reactivated_at)
    default:               return docs
  }
}

// ── Action panel state ────────────────────────────────────────────────────────

type ActionType = 'approve' | 'reject' | 'mark_missing' | 'start_countdown' | 'cancel_countdown' | 'reactivate' | 'add_note'

interface PendingAction {
  docId:       string
  ownerId:     string
  ownerType:   string
  docTitle:    string
  actionType:  ActionType
  requiresNote: boolean
}

const ACTION_DEFS: { type: ActionType; label: string; icon: string; color: string; requiresNote: boolean }[] = [
  { type: 'approve',         label: 'Approve',         icon: '✅', color: SUCCESS, requiresNote: false },
  { type: 'reject',          label: 'Reject',          icon: '🚫', color: DANGER,  requiresNote: true  },
  { type: 'mark_missing',    label: 'Mark Missing',    icon: '❌', color: WARN,    requiresNote: false },
  { type: 'start_countdown', label: 'Start Countdown', icon: '⏱️', color: ORANGE,  requiresNote: false },
  { type: 'cancel_countdown',label: 'Cancel Countdown',icon: '↩️', color: PURPLE,  requiresNote: false },
  { type: 'reactivate',      label: 'Reactivate',      icon: '🔄', color: BRAND,   requiresNote: false },
  { type: 'add_note',        label: 'Add Note',        icon: '📝', color: 'rgba(255,255,255,0.7)', requiresNote: true },
]

const STATUS_COLOR: Record<ComplianceDocumentStatus, string> = {
  approved:      SUCCESS,
  pending_review: WARN,
  missing:       DANGER,
  rejected:      DANGER,
  expired:       DANGER,
  expiring_soon: ORANGE,
}

// ── User profile cache ────────────────────────────────────────────────────────

interface UserInfo { email: string | null; full_name: string | null }

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDocumentReview() {
  const { user } = useAuthStore()

  const [docs,         setDocs]         = useState<ComplianceDocument[]>([])
  const [userMap,      setUserMap]       = useState<Record<string, UserInfo>>({})
  const [loading,      setLoading]       = useState(true)
  const [activeTab,    setActiveTab]     = useState<TabKey>('all')
  const [globalError,  setGlobalError]   = useState<string | null>(null)

  // Action panel
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionNote,    setActionNote]    = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [actionError,   setActionError]   = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setGlobalError(null)
    try {
      const { data: rawDocs, error: dErr } = await supabase
        .from('compliance_documents')
        .select('*')
        .order('created_at', { ascending: false })

      if (dErr) throw dErr
      const documents = (rawDocs ?? []) as ComplianceDocument[]
      setDocs(documents)

      // Load user info for all unique owner_user_ids
      const uids = [...new Set(documents.map(d => d.owner_user_id).filter(Boolean))]
      if (uids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', uids)
        const map: Record<string, UserInfo> = {}
        for (const p of profiles ?? []) {
          map[p.id as string] = { email: p.email as string | null, full_name: p.full_name as string | null }
        }
        setUserMap(map)
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Execute action ────────────────────────────────────────────────────────────
  async function executeAction() {
    if (!pendingAction || !user) return
    const { docId, ownerId, ownerType, docTitle, actionType, requiresNote } = pendingAction

    if (requiresNote && actionNote.trim().length < 2) {
      setActionError('Please provide a note.')
      return
    }

    setSubmitting(true)
    setActionError(null)
    try {
      const now = new Date().toISOString()
      const updates: Partial<Record<string, unknown>> = { updated_at: now }

      switch (actionType) {
        case 'approve':
          updates.status       = 'approved'
          updates.reviewed_by  = user.id
          updates.reviewed_at  = now
          updates.review_notes = actionNote.trim() || null
          // Send notification
          await createComplianceNotification({
            recipientUserId:  ownerId,
            ownerType:        ownerType as import('../../types').OwnerType,
            notificationType: 'document_missing', // re-using closest type; reactivation fits better
            severity:         'info',
            title:            'Document Approved',
            message:          `Your ${docTitle} has been reviewed and approved by Cyan's Brooklynn Recycling.`,
            relatedDocumentId: docId,
          })
          break

        case 'reject':
          updates.status       = 'rejected'
          updates.reviewed_by  = user.id
          updates.reviewed_at  = now
          updates.review_notes = actionNote.trim()
          await createDocumentRejectedNotification({
            recipientUserId: ownerId,
            ownerType:       ownerType as import('../../types').OwnerType,
            documentTitle:   docTitle,
            reviewNotes:     actionNote.trim(),
            documentId:      docId,
            actionUrl:       '/management/documents',
          })
          break

        case 'mark_missing':
          updates.status = 'missing'
          await createComplianceNotification({
            recipientUserId:  ownerId,
            ownerType:        ownerType as import('../../types').OwnerType,
            notificationType: 'document_missing',
            severity:         'warning',
            title:            'Document Marked Missing',
            message:          `Your ${docTitle} has been marked as missing by Cyan's Brooklynn Recycling. Please upload the document.`,
            relatedDocumentId: docId,
            actionRequired:   true,
            actionUrl:        '/management/documents',
          })
          break

        case 'start_countdown': {
          const deactivationAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          updates.deactivation_countdown_started_at = now
          updates.temporary_deactivation_at         = deactivationAt
          await createCountdownStartedNotification({
            recipientUserId:  ownerId,
            ownerType:        ownerType as import('../../types').OwnerType,
            documentTitle:    docTitle,
            deactivationDate: deactivationAt,
            documentId:       docId,
            actionUrl:        '/management/documents',
          })
          break
        }

        case 'cancel_countdown':
          updates.deactivation_countdown_started_at = null
          updates.temporary_deactivation_at         = null
          await createComplianceNotification({
            recipientUserId:  ownerId,
            ownerType:        ownerType as import('../../types').OwnerType,
            notificationType: 'countdown_started',
            severity:         'info',
            title:            'Deactivation Countdown Cancelled',
            message:          `The compliance deactivation countdown for your ${docTitle} has been cancelled by Cyan's Brooklynn Recycling.`,
            relatedDocumentId: docId,
          })
          break

        case 'reactivate':
          updates.reactivated_at                    = now
          updates.temporary_deactivation_at         = null
          updates.deactivation_countdown_started_at = null
          updates.status                            = 'approved'
          updates.reviewed_by                       = user.id
          updates.reviewed_at                       = now
          await createReactivationNotification({
            recipientUserId: ownerId,
            ownerType:       ownerType as import('../../types').OwnerType,
          })
          break

        case 'add_note':
          updates.review_notes = actionNote.trim()
          break
      }

      // Apply DB updates
      const { error: upErr } = await supabase
        .from('compliance_documents')
        .update(updates)
        .eq('id', docId)
      if (upErr) throw upErr

      setPendingAction(null)
      await loadAll()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────────
  const filtered = filterDocs(docs, activeTab)

  const tabCounts: Partial<Record<TabKey, number>> = {
    all:            docs.length,
    pending_review: docs.filter(d => d.status === 'pending_review').length,
    missing:        docs.filter(d => d.status === 'missing').length,
    expiring_soon:  docs.filter(d => d.status === 'expiring_soon').length,
    expired:        docs.filter(d => d.status === 'expired').length,
    rejected:       docs.filter(d => d.status === 'rejected').length,
    countdown:      docs.filter(d => !!d.deactivation_countdown_started_at && !d.temporary_deactivation_at).length,
    deactivated:    docs.filter(d => !!d.temporary_deactivation_at && !d.reactivated_at).length,
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>CYAN'S BROOKLYNN RECYCLING</p>
            <p className="text-white font-bold text-lg leading-tight">Document Review</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadAll}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
              style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: BRAND }}>
              {loading ? '…' : '↻ Refresh'}
            </button>
            <Link to="/dashboard/admin"
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
              ← Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {globalError && (
          <div className="p-3 rounded-xl text-sm text-red-300 mb-6"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {globalError}
          </div>
        )}

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            ['Total',       docs.length,                                             'rgba(255,255,255,0.6)'],
            ['Pending',     tabCounts.pending_review ?? 0,                           WARN],
            ['Missing',     tabCounts.missing ?? 0,                                  DANGER],
            ['Expiring',    (tabCounts.expiring_soon ?? 0) + (tabCounts.expired ?? 0), ORANGE],
            ['Countdown',   tabCounts.countdown ?? 0,                                ORANGE],
            ['Deactivated', tabCounts.deactivated ?? 0,                              DANGER],
          ].map(([label, count, color]) => (
            <div key={label as string} className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-lg font-bold" style={{ color: color as string }}>{count as number}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label as string}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 mb-6"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const count  = tabCounts[tab.key] ?? 0
            const active = activeTab === tab.key
            const alert  = tab.key !== 'all' && count > 0
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="shrink-0 px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors whitespace-nowrap"
                style={{
                  borderBottomColor: active ? BRAND : 'transparent',
                  color:  active ? BRAND : alert ? WARN : 'rgba(255,255,255,0.45)',
                  background: active ? 'rgba(0,200,255,0.06)' : 'transparent',
                }}>
                {tab.label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
              style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {activeTab === 'all'
              ? 'No compliance documents found.'
              : `No documents in the "${TABS.find(t => t.key === activeTab)?.label}" category.`}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(doc => {
              const uinfo      = userMap[doc.owner_user_id] ?? null
              const displayName = uinfo?.full_name ?? uinfo?.email ?? doc.owner_user_id.slice(0, 8)
              const sColor     = STATUS_COLOR[doc.status] ?? 'rgba(255,255,255,0.4)'
              const daysLeft   = doc.expiration_date ? getDaysUntilExpiration(doc.expiration_date) : null
              const inCountdown = !!doc.deactivation_countdown_started_at && !doc.temporary_deactivation_at
              const isDeact    = !!doc.temporary_deactivation_at && !doc.reactivated_at
              const overdue    = shouldTemporarilyDeactivate(doc)

              return (
                <div key={doc.id} className="rounded-2xl overflow-hidden"
                  style={{ border: `1px solid ${isDeact ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.07)'}` }}>

                  <div className="px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex flex-wrap items-start gap-3">

                      {/* Doc info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white">{doc.document_title}</p>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg capitalize"
                            style={{ color: sColor, background: `${sColor}15`, border: `1px solid ${sColor}25` }}>
                            {doc.status.replace(/_/g, ' ')}
                          </span>
                          {isDeact && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                              style={{ color: DANGER, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
                              🚫 Deactivated
                            </span>
                          )}
                          {inCountdown && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                              style={{ color: ORANGE, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
                              ⏱️ {getCountdownLabel(doc)}{overdue ? ' — OVERDUE' : ''}
                            </span>
                          )}
                        </div>

                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {displayName} · {doc.owner_type} · {doc.document_type}
                        </p>

                        {daysLeft !== null && (
                          <p className="text-xs mt-1"
                            style={{ color: daysLeft < 0 ? DANGER : daysLeft <= 7 ? ORANGE : WARN }}>
                            {daysLeft < 0
                              ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
                              : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                          </p>
                        )}

                        {doc.review_notes && (
                          <p className="text-xs mt-1 italic" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Note: {doc.review_notes}
                          </p>
                        )}

                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          Created {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                          {' · '}ID {doc.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {ACTION_DEFS.map(def => (
                        <button key={def.type}
                          onClick={() => {
                            setActionNote('')
                            setActionError(null)
                            setPendingAction({
                              docId:       doc.id,
                              ownerId:     doc.owner_user_id,
                              ownerType:   doc.owner_type,
                              docTitle:    doc.document_title,
                              actionType:  def.type,
                              requiresNote: def.requiresNote,
                            })
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                          style={{
                            background: `${def.color}15`,
                            border:     `1px solid ${def.color}30`,
                            color:      def.color,
                          }}>
                          {def.icon} {def.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Action Panel */}
      {pendingAction && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => !submitting && setPendingAction(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 pb-8"
            style={{ background: '#0d1a33', border: '1px solid rgba(0,200,255,0.2)', maxWidth: 520, margin: '0 auto' }}>

            <p className="text-base font-bold text-white mb-1">
              {ACTION_DEFS.find(d => d.type === pendingAction.actionType)?.icon}{' '}
              {ACTION_DEFS.find(d => d.type === pendingAction.actionType)?.label}
            </p>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {pendingAction.docTitle}
            </p>

            {pendingAction.requiresNote && (
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {pendingAction.actionType === 'reject' ? 'Rejection reason (required)' : 'Note (required)'}
                </label>
                <textarea
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  placeholder="Enter notes..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>
            )}

            {actionError && (
              <p className="text-xs mb-3" style={{ color: DANGER }}>{actionError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => !submitting && setPendingAction(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={submitting || (pendingAction.requiresNote && actionNote.trim().length < 2)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-35"
                style={{
                  background: ACTION_DEFS.find(d => d.type === pendingAction.actionType)?.color ?? BRAND,
                  color: '#000',
                }}>
                {submitting ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
