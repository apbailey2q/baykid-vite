import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { NotificationEventType, NotificationPriority } from '../../store/notificationStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'
import { PhotoLightbox } from '../../components/ui/PhotoLightbox'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHECKLIST = [
  'No leaking fluids',
  'No exposed sharp objects',
  'No hazardous chemicals',
  'No pressure buildup',
  'No batteries mixed improperly',
  'No heat detected',
  'No blocked loading area',
  'No biological material',
  'No living organisms',
]

// ── Types ─────────────────────────────────────────────────────────────────────

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'reinspection_required' | 'escalated'
type ReviewAction = Exclude<ReviewStatus, 'pending'>
type ResultFilter = 'all' | 'flag' | 'fail'
type ReviewFilter = 'all' | 'pending' | 'reviewed'
type ViewMode    = 'review' | 'history'

function isPendingReview(status: ReviewStatus | null): boolean {
  return status === null || status === 'pending'
}

interface AIAnalysis {
  risk_level:             'low' | 'medium' | 'high' | 'critical'
  safety_flags:           string[]
  recyclable_items:       string[]
  contamination_detected: boolean
  contamination_details:  string
  confidence:             number
  recommendation:         'approve' | 'reinspect' | 'reject' | 'escalate'
  summary:                string
  analyzed_at:            string
  model:                  string
}

interface InspectionRow {
  id: string
  pickup_id: string
  driver_id: string
  checklist_results: Record<string, boolean> | null
  overall_result: 'flag' | 'fail'
  notes: string | null
  photo_url: string | null
  created_at: string
  review_status: ReviewStatus | null
  reviewed_by: string | null
  reviewed_at: string | null
  admin_notes: string | null
  is_reinspection: boolean
  ai_analysis:            AIAnalysis | null
  ai_result:              string | null
  ai_confidence:          number | null
  ai_notes:               string | null
  ai_reviewed_at:         string | null
  driver_override:        boolean | null
  driver_override_reason: string | null
  commercial_pickups: {
    status: string
    account_id: string
    business_name: string | null
    commercial_accounts: { business_name: string; user_id: string | null } | null
  } | null
  profiles: { full_name: string | null } | null
}

interface HistoryInspection extends Omit<InspectionRow, 'overall_result'> {
  overall_result: 'pass' | 'flag' | 'fail'
  parent_inspection_id: string | null
}

const NOTIF_COPY: Record<ReviewAction, { title: string; body: string }> = {
  approved: {
    title: 'Yellow inspection approved',
    body:  'Your commercial pickup inspection was approved and may continue.',
  },
  rejected: {
    title: 'Pickup rejected after inspection review',
    body:  'This commercial pickup was rejected after safety review. Please contact support.',
  },
  reinspection_required: {
    title: 'Reinspection required',
    body:  'A reinspection is required before this commercial pickup can continue.',
  },
  escalated: {
    title: 'Safety emergency escalation',
    body:  'This pickup has been escalated as a safety emergency. Await admin clearance before proceeding.',
  },
}

// Pickup status each action sets
const PICKUP_STATUS: Record<ReviewAction, string> = {
  approved:              'in_progress',
  rejected:              'flagged',
  reinspection_required: 'in_review',
  escalated:             'flagged',
}

// Route stop status each action sets
const STOP_STATUS: Record<ReviewAction, string> = {
  approved:              'inspection_complete',
  rejected:              'flagged',
  reinspection_required: 'inspection',
  escalated:             'flagged',
}

const ACTION_PRIORITY: Record<ReviewAction, NotificationPriority> = {
  approved:              'success',
  rejected:              'critical',
  reinspection_required: 'warning',
  escalated:             'critical',
}

const EVENT_TYPE: Record<ReviewAction, NotificationEventType> = {
  approved:              'inspection_approved',
  rejected:              'inspection_rejected',
  reinspection_required: 'inspection_reinspection_required',
  escalated:             'inspection_escalated',
}

const DRIVER_NOTIF: Record<ReviewAction, { title: string; message: (b: string) => string }> = {
  approved: {
    title:   'Inspection Approved',
    message: b => `Yellow inspection at ${b} was approved — you may complete this stop.`,
  },
  rejected: {
    title:   'Pickup Rejected',
    message: b => `Pickup at ${b} was rejected after safety review. Stop is locked — contact dispatch.`,
  },
  reinspection_required: {
    title:   'Reinspection Required',
    message: b => `Reinspection required at ${b} before this pickup can continue.`,
  },
  escalated: {
    title:   'Stop Escalated',
    message: b => `Pickup at ${b} has been escalated as a critical safety concern. Await admin clearance.`,
  },
}

const ADMIN_LOG_NOTIF: Record<ReviewAction, { title: string; message: (b: string) => string }> = {
  approved: {
    title:   'Inspection Approved',
    message: b => `Admin approved the yellow inspection at ${b}. Driver may proceed.`,
  },
  rejected: {
    title:   'Pickup Rejected',
    message: b => `Admin rejected the pickup at ${b} after safety review.`,
  },
  reinspection_required: {
    title:   'Reinspection Requested',
    message: b => `Admin requested reinspection at ${b}. Driver notified.`,
  },
  escalated: {
    title:   'Emergency Escalated',
    message: b => `Pickup at ${b} has been escalated as a safety emergency.`,
  },
}

const WAREHOUSE_NOTIF: Record<ReviewAction, { title: string; message: (b: string) => string } | null> = {
  approved:              null,
  reinspection_required: null,
  rejected: {
    title:   'Load Rejected',
    message: b => `Commercial pickup at ${b} was rejected — do not accept this load.`,
  },
  escalated: {
    title:   'Safety Emergency',
    message: b => `Pickup at ${b} was escalated as a safety emergency. Flag the load on arrival.`,
  },
}

// ── Push helper ───────────────────────────────────────────────────────────────

interface PushPayload {
  user_id:           string
  title:             string
  body:              string
  notification_type: string
  priority?:         string
  data?:             Record<string, unknown>
}

async function sendPush(payload: PushPayload): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', { body: payload })
    if (error) { console.error('[push] inspection', error.message); return false }
    return true
  } catch (e) {
    console.error('[push] inspection', e)
    return false
  }
}

const PUSH_NOTIF_TYPE: Record<ReviewAction, string> = {
  approved:              'inspection',
  rejected:              'inspection',
  reinspection_required: 'inspection',
  escalated:             'emergency',
}

const PUSH_PRIORITY: Record<ReviewAction, string> = {
  approved:              'default',
  rejected:              'default',
  reinspection_required: 'default',
  escalated:             'critical',
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AIAnalysisPanelProps {
  analysis: AIAnalysis | null
  isAnalyzing: boolean
  onAnalyze: () => void
  hasPhoto: boolean
}

function AIAnalysisPanel({ analysis, isAnalyzing, onAnalyze, hasPhoto }: AIAnalysisPanelProps) {
  const RISK_COLOR: Record<string, string> = {
    low:      '#4ade80',
    medium:   '#fbbf24',
    high:     '#f97316',
    critical: '#f87171',
  }
  const REC_COLOR: Record<string, string> = {
    approve:   '#4ade80',
    reinspect: '#fbbf24',
    reject:    '#f87171',
    escalate:  '#f87171',
  }
  const REC_LABEL: Record<string, string> = {
    approve:   '✓ Approve',
    reinspect: '🔄 Reinspect',
    reject:    '✗ Reject',
    escalate:  '🚨 Escalate',
  }

  const riskColor   = analysis ? (RISK_COLOR[analysis.risk_level] ?? '#00c8ff') : '#00c8ff'
  const panelBg     = analysis ? `${riskColor}0d` : 'rgba(255,255,255,0.02)'
  const panelBorder = analysis ? `1px solid ${riskColor}30` : '1px solid rgba(255,255,255,0.07)'

  return (
    <div className="mb-3">
      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        AI Analysis
      </p>
      <div style={{ borderRadius: 12, padding: '10px 12px', background: panelBg, border: panelBorder }}>

        {isAnalyzing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(0,200,255,0.25)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Analyzing photo with AI…</p>
          </div>
        )}

        {!isAnalyzing && !analysis && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              {hasPhoto ? 'No AI analysis yet' : 'No photo to analyze'}
            </p>
            {hasPhoto && (
              <button
                onClick={onAnalyze}
                style={{
                  background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)',
                  borderRadius: 8, padding: '4px 10px',
                  color: '#00c8ff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}
              >
                Analyze
              </button>
            )}
          </div>
        )}

        {!isAnalyzing && analysis && (
          <>
            {/* Risk · Recommendation · Confidence */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: riskColor,
                background: `${riskColor}1a`, borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase',
              }}>
                {analysis.risk_level} risk
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color:      REC_COLOR[analysis.recommendation] ?? '#fbbf24',
                background: `${REC_COLOR[analysis.recommendation] ?? '#fbbf24'}1a`,
                borderRadius: 999, padding: '2px 8px',
              }}>
                {REC_LABEL[analysis.recommendation] ?? analysis.recommendation}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                {analysis.confidence}% confident
              </span>
            </div>

            {/* Summary */}
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: (analysis.safety_flags.length || analysis.recyclable_items.length) ? 8 : 0 }}>
              {analysis.summary}
            </p>

            {/* Safety flags */}
            {analysis.safety_flags.length > 0 && (
              <div style={{ marginBottom: analysis.recyclable_items.length ? 6 : 0 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Safety Flags
                </p>
                {analysis.safety_flags.map((flag, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: '#f87171', flexShrink: 0 }}>!</span>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{flag}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recyclable items */}
            {analysis.recyclable_items.length > 0 && (
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Recyclables Detected
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  {analysis.recyclable_items.join(', ')}
                </p>
              </div>
            )}

            {/* Timestamp + Re-analyze */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>
                {new Date(analysis.analyzed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
              <button
                onClick={onAnalyze}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '2px 8px',
                  color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer',
                }}
              >
                Re-analyze
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// Returns numeric priority so urgent items sort first (higher = more urgent)
function reviewPriority(insp: InspectionRow): number {
  const lowConf = insp.ai_confidence != null && insp.ai_confidence < 60
  const aiRed   = insp.ai_result === 'Red'
  if (aiRed && insp.driver_override) return 4   // AI=Red + driver override → critical
  if (lowConf)                        return 3   // Low confidence → manual review required
  if (insp.driver_override)           return 2   // Any override
  if (insp.is_reinspection && isPendingReview(insp.review_status)) return 1
  return 0
}

function DriverAiComparisonPanel({ insp }: { insp: InspectionRow }) {
  if (!insp.ai_result && !insp.driver_override) return null

  const driverResult =
    insp.overall_result === 'fail' ? 'Red' :
    insp.overall_result === 'flag' ? 'Yellow' : 'Green'
  const driverColor  = driverResult === 'Green' ? '#4ade80' : driverResult === 'Yellow' ? '#fbbf24' : '#f87171'
  const driverIcon   = driverResult === 'Green' ? '🟢' : driverResult === 'Yellow' ? '🟡' : '🔴'
  const aiColor      = !insp.ai_result ? 'rgba(255,255,255,0.3)' : insp.ai_result === 'Green' ? '#4ade80' : insp.ai_result === 'Yellow' ? '#fbbf24' : '#f87171'
  const aiIcon       = !insp.ai_result ? '—' : insp.ai_result === 'Green' ? '🟢' : insp.ai_result === 'Yellow' ? '🟡' : '🔴'
  const lowConf      = insp.ai_confidence != null && insp.ai_confidence < 60

  return (
    <div className="mb-3">
      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        AI vs Driver
      </p>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>

        {/* Side-by-side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: '8px 10px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>AI Result</p>
            {insp.ai_result ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 800, color: aiColor }}>{aiIcon} {insp.ai_result}</p>
                {insp.ai_confidence != null && (
                  <p style={{ fontSize: 9, marginTop: 2, fontWeight: lowConf ? 700 : 400, color: lowConf ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
                    {insp.ai_confidence}% conf{lowConf ? ' ⚠️' : ''}
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>No scan</p>
            )}
          </div>
          <div style={{ padding: '8px 10px' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Driver Result</p>
            <p style={{ fontSize: 12, fontWeight: 800, color: driverColor }}>{driverIcon} {driverResult}</p>
            {insp.driver_override && (
              <p style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700, marginTop: 2 }}>Override ⚠️</p>
            )}
          </div>
        </div>

        {/* Override banner */}
        {insp.driver_override && (
          <div style={{ padding: '6px 10px', background: 'rgba(251,191,36,0.07)', borderTop: '1px solid rgba(251,191,36,0.18)' }}>
            <p style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, marginBottom: insp.driver_override_reason ? 3 : 0 }}>
              ⚠️ Driver overrode AI recommendation
            </p>
            {insp.driver_override_reason && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>"{insp.driver_override_reason}"</p>
            )}
          </div>
        )}

        {/* Low confidence (only if no override banner) */}
        {!insp.driver_override && lowConf && (
          <div style={{ padding: '6px 10px', background: 'rgba(251,191,36,0.07)', borderTop: '1px solid rgba(251,191,36,0.18)' }}>
            <p style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>
              ⚠️ Low AI confidence — manual review recommended
            </p>
          </div>
        )}

        {/* AI notes */}
        {insp.ai_notes && (
          <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{insp.ai_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface CardProps {
  insp: InspectionRow
  adminNotes: string
  isActioning: boolean
  isLoadingPhoto: boolean
  isAnalyzing: boolean
  aiAnalysis: AIAnalysis | null
  onNotesChange: (notes: string) => void
  onAction: (action: ReviewAction) => void
  onOpenPhoto: () => void
  onAnalyze: () => void
}

function InspectionCard({
  insp,
  adminNotes,
  isActioning,
  isLoadingPhoto,
  isAnalyzing,
  aiAnalysis,
  onNotesChange,
  onAction,
  onOpenPhoto,
  onAnalyze,
}: CardProps) {
  const isRed = insp.overall_result === 'fail'
  const accentColor  = isRed ? '#f87171' : '#fbbf24'
  const accentBg     = isRed ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.07)'
  const accentBorder = isRed ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.25)'

  const results     = insp.checklist_results ?? {}
  const failedItems = CHECKLIST.filter(item => !results[item])
  const passedCount = CHECKLIST.length - failedItems.length

  const business = insp.commercial_pickups?.commercial_accounts?.business_name
    ?? insp.commercial_pickups?.business_name
    ?? 'Unknown Business'
  const driver = insp.profiles?.full_name ?? 'Unknown Driver'
  const date   = new Date(insp.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  const rs = insp.review_status
  const reviewBadge =
    isPendingReview(rs)
      ? { label: 'Pending Review',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' }
    : rs === 'approved'
      ? { label: '✓ Approved',      color: '#4ade80', bg: 'rgba(74,222,128,0.12)' }
    : rs === 'rejected'
      ? { label: 'Rejected',        color: '#f87171', bg: 'rgba(248,113,113,0.12)' }
    : rs === 'reinspection_required'
      ? { label: "Reinspect Req'd", color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' }
      : { label: '🚨 Escalated',    color: '#f87171', bg: 'rgba(248,113,113,0.12)' }

  return (
    <GlassCard padding="none" className="mb-3 overflow-hidden">
      {/* Severity stripe */}
      <div style={{ height: 3, background: accentColor, borderRadius: '16px 16px 0 0' }} />

      <div style={{ padding: '14px 16px' }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span style={{ fontSize: 18, flexShrink: 0 }}>{isRed ? '🔴' : '🟡'}</span>
            <div className="min-w-0">
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {business}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                {driver} · {date}
              </p>
              {insp.is_reinspection && (
                <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700, background: 'rgba(167,139,250,0.12)', borderRadius: 999, padding: '1px 6px', display: 'inline-block', marginTop: 3 }}>
                  ↩ Reinspection
                </span>
              )}
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: reviewBadge.bg, color: reviewBadge.color, whiteSpace: 'nowrap' }}
          >
            {reviewBadge.label}
          </span>
        </div>

        {/* Severity banner */}
        <div
          className="rounded-xl px-3 py-2 mb-3 flex items-center gap-2"
          style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
            {isRed ? '🚫 Safety Rejection' : '⚠️ Caution Report'}
          </p>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            {passedCount}/{CHECKLIST.length} checks passed
          </span>
        </div>

        {/* AI vs Driver comparison */}
        <DriverAiComparisonPanel insp={insp} />

        {/* Flagged checklist items */}
        {failedItems.length > 0 && (
          <div className="mb-3">
            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Flagged Items
            </p>
            <div className="flex flex-col gap-1.5">
              {failedItems.map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span style={{ fontSize: 10, color: '#f87171', flexShrink: 0 }}>✗</span>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Driver notes */}
        {insp.notes && (
          <div className="mb-3">
            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              Driver Notes
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
              {insp.notes}
            </p>
          </div>
        )}

        {/* Photo thumbnail / no-photo */}
        <button
          onClick={onOpenPhoto}
          disabled={isLoadingPhoto}
          className="w-full rounded-xl mb-3 overflow-hidden transition-all hover:brightness-110 disabled:opacity-60"
          style={{
            background: insp.photo_url ? 'rgba(0,200,255,0.04)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${insp.photo_url ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: insp.photo_url ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${insp.photo_url ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              {isLoadingPhoto
                ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,200,255,0.3)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite' }} />
                : '📷'}
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, color: insp.photo_url ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}>
                {isLoadingPhoto ? 'Loading photo…' : insp.photo_url ? 'View Evidence Photo' : 'No inspection photo uploaded'}
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {insp.photo_url ? 'Tap to review image + safety checklist' : 'Review checklist and notes to action'}
              </p>
            </div>
          </div>
        </button>

        {/* AI Analysis */}
        <AIAnalysisPanel
          analysis={aiAnalysis}
          isAnalyzing={isAnalyzing}
          onAnalyze={onAnalyze}
          hasPhoto={!!insp.photo_url}
        />

        {/* Previous review info */}
        {!isPendingReview(rs) && (
          <>
            {insp.admin_notes && (
              <div className="mb-2">
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                  Previous Admin Notes
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                  {insp.admin_notes}
                </p>
              </div>
            )}
            {insp.reviewed_at && (
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginBottom: 10 }}>
                Reviewed {new Date(insp.reviewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </>
        )}

        {/* Admin action section */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            {!isPendingReview(rs) ? 'Update Decision' : 'Admin Review'}
          </p>

          <textarea
            value={adminNotes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder={isRed ? 'Admin notes (required to reject, reinspect, or escalate)…' : 'Admin notes — required to reinspect or reject, optional to approve…'}
            rows={2}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 12, outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
              marginBottom: 10,
            }}
          />

          <div className="grid grid-cols-3 gap-2">
            {/* Approve Yellow — shown only for yellow (flag) inspections */}
            {!isRed && (
              <PrimaryButton
                size="sm" fullWidth
                disabled={isActioning}
                onClick={() => onAction('approved')}
              >
                ✓ Approve
              </PrimaryButton>
            )}
            <PrimaryButton
              size="sm" fullWidth variant="secondary"
              disabled={isActioning}
              onClick={() => onAction('reinspection_required')}
            >
              🔄 Reinspect
            </PrimaryButton>
            <PrimaryButton
              size="sm" fullWidth variant="secondary"
              disabled={isActioning}
              onClick={() => onAction('rejected')}
            >
              ✗ Reject
            </PrimaryButton>
            {/* Escalate Emergency — shown only for red (fail) inspections */}
            {isRed && (
              <button
                onClick={() => onAction('escalated')}
                disabled={isActioning}
                className="w-full rounded-2xl py-2 text-sm font-bold transition-all hover:brightness-110 disabled:opacity-40"
                style={{
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  color: '#f87171',
                  cursor: isActioning ? 'not-allowed' : 'pointer',
                }}
              >
                🚨 Escalate
              </button>
            )}
          </div>

          {isActioning && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>
              Saving…
            </p>
          )}
        </div>

      </div>
    </GlassCard>
  )
}

// ── Photo Review Modal ────────────────────────────────────────────────────────

interface PhotoModalProps {
  insp: InspectionRow
  photoState: 'idle' | 'loading' | 'loaded' | 'error'
  signedUrl: string | null
  adminNotes: string
  isActioning: boolean
  isAnalyzing: boolean
  aiAnalysis: AIAnalysis | null
  onNotesChange: (notes: string) => void
  onAction: (action: ReviewAction) => void
  onClose: () => void
  onZoom: (url: string) => void
  onAnalyze: () => void
}

function PhotoReviewModal({
  insp, photoState, signedUrl, adminNotes, isActioning,
  isAnalyzing, aiAnalysis,
  onNotesChange, onAction, onClose, onZoom, onAnalyze,
}: PhotoModalProps) {
  const isRed      = insp.overall_result === 'fail'
  const accentColor = isRed ? '#f87171' : '#fbbf24'
  const business    = insp.commercial_pickups?.commercial_accounts?.business_name
    ?? insp.commercial_pickups?.business_name ?? 'Unknown Business'
  const driver = insp.profiles?.full_name ?? 'Unknown Driver'
  const date   = new Date(insp.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const results = insp.checklist_results ?? {}
  const failedItems = CHECKLIST.filter(item => !results[item])
  const rs = insp.review_status
  const hasHadReview = !isPendingReview(rs)
  const decisionColor = rs === 'approved' ? '#4ade80' : rs === 'reinspection_required' ? '#fbbf24' : '#f87171'
  const decisionLabel =
    rs === 'approved'              ? '✓ Approved' :
    rs === 'rejected'              ? '✗ Rejected' :
    rs === 'reinspection_required' ? '🔄 Reinspect Requested' :
    rs === 'escalated'             ? '🚨 Escalated' : ''

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Bottom sheet — scrollable */}
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div
          style={{
            position: 'relative', zIndex: 1,
            background: 'linear-gradient(180deg, #0a1530 0%, #060e24 100%)',
            borderRadius: '24px 24px 0 0',
            border: '1px solid rgba(255,255,255,0.09)',
            borderBottom: 'none',
            maxWidth: 640, width: '100%', margin: '0 auto',
            paddingBottom: 40,
          }}
        >
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14, paddingBottom: 2 }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.14)' }} />
          </div>

          {/* Close + title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 12px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Photo Review</p>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)', borderRadius: 999, width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 18, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: '0 16px' }}>

            {/* Business + result */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{isRed ? '🔴' : '🟡'}</span>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{business}</p>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{driver} · {date}</p>
              {insp.is_reinspection && (
                <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700, background: 'rgba(167,139,250,0.12)', borderRadius: 999, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>
                  ↩ Reinspection
                </span>
              )}
            </div>

            {/* Photo area */}
            <div style={{
              borderRadius: 16, overflow: 'hidden', marginBottom: 14,
              background: 'rgba(0,0,0,0.4)', border: `1px solid ${accentColor}33`,
              minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {photoState === 'loading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 28 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid rgba(0,200,255,0.25)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading photo…</p>
                </div>
              )}
              {photoState === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 28 }}>
                  <span style={{ fontSize: 28 }}>⚠️</span>
                  <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, textAlign: 'center' }}>Photo unavailable</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 220 }}>
                    Storage access denied or image was removed. Review checklist and notes below.
                  </p>
                </div>
              )}
              {photoState === 'loaded' && signedUrl && (
                <div style={{ position: 'relative', width: '100%' }}>
                  <img
                    src={signedUrl}
                    alt="Inspection evidence"
                    style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }}
                  />
                  <button
                    onClick={() => onZoom(signedUrl)}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 8, padding: '4px 10px', color: '#fff',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ⛶ Zoom
                  </button>
                </div>
              )}
              {photoState === 'loaded' && !signedUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 28, opacity: 0.45 }}>
                  <span style={{ fontSize: 28 }}>📷</span>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>No inspection photo uploaded</p>
                </div>
              )}
            </div>

            {/* Severity bar */}
            <div style={{
              borderRadius: 12, padding: '8px 12px', marginBottom: 14,
              background: isRed ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.07)',
              border: `1px solid ${isRed ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.25)'}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
                {isRed ? '🚫 Safety Rejection' : '⚠️ Caution Report'}
              </p>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                {CHECKLIST.length - failedItems.length}/{CHECKLIST.length} passed
              </span>
            </div>

            {/* AI vs Driver comparison */}
            <div style={{ marginBottom: 14 }}>
              <DriverAiComparisonPanel insp={insp} />
            </div>

            {/* AI Analysis */}
            <div style={{ marginBottom: 14 }}>
              <AIAnalysisPanel
                analysis={aiAnalysis}
                isAnalyzing={isAnalyzing}
                onAnalyze={onAnalyze}
                hasPhoto={!!insp.photo_url}
              />
            </div>

            {/* Driver notes */}
            {insp.notes && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Driver Notes
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                  {insp.notes}
                </p>
              </div>
            )}

            {/* Safety checklist — all items, flagged red / safe green */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Safety Checklist
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {CHECKLIST.map(item => {
                  const passed = results[item] === true
                  return (
                    <div
                      key={item}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 8,
                        background: passed ? 'rgba(74,222,128,0.05)' : 'rgba(248,113,113,0.08)',
                        border: `1px solid ${passed ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.2)'}`,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 800, color: passed ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                        {passed ? '✓' : '✗'}
                      </span>
                      <p style={{ fontSize: 11, color: passed ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)', fontWeight: passed ? 400 : 600 }}>
                        {item}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Previous decision (if already reviewed) */}
            {hasHadReview && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                  Previous Decision
                </p>
                <p style={{ fontSize: 12, fontWeight: 700, color: decisionColor }}>{decisionLabel}</p>
                {insp.admin_notes && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginTop: 4 }}>"{insp.admin_notes}"</p>
                )}
                {insp.reviewed_at && (
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>
                    {new Date(insp.reviewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )}

            {/* Admin action */}
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {hasHadReview ? 'Update Decision' : 'Admin Review'}
              </p>
              <textarea
                value={adminNotes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder={isRed ? 'Admin notes (required to reject, reinspect, or escalate)…' : 'Admin notes — required to reinspect or reject, optional to approve…'}
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 12, outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5, marginBottom: 10,
                }}
              />
              {!isRed && (
                <div style={{ marginBottom: 8 }}>
                  <PrimaryButton fullWidth size="md" disabled={isActioning} onClick={() => onAction('approved')}>
                    ✓ Approve Inspection
                  </PrimaryButton>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: isRed ? 8 : 0 }}>
                <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isActioning} onClick={() => onAction('reinspection_required')}>
                  🔄 Reinspect
                </PrimaryButton>
                <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isActioning} onClick={() => onAction('rejected')}>
                  ✗ Reject
                </PrimaryButton>
              </div>
              {isRed && (
                <button
                  onClick={() => onAction('escalated')}
                  disabled={isActioning}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 16, marginTop: 0,
                    background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)',
                    color: '#f87171', fontSize: 13, fontWeight: 700,
                    cursor: isActioning ? 'not-allowed' : 'pointer',
                  }}
                >
                  🚨 Escalate Emergency
                </button>
              )}
              {isActioning && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 10 }}>Saving…</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminCommercialInspectionReview() {
  const navigate       = useNavigate()
  const location       = useLocation()
  const { user }       = useAuthStore()
  const addNotification = useNotificationStore(s => s.addNotification)

  const [inspections,    setInspections]    = useState<InspectionRow[]>([])
  const [loading,        setLoading]        = useState(true)
  const [filterResult,   setFilterResult]   = useState<ResultFilter>('all')
  const [filterReview,   setFilterReview]   = useState<ReviewFilter>('pending')
  const [actioningId,    setActioningId]    = useState<string | null>(null)
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null)
  const [adminNotesMap,  setAdminNotesMap]  = useState<Record<string, string>>({})
  const [lightboxUrls,   setLightboxUrls]   = useState<string[] | null>(null)
  const [toast,          setToast]          = useState<string | null>(null)
  const [showNotif,      setShowNotif]      = useState(false)
  const [syncStatus,     setSyncStatus]     = useState<'connecting' | 'active' | 'offline'>('connecting')
  const [viewMode,         setViewMode]         = useState<ViewMode>('review')
  const [historyItems,     setHistoryItems]     = useState<HistoryInspection[]>([])
  const [historyLoading,   setHistoryLoading]   = useState(false)
  const [photoModal,       setPhotoModal]       = useState<InspectionRow | null>(null)
  const [photoModalUrl,    setPhotoModalUrl]    = useState<string | null>(null)
  const [photoModalState,  setPhotoModalState]  = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [analyzingId,      setAnalyzingId]      = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadInspections = useCallback(async () => {
    const { data, error } = await supabase
      .from('commercial_inspections')
      .select(`
        id, pickup_id, driver_id, checklist_results, overall_result, notes, photo_url, created_at,
        review_status, reviewed_by, reviewed_at, admin_notes, is_reinspection,
        ai_analysis, ai_result, ai_confidence, ai_notes, ai_reviewed_at,
        driver_override, driver_override_reason,
        commercial_pickups!pickup_id ( status, account_id, business_name,
          commercial_accounts!account_id ( business_name, user_id )
        ),
        profiles!driver_id ( full_name )
      `)
      .in('overall_result', ['flag', 'fail'])
      .order('created_at', { ascending: false })

    if (error) { showToast('Failed to load inspections'); setLoading(false); return }

    const rows = (data ?? []) as unknown as InspectionRow[]
    setInspections(rows)
    setLoading(false)

    // Seed admin notes only for inspections we haven't edited locally yet
    setAdminNotesMap(prev => {
      const next = { ...prev }
      for (const r of rows) {
        if (!(r.id in next)) next[r.id] = r.admin_notes ?? ''
      }
      return next
    })
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('commercial_inspections')
      .select(`
        id, pickup_id, driver_id, checklist_results, overall_result, notes, photo_url, created_at,
        review_status, reviewed_by, reviewed_at, admin_notes, is_reinspection, parent_inspection_id,
        ai_analysis, ai_result, ai_confidence, ai_notes, ai_reviewed_at,
        driver_override, driver_override_reason,
        commercial_pickups!pickup_id ( status, account_id, business_name,
          commercial_accounts!account_id ( business_name, user_id )
        ),
        profiles!driver_id ( full_name )
      `)
      .order('created_at', { ascending: true })
    setHistoryItems((data ?? []) as unknown as HistoryInspection[])
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    void loadInspections()
    const channel = supabase
      .channel('admin-comm-inspections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_inspections' }, () => { void loadInspections() })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [loadInspections])

  useEffect(() => {
    if (viewMode === 'history') void loadHistory()
  }, [viewMode, loadHistory])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function closePhotoModal() {
    setPhotoModal(null)
    setPhotoModalUrl(null)
    setPhotoModalState('idle')
  }

  async function analyzeInspection(insp: InspectionRow) {
    setAnalyzingId(insp.id)
    try {
      const { data, error } = await supabase.functions.invoke('analyze-commercial-inspection', {
        body: { inspection_id: insp.id },
      })
      if (error) throw new Error(error.message)

      const analysis = (data as { analysis: AIAnalysis } | null)?.analysis
      if (!analysis) throw new Error('No analysis returned from AI')

      setInspections(prev => prev.map(i => i.id === insp.id ? { ...i, ai_analysis: analysis } : i))
      setPhotoModal(prev => prev?.id === insp.id ? { ...prev, ai_analysis: analysis } : prev)
      showToast('AI analysis complete')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI analysis failed — try again')
    } finally {
      setAnalyzingId(null)
    }
  }

  async function openPhotoModal(insp: InspectionRow) {
    setPhotoModal(insp)
    if (!insp.photo_url) {
      setPhotoModalState('loaded')
      return
    }
    setPhotoModalState('loading')
    setLoadingPhotoId(insp.id)
    try {
      const { data, error } = await supabase.storage
        .from('commercial-inspection-photos')
        .createSignedUrl(insp.photo_url, 3600)
      if (error || !data) {
        setPhotoModalState('error')
      } else {
        setPhotoModalUrl(data.signedUrl)
        setPhotoModalState('loaded')
      }
    } catch {
      setPhotoModalState('error')
    } finally {
      setLoadingPhotoId(null)
    }
  }

  async function handleAction(insp: InspectionRow, action: ReviewAction) {
    const notes = adminNotesMap[insp.id] ?? ''

    // Notes required for reject, reinspect, escalate
    if (['rejected', 'reinspection_required', 'escalated'].includes(action) && !notes.trim()) {
      const verb = action === 'rejected' ? 'reject' : action === 'reinspection_required' ? 'request reinspection' : 'escalate'
      showToast(`Admin notes are required to ${verb} a pickup`)
      return
    }

    if (!insp.pickup_id) {
      showToast('Missing pickup reference — cannot action this inspection')
      return
    }

    setActioningId(insp.id)
    try {
      // 1. Update inspection review fields
      const { error: inspErr } = await supabase
        .from('commercial_inspections')
        .update({
          review_status: action,
          reviewed_by:   user?.id,
          reviewed_at:   new Date().toISOString(),
          admin_notes:   notes.trim() || null,
        })
        .eq('id', insp.id)

      if (inspErr) throw new Error(`Inspection update failed: ${inspErr.message}`)

      // 2. Update pickup status
      const { error: pickupErr } = await supabase
        .from('commercial_pickups')
        .update({ status: PICKUP_STATUS[action] })
        .eq('id', insp.pickup_id)

      if (pickupErr) throw new Error(`Pickup update failed: ${pickupErr.message}`)

      // 3. Update route stop status (best-effort — stop row may not exist in all flows)
      const { error: stopErr } = await supabase
        .from('commercial_route_stops')
        .update({ status: STOP_STATUS[action] })
        .eq('pickup_id', insp.pickup_id)

      if (stopErr) {
        // Non-fatal: log but don't block the action
        console.warn('Route stop update skipped:', stopErr.message)
      }

      // 4. Notify the commercial account
      const accountId = insp.commercial_pickups?.account_id
      if (accountId) {
        void supabase.from('commercial_notifications').insert({
          account_id: accountId,
          type:       action === 'escalated' ? 'commercial_inspection_emergency' : `inspection_${action}`,
          title:      NOTIF_COPY[action].title,
          body:       NOTIF_COPY[action].body,
        })
      }

      // 5. In-app notifications (driver, admin, warehouse)
      const business = insp.commercial_pickups?.commercial_accounts?.business_name
        ?? insp.commercial_pickups?.business_name
        ?? 'this location'
      const priority  = ACTION_PRIORITY[action]
      const eventType = EVENT_TYPE[action]

      addNotification({ type: eventType, title: DRIVER_NOTIF[action].title,    message: DRIVER_NOTIF[action].message(business),    priority, relatedRole: 'driver' })
      addNotification({ type: eventType, title: ADMIN_LOG_NOTIF[action].title, message: ADMIN_LOG_NOTIF[action].message(business), priority, relatedRole: 'admin' })

      const warehouseNotif = WAREHOUSE_NOTIF[action]
      if (warehouseNotif) {
        addNotification({ type: eventType, title: warehouseNotif.title, message: warehouseNotif.message(business), priority, relatedRole: 'warehouse' })
      }

      // 6. Persist driver notification to Supabase so it survives across sessions
      void supabase.from('commercial_notifications').insert({
        account_id: accountId ?? null,
        driver_id:  insp.driver_id,
        pickup_id:  insp.pickup_id,
        type:       eventType,
        title:      DRIVER_NOTIF[action].title,
        body:       DRIVER_NOTIF[action].message(business),
        priority,
      })

      // 7. Push driver — commercial user push handled by trg_push_commercial_notification
      //    (fires on the commercial_notifications insert in step 4 above)
      const driverTarget = action === 'reinspection_required'
        ? '/dashboard/driver/commercial-inspection'
        : '/dashboard/driver/commercial-pickups'

      const driverPushOk = await sendPush({
        user_id:           insp.driver_id,
        title:             DRIVER_NOTIF[action].title,
        body:              DRIVER_NOTIF[action].message(business),
        notification_type: PUSH_NOTIF_TYPE[action],
        priority:          PUSH_PRIORITY[action],
        data:              { target_route: driverTarget, target_id: insp.pickup_id },
      })

      const labels: Record<ReviewAction, string> = {
        approved:               '✓ Approved — driver can proceed',
        rejected:               'Pickup rejected',
        reinspection_required:  'Reinspection requested',
        escalated:              '🚨 Emergency escalated',
      }
      showToast(driverPushOk ? labels[action] : `${labels[action]} · Push notification failed`)

      // Close photo modal if actioning the currently open inspection
      if (photoModal?.id === insp.id) closePhotoModal()

      // Audit log (best-effort)
      void supabase.from('audit_logs').insert({
        user_id:      user?.id ?? null,
        action_type:  `inspection_${action}`,
        target_table: 'commercial_inspections',
        target_id:    insp.id,
        notes:        notes.trim() || null,
        metadata: {
          admin_notes:            notes.trim() || null,
          driver_result:          insp.overall_result,
          ai_result:              insp.ai_result ?? null,
          ai_confidence:          insp.ai_confidence ?? null,
          driver_override:        insp.driver_override ?? false,
          driver_override_reason: insp.driver_override_reason ?? null,
          admin_decision:         action,
          final_decision:         action,
        },
      })

      // Clear local notes so DB-saved value reloads fresh on next fetch
      setAdminNotesMap(prev => {
        const copy = { ...prev }
        delete copy[insp.id]
        return copy
      })
      void loadInspections()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed — check connection and retry')
    } finally {
      setActioningId(null)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = inspections
    .filter(insp => {
      if (filterResult !== 'all' && insp.overall_result !== filterResult) return false
      if (filterReview === 'pending'  && !isPendingReview(insp.review_status)) return false
      if (filterReview === 'reviewed' &&  isPendingReview(insp.review_status)) return false
      return true
    })
    .sort((a, b) => {
      // Pending first
      const aPending = isPendingReview(a.review_status)
      const bPending = isPendingReview(b.review_status)
      if (aPending !== bPending) return aPending ? -1 : 1
      // Within same review status: higher priority first
      return reviewPriority(b) - reviewPriority(a)
    })

  const pendingCount = inspections.filter(i => isPendingReview(i.review_status)).length

  const historyGroups = useMemo(() => {
    const map = new Map<string, { pickupId: string; business: string; items: HistoryInspection[] }>()
    for (const item of historyItems) {
      const existing = map.get(item.pickup_id)
      if (existing) {
        existing.items.push(item)
      } else {
        const business = item.commercial_pickups?.commercial_accounts?.business_name
          ?? item.commercial_pickups?.business_name ?? 'Unknown Business'
        map.set(item.pickup_id, { pickupId: item.pickup_id, business, items: [item] })
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aT = new Date(a.items[a.items.length - 1].created_at).getTime()
      const bT = new Date(b.items[b.items.length - 1].created_at).getTime()
      return bT - aT
    })
  }, [historyItems])

  const reinspNums = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of historyGroups) {
      let c = 0
      for (const insp of g.items) {
        if (insp.is_reinspection) { c++; m.set(insp.id, c) }
      }
    }
    return m
  }, [historyGroups])

  const navItems: BottomNavItem[] = [
    { label: 'Overview',    icon: <span style={{ fontSize: 18 }}>🏢</span>, active: false,                                                                     onClick: () => navigate('/dashboard/admin/commercial')             },
    { label: 'Accounts',   icon: <span style={{ fontSize: 18 }}>👥</span>, active: false,                                                                     onClick: () => navigate('/dashboard/admin/commercial/accounts')    },
    { label: 'Pickups',    icon: <span style={{ fontSize: 18 }}>🚛</span>, active: false,                                                                     onClick: () => navigate('/dashboard/admin/commercial/pickups')     },
    { label: 'Alerts',     icon: <span style={{ fontSize: 18 }}>🔔</span>, active: false,                                                                     onClick: () => navigate('/dashboard/admin/commercial/alerts')      },
    { label: 'Inspections',icon: <span style={{ fontSize: 18 }}>🔍</span>, active: location.pathname === '/dashboard/admin/commercial/inspections', badge: pendingCount || undefined, onClick: () => navigate('/dashboard/admin/commercial/inspections') },
    { label: 'Reports',    icon: <span style={{ fontSize: 18 }}>📊</span>, active: false,                                                                     onClick: () => navigate('/dashboard/admin/commercial/reports')     },
    { label: 'Dispatch',   icon: <span style={{ fontSize: 18 }}>🗺️</span>, active: false,                                                                     onClick: () => navigate('/dashboard/admin/commercial/dispatch')    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate('/dashboard/admin/commercial')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Commercial
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Inspection Review
        </span>
        <NotificationBell role="admin" onClick={() => setShowNotif(true)} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 max-w-2xl mx-auto w-full">

        {/* Sync status */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 12 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: 'Pending Review',    value: pendingCount,                                                                              color: '#fbbf24' },
            { label: 'Reinspections',     value: inspections.filter(i => i.is_reinspection && isPendingReview(i.review_status)).length,    color: '#a78bfa' },
            { label: 'Yellow (Caution)',  value: inspections.filter(i => i.overall_result === 'flag').length,                              color: '#fbbf24' },
            { label: 'Red (Rejected)',    value: inspections.filter(i => i.overall_result === 'fail').length,                              color: '#f87171' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4, lineHeight: 1.3 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {(['review', 'history'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="flex-1 rounded-xl py-2 text-xs font-bold transition-all"
              style={{
                background: viewMode === mode ? 'rgba(0,200,255,0.15)' : 'transparent',
                border:     viewMode === mode ? '1px solid rgba(0,200,255,0.3)' : '1px solid transparent',
                color:      viewMode === mode ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
              }}
            >
              {mode === 'review' ? '📋 Review Queue' : '📜 Audit History'}
            </button>
          ))}
        </div>

        {/* Filters — review mode only */}
        {viewMode === 'review' && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(['all', 'flag', 'fail'] as ResultFilter[]).map(f => {
            const labels: Record<ResultFilter, string> = { all: 'All Types', flag: '🟡 Yellow', fail: '🔴 Red' }
            return (
              <button
                key={f}
                onClick={() => setFilterResult(f)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  background:  filterResult === f ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border:      filterResult === f ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  color:       filterResult === f ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                  cursor:      'pointer',
                }}
              >
                {labels[f]}
              </button>
            )
          })}

          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />

          {(['all', 'pending', 'reviewed'] as ReviewFilter[]).map(f => {
            const labels: Record<ReviewFilter, string> = { all: 'All Reviews', pending: '⏳ Pending', reviewed: '✓ Reviewed' }
            return (
              <button
                key={f}
                onClick={() => setFilterReview(f)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  background:  filterReview === f ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border:      filterReview === f ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  color:       filterReview === f ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                  cursor:      'pointer',
                }}
              >
                {labels[f]}
              </button>
            )
          })}
        </div>
        )} {/* end viewMode === 'review' filters */}

        {/* ── Review Queue ── */}
        {viewMode === 'review' && (
          loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map(i => (
                <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={filterReview === 'pending' ? 'No Pending Inspections' : 'No Inspections Found'}
              description={filterReview === 'pending' ? 'All flagged inspection reports have been reviewed.' : 'No inspection reports match the selected filters.'}
            />
          ) : (
            filtered.map(insp => (
              <InspectionCard
                key={insp.id}
                insp={insp}
                adminNotes={adminNotesMap[insp.id] ?? ''}
                isActioning={actioningId === insp.id}
                isLoadingPhoto={loadingPhotoId === insp.id}
                isAnalyzing={analyzingId === insp.id}
                aiAnalysis={insp.ai_analysis ?? null}
                onNotesChange={notes => setAdminNotesMap(prev => ({ ...prev, [insp.id]: notes }))}
                onAction={action => { void handleAction(insp, action) }}
                onOpenPhoto={() => { void openPhotoModal(insp) }}
                onAnalyze={() => { void analyzeInspection(insp) }}
              />
            ))
          )
        )}

        {/* ── Audit History ── */}
        {viewMode === 'history' && (
          historyLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Spinner size="lg" />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading inspection history…</p>
            </div>
          ) : historyGroups.length === 0 ? (
            <EmptyState
              icon="📜"
              title="No inspection history"
              description="Inspection history will appear here once pickups have been inspected."
              action={{ label: 'Refresh', onClick: loadHistory }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {historyGroups.length} pickup{historyGroups.length !== 1 ? 's' : ''} · {historyItems.length} inspection{historyItems.length !== 1 ? 's' : ''}
                </p>
                <PrimaryButton size="sm" variant="secondary" onClick={loadHistory}>
                  Refresh
                </PrimaryButton>
              </div>

              {historyGroups.map(group => {
                const latestInsp = group.items[group.items.length - 1]
                const pickupStatus = latestInsp.commercial_pickups?.status ?? 'unknown'
                const statusColor =
                  pickupStatus === 'completed' ? '#4ade80' :
                  pickupStatus === 'flagged'   ? '#f87171' :
                  pickupStatus === 'in_review' ? '#fbbf24' : '#00c8ff'

                return (
                  <GlassCard key={group.pickupId} padding="none" className="mb-3 overflow-hidden">

                    {/* Pickup header */}
                    <div
                      className="flex items-center justify-between px-4 py-3"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{group.business}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                          {group.items.length} inspection{group.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                        style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44`, whiteSpace: 'nowrap' }}
                      >
                        {pickupStatus.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Timeline */}
                    <div style={{ padding: '12px 16px' }}>
                      {group.items.map((insp, idx) => {
                        const isReinsp  = insp.is_reinspection
                        const reinspNum = reinspNums.get(insp.id)
                        const label     = isReinsp && reinspNum != null ? `Reinspection #${reinspNum}` : 'Original Inspection'
                        const resultColor =
                          insp.overall_result === 'fail' ? '#f87171' :
                          insp.overall_result === 'pass' ? '#4ade80' : '#fbbf24'
                        const resultLabel =
                          insp.overall_result === 'fail' ? 'Red' :
                          insp.overall_result === 'pass' ? 'Green' : 'Yellow'
                        const dotChar =
                          insp.overall_result === 'fail' ? '✗' :
                          insp.overall_result === 'pass' ? '✓' : '!'
                        const date    = new Date(insp.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                        const driver  = insp.profiles?.full_name ?? 'Driver'
                        const rs      = insp.review_status
                        const isLast  = idx === group.items.length - 1

                        const decisionColor =
                          rs === 'approved'              ? '#4ade80' :
                          rs === 'reinspection_required' ? '#fbbf24' : '#f87171'
                        const decisionLabel =
                          rs === 'approved'              ? '✓ Approved' :
                          rs === 'rejected'              ? '✗ Rejected' :
                          rs === 'reinspection_required' ? '🔄 Reinspect Requested' :
                          rs === 'escalated'             ? '🚨 Escalated' : '⏳ Pending'

                        return (
                          <div key={insp.id} style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 18 }}>

                            {/* Rail */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: '50%',
                                background: `${resultColor}22`,
                                border: `1.5px solid ${resultColor}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 900, color: resultColor, flexShrink: 0,
                              }}>
                                {dotChar}
                              </div>
                              {!isLast && (
                                <div style={{ flex: 1, width: 1.5, background: 'rgba(255,255,255,0.07)', marginTop: 3 }} />
                              )}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{label}</span>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, color: resultColor,
                                  background: `${resultColor}18`, borderRadius: 999, padding: '1px 6px',
                                }}>
                                  {resultLabel}
                                </span>
                                {isReinsp && (
                                  <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700, background: 'rgba(167,139,250,0.12)', borderRadius: 999, padding: '1px 6px' }}>
                                    ↩
                                  </span>
                                )}
                              </div>

                              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: insp.notes ? 5 : 0 }}>
                                {driver} · {date}
                              </p>

                              {insp.notes && (
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 6, fontStyle: 'italic' }}>
                                  "{insp.notes}"
                                </p>
                              )}

                              {/* Admin decision block */}
                              {insp.reviewed_at && (
                                <div style={{
                                  padding: '8px 10px', borderRadius: 8,
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.07)',
                                  marginTop: 4,
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: insp.admin_notes ? 5 : 0 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: isPendingReview(rs) ? '#fbbf24' : decisionColor }}>
                                      {decisionLabel}
                                    </span>
                                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                                      {new Date(insp.reviewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  {insp.admin_notes && (
                                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                                      "{insp.admin_notes}"
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </GlassCard>
                )
              })}
            </>
          )
        )}
      </div>

      <BottomNav items={navItems} />

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
        >
          {toast}
        </div>
      )}

      {/* Spinner animation used in InspectionCard thumbnail */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Photo review modal */}
      {photoModal && (
        <PhotoReviewModal
          insp={photoModal}
          photoState={photoModalState}
          signedUrl={photoModalUrl}
          adminNotes={adminNotesMap[photoModal.id] ?? ''}
          isActioning={actioningId === photoModal.id}
          isAnalyzing={analyzingId === photoModal.id}
          aiAnalysis={photoModal.ai_analysis ?? null}
          onNotesChange={notes => setAdminNotesMap(prev => ({ ...prev, [photoModal.id]: notes }))}
          onAction={action => { void handleAction(photoModal, action) }}
          onClose={closePhotoModal}
          onZoom={url => setLightboxUrls([url])}
          onAnalyze={() => { void analyzeInspection(photoModal) }}
        />
      )}

      {lightboxUrls && (
        <PhotoLightbox photos={lightboxUrls} onClose={() => setLightboxUrls(null)} />
      )}

      {showNotif && <NotificationCenter role="admin" onClose={() => setShowNotif(false)} />}
    </div>
  )
}
