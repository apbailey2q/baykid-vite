import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'
import { Spinner } from '../../components/ui/Spinner'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'
import { MessagePanel } from '../../components/dispatch/MessagePanel'
import type { MsgType, MsgPriority } from '../../store/dispatchMessageStore'
import { MSG_TYPE_LABEL, MSG_PRIORITY_LABEL } from '../../store/dispatchMessageStore'
import { useNotificationStore } from '../../store/notificationStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type SupportStatus   = 'open' | 'in_review' | 'resolved' | 'escalated'
type SupportPriority = 'low' | 'normal' | 'high' | 'urgent'
type FilterMode      = 'all' | 'open' | 'in_review' | 'resolved' | 'escalated' | 'high_priority'
type ActionKind      = 'in_review' | 'resolve' | 'escalate'

interface SupportRequest {
  id:             string
  account_id:     string | null
  user_id:        string | null
  issue_type:     string
  priority:       SupportPriority
  message:        string
  status:         SupportStatus
  created_at:     string
  updated_at:     string
  related_pickup: string | null
  related_bin:    string | null
  business_name:  string
  admin_notes:    string | null
  resolved_by:    string | null
  resolved_at:    string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ISSUE_LABEL: Record<string, string> = {
  missed_pickup:         'Missed Pickup',
  overflow_issue:        'Overflow Issue',
  bin_container_issue:   'Bin / Container',
  invoice_question:      'Invoice Question',
  driver_arrival_issue:  'Driver Arrival',
  contamination_dispute: 'Contamination Dispute',
  general_support:       'General Support',
}

const ISSUE_ICON: Record<string, string> = {
  missed_pickup:         '📭',
  overflow_issue:        '⚠️',
  bin_container_issue:   '🗑️',
  invoice_question:      '🧾',
  driver_arrival_issue:  '🚛',
  contamination_dispute: '⚗️',
  general_support:       '💬',
}

const PRIORITY_COLOR: Record<SupportPriority, string> = {
  low: '#94a3b8', normal: '#00c8ff', high: '#fbbf24', urgent: '#f87171',
}

const PRIORITY_BG: Record<SupportPriority, string> = {
  low: 'rgba(148,163,184,0.1)', normal: 'rgba(0,200,255,0.1)',
  high: 'rgba(251,191,36,0.1)', urgent: 'rgba(248,113,113,0.12)',
}

const STATUS_BADGE: Record<SupportStatus, { variant: 'cyan' | 'amber' | 'green' | 'red'; label: string }> = {
  open:      { variant: 'cyan',  label: 'Open'      },
  in_review: { variant: 'amber', label: 'In Review' },
  resolved:  { variant: 'green', label: 'Resolved'  },
  escalated: { variant: 'red',   label: 'Escalated' },
}

const NOTIF_COPY: Record<ActionKind, { title: string; body: string }> = {
  in_review: {
    title: 'Support Request In Review',
    body:  'Your support request is being reviewed by our team. We will be in touch shortly.',
  },
  resolve: {
    title: 'Support Request Resolved',
    body:  'Your support request has been resolved. If you have further questions, please submit a new request.',
  },
  escalate: {
    title: 'Support Request Escalated',
    body:  'Your support request has been escalated for additional review. A senior team member will follow up with you.',
  },
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_REQUESTS: SupportRequest[] = [
  {
    id: 'demo-1', account_id: null, user_id: null,
    issue_type: 'missed_pickup', priority: 'high',
    message: 'Our Tuesday morning pickup was missed again. Bins are overflowing and we have a health code inspection tomorrow.',
    status: 'open', created_at: new Date(Date.now() - 3_600_000).toISOString(),
    updated_at: new Date(Date.now() - 3_600_000).toISOString(),
    related_pickup: null, related_bin: null, business_name: 'Acme Manufacturing',
    admin_notes: null, resolved_by: null, resolved_at: null,
  },
  {
    id: 'demo-2', account_id: null, user_id: null,
    issue_type: 'overflow_issue', priority: 'urgent',
    message: 'Back dock overflow bins are at capacity. Truck did not pick up the extra containers we called about last week.',
    status: 'in_review', created_at: new Date(Date.now() - 7_200_000).toISOString(),
    updated_at: new Date(Date.now() - 7_200_000).toISOString(),
    related_pickup: null, related_bin: 'BIN-201', business_name: 'Metro Office Park',
    admin_notes: 'Contacted route supervisor — rescheduling overflow pickup for Friday AM.', resolved_by: null, resolved_at: null,
  },
  {
    id: 'demo-3', account_id: null, user_id: null,
    issue_type: 'invoice_question', priority: 'normal',
    message: 'Invoice #1042 shows a line item for a weekend pickup we did not schedule. Please clarify or issue a credit.',
    status: 'open', created_at: new Date(Date.now() - 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 86_400_000).toISOString(),
    related_pickup: null, related_bin: null, business_name: 'Riverside Hotel',
    admin_notes: null, resolved_by: null, resolved_at: null,
  },
  {
    id: 'demo-4', account_id: null, user_id: null,
    issue_type: 'contamination_dispute', priority: 'high',
    message: 'We dispute the contamination flag on pickup PKP-0088. All cardboard was clean and dry — no food waste. Please review inspection photos.',
    status: 'escalated', created_at: new Date(Date.now() - 172_800_000).toISOString(),
    updated_at: new Date(Date.now() - 172_800_000).toISOString(),
    related_pickup: 'PKP-0088', related_bin: null, business_name: 'Downtown Grocers',
    admin_notes: 'Inspection photos reviewed. Flagging for senior review — photo evidence unclear.', resolved_by: null, resolved_at: null,
  },
  {
    id: 'demo-5', account_id: null, user_id: null,
    issue_type: 'driver_arrival_issue', priority: 'normal',
    message: 'Driver arrived 3 hours outside our scheduled window without any notice. Loading dock was locked and crew had left.',
    status: 'resolved', created_at: new Date(Date.now() - 259_200_000).toISOString(),
    updated_at: new Date(Date.now() - 200_000_000).toISOString(),
    related_pickup: 'PKP-0075', related_bin: null, business_name: 'Northside Medical Center',
    admin_notes: 'Apologized to customer. Routing team corrected the schedule window. No recurrence expected.',
    resolved_by: null, resolved_at: new Date(Date.now() - 200_000_000).toISOString(),
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const min = (now.getTime() - d.getTime()) / 60000
  if (min < 1)    return 'Just now'
  if (min < 60)   return `${Math.floor(min)}m ago`
  if (min < 1440) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const NOTES_INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: 12, lineHeight: 1.5, outline: 'none',
  resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box',
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminCommercialSupport() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, profile } = useAuthStore()
  const { addNotification } = useNotificationStore()

  const [requests,   setRequests]   = useState<SupportRequest[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [isDemo,     setIsDemo]     = useState(false)
  const [filter,     setFilter]     = useState<FilterMode>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [working,    setWorking]    = useState<string | null>(null)
  const [actionId,   setActionId]   = useState<string | null>(null)   // which card has inline action open
  const [actionKind, setActionKind] = useState<ActionKind | null>(null)
  const [actionNotes,setActionNotes]= useState('')
  const [actionErr,  setActionErr]  = useState<string | null>(null)
  const [toast,      setToast]      = useState<string | null>(null)
  const [showNotif,  setShowNotif]  = useState(false)
  const [msgTarget,  setMsgTarget]  = useState<SupportRequest | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from('commercial_support_requests')
      .select(`
        id, account_id, user_id, issue_type, priority, message, status,
        created_at, updated_at, related_pickup, related_bin,
        admin_notes, resolved_by, resolved_at,
        commercial_accounts ( business_name )
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      if (error.code === '42P01') { setRequests(DEMO_REQUESTS); setIsDemo(true) }
      else setLoadError(`Failed to load: ${error.message}`)
      setLoading(false)
      return
    }

    type SupportRaw = {
      id: string; account_id: string | null; user_id: string | null
      issue_type: string; priority: string; message: string; status: string
      created_at: string; updated_at: string
      related_pickup: string | null; related_bin: string | null
      admin_notes: string | null; resolved_by: string | null; resolved_at: string | null
      commercial_accounts: { business_name: string } | null
    }
    const rows = ((data ?? []) as unknown as SupportRaw[]).map((r) => ({
      id:             r.id,
      account_id:     r.account_id,
      user_id:        r.user_id,
      issue_type:     r.issue_type,
      priority:       (r.priority ?? 'normal') as SupportPriority,
      message:        r.message,
      status:         (r.status ?? 'open') as SupportStatus,
      created_at:     r.created_at,
      updated_at:     r.updated_at,
      related_pickup: r.related_pickup,
      related_bin:    r.related_bin,
      admin_notes:    r.admin_notes,
      resolved_by:    r.resolved_by,
      resolved_at:    r.resolved_at,
      business_name:  r.commercial_accounts?.business_name ?? 'Unknown Business',
    }))

    setRequests(rows.length > 0 ? rows : DEMO_REQUESTS.slice(0, 2))
    if (rows.length === 0) setIsDemo(true)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2800) }

  function openAction(req: SupportRequest, kind: ActionKind) {
    setExpandedId(req.id)
    setActionId(req.id)
    setActionKind(kind)
    setActionNotes('')
    setActionErr(null)
  }

  function closeAction() { setActionId(null); setActionKind(null); setActionNotes(''); setActionErr(null) }

  // ── Commercial notification ───────────────────────────────────────────────

  async function sendCommercialNotification(req: SupportRequest, kind: ActionKind) {
    if (!req.account_id) return   // demo row — skip
    const copy = NOTIF_COPY[kind]
    // Silently ignore errors (table might not exist, or notification insert failure)
    await supabase
      .from('commercial_notifications')
      .insert({
        account_id:   req.account_id,
        type:         `support_${kind}`,
        title:        copy.title,
        body:         copy.body,
        read:         false,
        target_route: '/dashboard/commercial/support',
        related_role: 'commercial',
        event_type:   `support_${kind}`,
      })
  }

  // ── Mark In Review ────────────────────────────────────────────────────────

  async function handleInReview(req: SupportRequest) {
    if (isDemo) {
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'in_review' } : r))
      showToast('Marked In Review')
      return
    }
    setWorking(req.id)
    const { error } = await supabase
      .from('commercial_support_requests')
      .update({ status: 'in_review', updated_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) { showToast(`Update failed: ${error.message}`); setWorking(null); return }
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'in_review' } : r))
    sendCommercialNotification(req, 'in_review')
    addNotification({ type: 'admin_alert', title: 'Support In Review', message: `${req.business_name} — ${ISSUE_LABEL[req.issue_type] ?? req.issue_type}`, priority: 'info', relatedRole: 'admin' })
    setWorking(null)
    showToast('Marked In Review')
  }

  // ── Resolve ───────────────────────────────────────────────────────────────

  async function handleResolve(req: SupportRequest) {
    const notes = actionNotes.trim()
    if (isDemo) {
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'resolved', admin_notes: notes || r.admin_notes, resolved_at: new Date().toISOString() } : r))
      closeAction()
      showToast('Resolved')
      return
    }
    setWorking(req.id)
    setActionErr(null)
    const now = new Date().toISOString()
    const patch: Record<string, string | null> = {
      status:      'resolved',
      updated_at:  now,
      resolved_by: user?.id ?? null,
      resolved_at: now,
    }
    if (notes) patch.admin_notes = notes
    const { error } = await supabase
      .from('commercial_support_requests')
      .update(patch)
      .eq('id', req.id)
    if (error) { setActionErr(`Failed: ${error.message}`); setWorking(null); return }
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...patch, admin_notes: notes || r.admin_notes } as SupportRequest : r))
    sendCommercialNotification(req, 'resolve')
    addNotification({ type: 'admin_alert', title: 'Support Resolved', message: `${req.business_name} — closed`, priority: 'info', relatedRole: 'admin' })
    setWorking(null)
    closeAction()
    showToast('Request resolved ✓')
  }

  // ── Escalate ──────────────────────────────────────────────────────────────

  async function handleEscalate(req: SupportRequest) {
    const notes = actionNotes.trim()
    if (!notes) { setActionErr('Admin notes are required when escalating.'); return }
    if (isDemo) {
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'escalated', admin_notes: notes } : r))
      closeAction()
      showToast('Escalated')
      return
    }
    setWorking(req.id)
    setActionErr(null)
    const { error } = await supabase
      .from('commercial_support_requests')
      .update({ status: 'escalated', updated_at: new Date().toISOString(), admin_notes: notes })
      .eq('id', req.id)
    if (error) { setActionErr(`Failed: ${error.message}`); setWorking(null); return }
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'escalated', admin_notes: notes } : r))
    sendCommercialNotification(req, 'escalate')
    addNotification({ type: 'admin_alert', title: 'Support Escalated', message: `${req.business_name} — needs senior review`, priority: 'warning', relatedRole: 'admin' })
    setWorking(null)
    closeAction()
    showToast('Escalated to senior review')
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const openCount = requests.filter(r => r.status === 'open').length
  const escalatedCount = requests.filter(r => r.status === 'escalated').length

  const displayed = (() => {
    if (filter === 'high_priority') return requests.filter(r => r.priority === 'high' || r.priority === 'urgent')
    if (filter === 'all') return requests
    return requests.filter(r => r.status === filter)
  })()

  const FILTER_TABS: { key: FilterMode; label: string; badge?: number }[] = [
    { key: 'all',           label: `All (${requests.length})`                                                     },
    { key: 'open',          label: `Open`,          badge: openCount                                              },
    { key: 'high_priority', label: 'High Priority', badge: requests.filter(r => r.priority === 'urgent' || r.priority === 'high').length || undefined },
    { key: 'in_review',     label: 'In Review'                                                                    },
    { key: 'escalated',     label: 'Escalated',     badge: escalatedCount || undefined                            },
    { key: 'resolved',      label: 'Resolved'                                                                     },
  ]

  const navItems: BottomNavItem[] = [
    { label: 'Overview',  icon: <span style={{ fontSize: 18 }}>🏢</span>, active: false,                                                           onClick: () => navigate('/dashboard/admin/commercial')          },
    { label: 'Pickups',   icon: <span style={{ fontSize: 18 }}>🚛</span>, active: false,                                                           onClick: () => navigate('/dashboard/admin/commercial/pickups')  },
    { label: 'Alerts',    icon: <span style={{ fontSize: 18 }}>🔔</span>, active: false,                                                           onClick: () => navigate('/dashboard/admin/commercial/alerts')   },
    { label: 'Dispatch',  icon: <span style={{ fontSize: 18 }}>🗺️</span>, active: false,                                                           onClick: () => navigate('/dashboard/admin/commercial/dispatch') },
    { label: 'Reports',   icon: <span style={{ fontSize: 18 }}>📊</span>, active: false,                                                           onClick: () => navigate('/dashboard/admin/commercial/reports')  },
    { label: 'Support',   icon: <span style={{ fontSize: 18 }}>🎧</span>, active: location.pathname === '/dashboard/admin/commercial/support',     onClick: () => navigate('/dashboard/admin/commercial/support'), badge: openCount || undefined },
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
          Support Requests
        </span>
        <NotificationBell role="admin" onClick={() => setShowNotif(true)} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-2xl mx-auto w-full">

        {/* Demo banner */}
        {isDemo && (
          <div style={{ borderRadius: 10, padding: '8px 12px', marginBottom: 14, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>
              Demo data — run the support_requests migration to enable live data.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total',     value: requests.length,                                      color: '#00c8ff' },
            { label: 'Open',      value: openCount,                                             color: '#fbbf24' },
            { label: 'Escalated', value: escalatedCount,                                        color: '#f87171' },
            { label: 'Resolved',  value: requests.filter(r => r.status === 'resolved').length,  color: '#4ade80' },
          ].map(s => (
            <GlassCard key={s.label} padding="sm" className="text-center">
              <p style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* Filter tabs — horizontally scrollable */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {FILTER_TABS.map(tab => {
            const isActive = filter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  flexShrink: 0, padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: isActive ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
                  border:     `1px solid ${isActive ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color:      isActive ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                  whiteSpace: 'nowrap', position: 'relative',
                }}
              >
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#ef4444', color: '#fff',
                    fontSize: 9, fontWeight: 800, borderRadius: 999,
                    minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  }}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner />
          </div>
        ) : loadError ? (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 28, marginBottom: 10 }}>⚠️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>Failed to load requests</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{loadError}</p>
            <button onClick={load} style={{ fontSize: 12, color: '#00c8ff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              Retry
            </button>
          </GlassCard>
        ) : displayed.length === 0 ? (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 36, marginBottom: 12 }}>🎧</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              {filter === 'all' ? 'No support requests yet' : `No ${filter.replace('_', ' ')} requests`}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              Commercial support requests will appear here.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayed.map(req => {
              const isExpanded   = expandedId === req.id
              const hasAction    = actionId === req.id
              const pColor       = PRIORITY_COLOR[req.priority]
              const badge        = STATUS_BADGE[req.status]
              const isUrgentOpen = (req.priority === 'urgent' || req.priority === 'high') && req.status === 'open'
              const isBusy       = working === req.id

              return (
                <div
                  key={req.id}
                  style={{
                    borderRadius: 16,
                    background: req.status === 'escalated' ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${req.status === 'escalated' ? 'rgba(248,113,113,0.3)' : isUrgentOpen ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    overflow: 'hidden',
                  }}
                >
                  {/* ── Card header ── */}
                  <button
                    onClick={() => { setExpandedId(isExpanded ? null : req.id); closeAction() }}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{
                        width: 38, height: 38, flexShrink: 0, borderRadius: 10,
                        background: `${pColor}12`, border: `1px solid ${pColor}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>
                        {ISSUE_ICON[req.issue_type] ?? '💬'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                            {req.business_name}
                          </p>
                          <StatusBadge variant={badge.variant} label={badge.label} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '1px 5px' }}>
                            {ISSUE_LABEL[req.issue_type] ?? req.issue_type}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: pColor, background: PRIORITY_BG[req.priority], border: `1px solid ${pColor}30`, borderRadius: 5, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {req.priority}
                          </span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                            {formatDate(req.created_at)}
                          </span>
                        </div>
                        {!isExpanded && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* ── Expanded body ── */}
                  {isExpanded && (
                    <div style={{ padding: '0 14px 14px' }}>

                      {/* Full message */}
                      <div style={{ borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', marginBottom: 10 }}>
                        <p style={{ fontSize: 13, color: '#fff', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {req.message}
                        </p>
                      </div>

                      {/* Related refs */}
                      {(req.related_pickup || req.related_bin) && (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                          {req.related_pickup && (
                            <span style={{ fontSize: 10, color: '#00c8ff', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 6, padding: '2px 8px' }}>
                              🚛 {req.related_pickup}
                            </span>
                          )}
                          {req.related_bin && (
                            <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6, padding: '2px 8px' }}>
                              🗑️ {req.related_bin}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Admin notes (read-only, from DB) */}
                      {req.admin_notes && !hasAction && (
                        <div style={{ borderRadius: 10, padding: '8px 12px', marginBottom: 10, background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.18)' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,200,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                            Admin Notes
                          </p>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>
                            {req.admin_notes}
                          </p>
                        </div>
                      )}

                      {/* Resolved timestamp */}
                      {req.resolved_at && (
                        <p style={{ fontSize: 10, color: 'rgba(74,222,128,0.6)', marginBottom: 10 }}>
                          ✓ Resolved {formatDate(req.resolved_at)}
                        </p>
                      )}

                      {/* ── Inline action panel (Resolve / Escalate) ── */}
                      {hasAction && actionKind && actionKind !== 'in_review' && (
                        <div style={{ borderRadius: 12, padding: '12px', marginBottom: 10, background: actionKind === 'resolve' ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${actionKind === 'resolve' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: actionKind === 'resolve' ? '#4ade80' : '#f87171', marginBottom: 8 }}>
                            {actionKind === 'resolve' ? '✅ Resolve Request' : '🚨 Escalate Request'}
                          </p>
                          <textarea
                            value={actionNotes}
                            onChange={e => { setActionNotes(e.target.value); if (e.target.value.trim()) setActionErr(null) }}
                            placeholder={actionKind === 'resolve'
                              ? 'Add resolution notes (optional)…'
                              : 'Explain why this is being escalated (required)…'}
                            rows={3}
                            style={NOTES_INPUT}
                          />
                          {actionErr && (
                            <p style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{actionErr}</p>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button
                              onClick={closeAction}
                              style={{ flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => actionKind === 'resolve' ? handleResolve(req) : handleEscalate(req)}
                              disabled={isBusy}
                              style={{
                                flex: 2, padding: '8px 0', borderRadius: 9, fontSize: 11, fontWeight: 800, cursor: isBusy ? 'not-allowed' : 'pointer',
                                background: actionKind === 'resolve' ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)',
                                border: `1px solid ${actionKind === 'resolve' ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
                                color: actionKind === 'resolve' ? '#4ade80' : '#f87171',
                              }}
                            >
                              {isBusy ? 'Saving…' : actionKind === 'resolve' ? 'Confirm Resolve' : 'Confirm Escalate'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Action buttons ── */}
                      {!hasAction && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                          {req.status !== 'in_review' && req.status !== 'resolved' && (
                            <button
                              onClick={() => handleInReview(req)}
                              disabled={isBusy}
                              style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                            >
                              {isBusy ? '…' : '🔍 Mark In Review'}
                            </button>
                          )}
                          {req.status !== 'resolved' && (
                            <button
                              onClick={() => openAction(req, 'resolve')}
                              disabled={isBusy}
                              style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                            >
                              ✅ Resolve
                            </button>
                          )}
                          {req.status !== 'escalated' && req.status !== 'resolved' && (
                            <button
                              onClick={() => openAction(req, 'escalate')}
                              disabled={isBusy}
                              style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                            >
                              🚨 Escalate
                            </button>
                          )}
                          {req.user_id ? (
                            <button
                              onClick={() => setMsgTarget(req)}
                              style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
                            >
                              💬 Send Message
                            </button>
                          ) : (
                            <button disabled style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' }}>
                              💬 Demo only
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav items={navItems} />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#0a1530', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 12, padding: '10px 20px', zIndex: 200, fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {showNotif && <NotificationCenter role="admin" onClose={() => setShowNotif(false)} />}

      {msgTarget && user && msgTarget.user_id && (
        <MessagePanel
          selfId={user.id}
          selfRole="admin"
          selfName={profile?.full_name ?? 'Admin'}
          partnerId={msgTarget.user_id}
          partnerName={msgTarget.business_name}
          title={`Message ${msgTarget.business_name}`}
          stopLabel={ISSUE_LABEL[msgTarget.issue_type] ?? msgTarget.issue_type}
          onClose={() => setMsgTarget(null)}
          onMessageSent={(mType: MsgType, mPriority: MsgPriority, mSubject: string) => {
            const isUrgent = mPriority === 'critical' || mPriority === 'emergency'
            addNotification({
              type:        'admin_alert',
              title:       `${MSG_PRIORITY_LABEL[mPriority]}: ${MSG_TYPE_LABEL[mType]}`,
              message:     mSubject ? `To ${msgTarget.business_name}: "${mSubject}"` : `Support reply sent to ${msgTarget.business_name}`,
              priority:    isUrgent ? (mPriority === 'emergency' ? 'critical' : 'warning') : 'info',
              relatedRole: 'admin',
            })
          }}
        />
      )}
    </div>
  )
}
