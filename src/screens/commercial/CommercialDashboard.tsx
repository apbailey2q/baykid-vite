import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { NotificationPriority } from '../../store/notificationStore'
import { CommercialLayout } from './CommercialLayout'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PickupItem {
  id: string
  status: string
  pickup_type: string
  material_type: string
  bin_count: number
  preferred_window: string | null
  driver_id: string | null
  created_at: string
}

interface InvoiceItem {
  id: string
  amount: number
  status: string
  due_date: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PICKUP_BADGE: Record<string, { variant: 'cyan' | 'amber' | 'green' | 'red' | 'yellow' | 'gray'; label: string }> = {
  requested:   { variant: 'yellow', label: 'Requested'       },
  assigned:    { variant: 'cyan',   label: 'Driver Assigned' },
  scheduled:   { variant: 'cyan',   label: 'Scheduled'       },
  in_progress: { variant: 'amber',  label: 'In Progress'     },
  flagged:     { variant: 'red',    label: 'Flagged'         },
  completed:   { variant: 'green',  label: 'Completed'       },
  cancelled:   { variant: 'gray',   label: 'Cancelled'       },
}

const INV_BADGE: Record<string, { variant: 'amber' | 'red' | 'green'; label: string }> = {
  pending: { variant: 'amber', label: 'Due Soon' },
  overdue: { variant: 'red',   label: 'Overdue'  },
  paid:    { variant: 'green', label: 'Paid'     },
}

const CONTAINER_STATS = [
  { label: 'Total',     value: '—', color: '#00c8ff' },
  { label: 'Near Full', value: '—', color: '#fbbf24' },
  { label: 'Flagged',   value: '—', color: '#f87171' },
]

const SUSTAINABILITY = [
  { label: 'Monthly Weight',     value: '—',  unit: 'lbs',  color: '#00c8ff' },
  { label: 'CO₂ Saved',         value: '—',  unit: 'tons', color: '#4ade80' },
  { label: 'Diversion Rate',    value: '—',  unit: '%',    color: '#a78bfa' },
  { label: 'Contamination Rate',value: '—',  unit: '%',    color: '#fbbf24' },
]

const QUICK_ACTIONS = [
  { icon: '🚛', label: 'Request\nPickup',      path: '/dashboard/commercial/pickup'                 },
  { icon: '🚨', label: 'Emergency\nOverflow',  path: '/dashboard/commercial/pickup?type=emergency'  },
  { icon: '🗑️', label: 'Manage\nContainers',  path: '/dashboard/commercial/bins'                   },
  { icon: '📊', label: 'View\nReports',        path: '/dashboard/commercial/reports'                },
  { icon: '🌿', label: 'My\nImpact',           path: '/commercial/impact'                           },
  { icon: '🧾', label: 'Pay\nInvoice',          path: '/dashboard/commercial/invoices'               },
  { icon: '📞', label: 'Contact\nDispatch',     path: ''                                             },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
    }}>
      {children}
    </p>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function mapNotifPriority(type: string): NotificationPriority {
  if (type === 'support_escalate') return 'warning'
  if (type === 'support_resolve')  return 'success'
  return 'info'
}

function relativeTime(iso: string): string {
  const min = (Date.now() - new Date(iso).getTime()) / 60000
  if (min < 1)    return 'Just now'
  if (min < 60)   return `${Math.floor(min)}m ago`
  if (min < 1440) return `${Math.floor(min / 60)}h ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function CommercialDashboard() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const { upsertNotification } = useNotificationStore()

  const [showNotif,      setShowNotif]      = useState(false)
  const [activePickups,  setActivePickups]  = useState<PickupItem[]>([])
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceItem | null>(null)
  const [syncStatus,     setSyncStatus]     = useState<'connecting' | 'active' | 'offline'>('connecting')

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    if (!user) return
    const { data: account } = await supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!account) return

    const [pickupsRes, invoicesRes, notifsRes] = await Promise.all([
      supabase
        .from('commercial_pickups')
        .select('id, status, pickup_type, material_type, bin_count, preferred_window, driver_id, created_at')
        .eq('account_id', account.id)
        .in('status', ['requested', 'assigned', 'scheduled', 'in_progress', 'flagged'])
        .order('created_at', { ascending: false }),
      supabase
        .from('commercial_invoices')
        .select('id, amount, status, due_date')
        .eq('account_id', account.id)
        .neq('status', 'paid')
        .order('due_date', { ascending: true })
        .limit(1),
      supabase
        .from('commercial_notifications')
        .select('id, type, title, body, read, created_at, target_route, target_id')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setActivePickups((pickupsRes.data ?? []) as PickupItem[])
    setCurrentInvoice((invoicesRes.data?.[0] ?? null) as InvoiceItem | null)

    // Push DB notifications into the in-memory store (upsert = no duplicates on re-load)
    if (!notifsRes.error && notifsRes.data) {
      for (const row of notifsRes.data as { id: string; type: string; title: string; body: string; read: boolean; created_at: string; target_route?: string | null; target_id?: string | null }[]) {
        upsertNotification({
          id:           row.id,
          type:         'admin_alert',
          title:        row.title,
          message:      row.body,
          priority:     mapNotifPriority(row.type),
          relatedRole:  'commercial',
          timestamp:    relativeTime(row.created_at),
          read:         row.read,
          target_route: row.target_route ?? undefined,
          target_id:    row.target_id    ?? undefined,
        })
      }
    }
  }, [user, upsertNotification])

  useEffect(() => {
    loadDashboard()
    if (!user) return
    const channel = supabase
      .channel(`comm-dash-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_pickups' }, () => { loadDashboard() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_invoices' }, () => { loadDashboard() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_notifications' }, () => { loadDashboard() })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [loadDashboard])

  // ── Derived ───────────────────────────────────────────────────────────────

  const invBadge    = currentInvoice ? (INV_BADGE[currentInvoice.status] ?? INV_BADGE.pending) : null
  const balanceAmt  = currentInvoice?.amount ?? 0
  const balanceColor = currentInvoice ? '#f87171' : '#4ade80'

  return (
    <>
    <CommercialLayout rightContent={<NotificationBell role="commercial" onClick={() => setShowNotif(true)} />}>
      <div className="px-4 pt-3 max-w-xl mx-auto w-full">

        {/* ── 1. Header ── */}
        <div className="mb-4">
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
            Commercial Dashboard
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
            Business recycling operations
          </p>
          <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', marginTop: 3 }}>
            {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
          </p>
        </div>

        {/* ── 2. Quick Actions ── */}
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              onClick={() => a.path && navigate(a.path)}
              className="rounded-2xl py-4 flex flex-col items-center gap-2 transition-all hover:brightness-110 active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                cursor: a.path ? 'pointer' : 'default',
              }}
            >
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
                textAlign: 'center', lineHeight: 1.4, whiteSpace: 'pre-line',
              }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>

        {/* ── 3. Active Pickups ── */}
        <SectionLabel>Active Pickups</SectionLabel>

        {activePickups.length === 0 ? (
          <GlassCard padding="lg" className="text-center mb-5">
            <p style={{ fontSize: 28, marginBottom: 8 }}>✅</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              No active pickups
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              Request a pickup to get started
            </p>
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3 mb-5">
            {activePickups.map(p => {
              const badge = PICKUP_BADGE[p.status] ?? { variant: 'gray' as const, label: p.status }
              return (
                <GlassCard key={p.id} padding="md">
                  <div className="flex items-start justify-between mb-2">
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1, marginRight: 8 }}>
                      {p.pickup_type} — {p.material_type}
                    </p>
                    <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                  </div>

                  {p.preferred_window && (
                    <p style={{ fontSize: 12, color: '#00c8ff', fontWeight: 600, marginBottom: 8 }}>
                      🕐 {p.preferred_window}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Driver',      value: p.driver_id ? 'Assigned' : 'Pending' },
                      { label: 'Containers',  value: String(p.bin_count) },
                      { label: 'Est. Weight', value: `~${(p.bin_count * 150).toLocaleString()} lbs` },
                    ].map(row => (
                      <div key={row.label}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          {row.label}
                        </p>
                        <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                          {row.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )
            })}
          </div>
        )}

        {/* ── 4. Container Status (demo) ── */}
        <SectionLabel>Container Status</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {CONTAINER_STATS.map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── 5. Sustainability Metrics (demo) ── */}
        <SectionLabel>Sustainability Metrics</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {SUSTAINABILITY.map(s => (
            <GlassCard key={s.label} padding="md">
              <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                {s.value}
                {s.unit && <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 2 }}>{s.unit}</span>}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 5 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── 6. Compliance & Contracts quick-links ── */}
        <SectionLabel>Compliance & Agreements</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button
            onClick={() => navigate('/commercial/documents')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <GlassCard padding="md">
              <p style={{ fontSize: 24, margin: '0 0 4px' }}>📄</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>Documents</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Compliance &amp; Permits</p>
            </GlassCard>
          </button>
          <button
            onClick={() => navigate('/commercial/contracts')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <GlassCard padding="md">
              <p style={{ fontSize: 24, margin: '0 0 4px' }}>📋</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>Contract</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Service Agreement</p>
            </GlassCard>
          </button>
        </div>

        {/* ── 7. Invoice Summary ── */}
        <SectionLabel>Invoice Summary</SectionLabel>
        <GlassCard variant="elevated" padding="md" className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Current Balance
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, color: balanceColor, lineHeight: 1.1, marginTop: 3 }}>
                {formatAmount(balanceAmt)}
              </p>
              {currentInvoice && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  Due {formatDate(currentInvoice.due_date)}
                </p>
              )}
            </div>
            {invBadge
              ? <StatusBadge variant={invBadge.variant} label={invBadge.label} dot />
              : <StatusBadge variant="green" label="Paid Up" dot />
            }
          </div>
          <PrimaryButton
            fullWidth
            size="md"
            onClick={() => navigate('/dashboard/commercial/invoices')}
          >
            View Invoices
          </PrimaryButton>
        </GlassCard>

      </div>
    </CommercialLayout>
    {showNotif && <NotificationCenter role="commercial" onClose={() => setShowNotif(false)} />}
    </>
  )
}
