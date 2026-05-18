import { useState, useEffect, useCallback, Component } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentPickup {
  id: string
  business: string
  material: string
  status: string
  statusColor: string
  statusLabel: string
}

interface Stats {
  accounts:          number
  activePkups:       number
  overflow:          number
  delayed:           number
  contamination:     number
  invoiceIssues:     number
  pendingInspections: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  in_progress: '#00c8ff',
  assigned:    '#4ade80',
  requested:   '#fbbf24',
  scheduled:   '#4ade80',
  flagged:     '#f87171',
}
const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In Progress',
  assigned:    'Assigned',
  requested:   'Requested',
  scheduled:   'Scheduled',
  flagged:     'Flagged',
}

const ACTIVE_STATUSES = ['requested', 'assigned', 'scheduled', 'in_progress']

// ── Dispatch Map Preview ──────────────────────────────────────────────────────

class MapPreviewBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ borderRadius: 16, padding: '16px 14px', marginBottom: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', textAlign: 'center' }}>
          <p style={{ fontSize: 20, marginBottom: 6 }}>🗺️</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Commercial Dispatch Map Preview</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Live map integration coming soon.</p>
        </div>
      )
    }
    return this.props.children
  }
}

interface DispatchMapPreviewProps {
  stats:  Stats
  onOpen: () => void
}

function DispatchMapPreviewInner({ stats, onOpen }: DispatchMapPreviewProps) {
  const W = 320, H = 110
  // Simulated driver positions for visual interest (fixed layout, no real GPS)
  const driverDots = [
    { x: 60,  y: 45, color: '#00c8ff', label: 'D1' },
    { x: 160, y: 32, color: '#4ade80', label: 'D2' },
    { x: 255, y: 55, color: '#a78bfa', label: 'D3' },
    { x: 120, y: 70, color: '#fb923c', label: 'D4' },
  ]
  const warehousePos = { x: W / 2, y: H - 12 }

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: '#060e24', border: '1px solid rgba(0,200,255,0.12)', marginBottom: 16 }}>
      {/* SVG preview */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <pattern id="dpgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#dpgrid)" />

        {/* Route lines to warehouse */}
        {driverDots.map(d => (
          <line key={d.label} x1={d.x} y1={d.y} x2={warehousePos.x} y2={warehousePos.y}
            stroke={`${d.color}30`} strokeWidth={1} strokeDasharray="4 3" />
        ))}

        {/* Driver dots */}
        {driverDots.map(d => (
          <g key={d.label}>
            <circle cx={d.x} cy={d.y} r={10} fill={`${d.color}12`} stroke={`${d.color}40`} strokeWidth={1} />
            <circle cx={d.x} cy={d.y} r={5}  fill={`${d.color}50`} stroke={d.color}       strokeWidth={1.5} />
          </g>
        ))}

        {/* Overflow alerts */}
        {stats.overflow > 0 && (
          <g>
            <circle cx={200} cy={28} r={6} fill="rgba(167,139,250,0.25)" stroke="#a78bfa" strokeWidth={1.5} />
            <text x={200} y={28} textAnchor="middle" dominantBaseline="central" fill="#a78bfa" fontSize={7} fontWeight="bold">!</text>
          </g>
        )}

        {/* Delayed flag */}
        {stats.delayed > 0 && (
          <g>
            <circle cx={90} cy={72} r={6} fill="rgba(251,191,36,0.2)" stroke="#fbbf24" strokeWidth={1.5} />
            <text x={90} y={72} textAnchor="middle" dominantBaseline="central" fill="#fbbf24" fontSize={7} fontWeight="bold">!</text>
          </g>
        )}

        {/* Warehouse */}
        <polygon
          points={`${warehousePos.x},${warehousePos.y - 8} ${warehousePos.x + 6},${warehousePos.y} ${warehousePos.x},${warehousePos.y + 8} ${warehousePos.x - 6},${warehousePos.y}`}
          fill="rgba(251,191,36,0.18)" stroke="#fbbf24" strokeWidth={1.5}
        />
        <text x={warehousePos.x} y={warehousePos.y} textAnchor="middle" dominantBaseline="central" fill="#fbbf24" fontSize={5} fontWeight="bold">WH</text>

        {/* "Live" label */}
        <text x={8} y={10} fill="rgba(255,255,255,0.2)" fontSize={7} fontWeight="600">LIVE PREVIEW</text>
      </svg>

      {/* Alert pills */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#00c8ff', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 999, padding: '2px 8px' }}>
          {stats.activePkups} Pickups Active
        </span>
        {stats.overflow > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 999, padding: '2px 8px' }}>
            {stats.overflow} Overflow
          </span>
        )}
        {stats.delayed > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 999, padding: '2px 8px' }}>
            {stats.delayed} Delayed
          </span>
        )}
        {stats.contamination > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 999, padding: '2px 8px' }}>
            {stats.contamination} Flagged
          </span>
        )}
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <button
          onClick={onOpen}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 12, fontSize: 12, fontWeight: 700,
            background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff',
            cursor: 'pointer',
          }}
        >
          Open Dispatch Control →
        </button>
      </div>
    </div>
  )
}

function DispatchMapPreview(props: DispatchMapPreviewProps) {
  return (
    <MapPreviewBoundary>
      <DispatchMapPreviewInner {...props} />
    </MapPreviewBoundary>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminCommercialDashboard() {
  const navigate  = useNavigate()
  const location  = useLocation()

  const [toast,         setToast]         = useState<string | null>(null)
  const [showNotif,     setShowNotif]     = useState(false)
  const [stats,         setStats]         = useState<Stats>({ accounts: 0, activePkups: 0, overflow: 0, delayed: 0, contamination: 0, invoiceIssues: 0, pendingInspections: 0 })
  const [recentPickups, setRecentPickups] = useState<RecentPickup[]>([])
  const [syncStatus,    setSyncStatus]    = useState<'connecting' | 'active' | 'offline'>('connecting')

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    const [accountsRes, pickupsRes, inspRes, invoicesRes, pendingInspRes] = await Promise.all([
      supabase.from('commercial_accounts').select('id'),
      supabase
        .from('commercial_pickups')
        .select('id, status, pickup_type, business_name, created_at, commercial_accounts(business_name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('commercial_inspections').select('id, overall_result').eq('overall_result', 'fail'),
      supabase.from('commercial_invoices').select('id, status').eq('status', 'overdue'),
      supabase.from('commercial_inspections').select('id').in('overall_result', ['flag', 'fail']).or('review_status.is.null,review_status.eq.pending'),
    ])

    const pickups = (pickupsRes.data ?? []) as unknown as {
      id: string; status: string; pickup_type: string; business_name: string | null; created_at: string
      commercial_accounts: { business_name: string } | null
    }[]

    const activePkups  = pickups.filter(p => ACTIVE_STATUSES.includes(p.status)).length
    const overflow     = pickups.filter(p => {
      const t = (p.pickup_type ?? '').toLowerCase()
      return t.includes('overflow') || t.includes('emergency')
    }).length
    const delayed      = pickups.filter(p => p.status === 'flagged').length

    setStats({
      accounts:           (accountsRes.data ?? []).length,
      activePkups,
      overflow,
      delayed,
      contamination:      (inspRes.data ?? []).length,
      invoiceIssues:      (invoicesRes.data ?? []).length,
      pendingInspections: (pendingInspRes.data ?? []).length,
    })

    setRecentPickups(
      pickups
        .filter(p => ACTIVE_STATUSES.includes(p.status))
        .slice(0, 3)
        .map(p => ({
          id:          p.id,
          business:    (p.commercial_accounts?.business_name ?? p.business_name) ?? 'Unknown',
          material:    p.pickup_type,
          status:      p.status,
          statusColor: STATUS_COLOR[p.status] ?? '#94a3b8',
          statusLabel: STATUS_LABEL[p.status] ?? p.status,
        }))
    )
  }, [])

  useEffect(() => {
    loadStats()
    const channel = supabase
      .channel('admin-comm-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_pickups' }, () => { loadStats() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_notifications' }, () => { loadStats() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_inspections' }, () => { loadStats() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expected_warehouse_loads' }, () => { loadStats() })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [loadStats])

  // ── Toast + nav ───────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const SUMMARY_STATS = [
    { label: 'Accounts',       value: stats.accounts,     color: '#4ade80' },
    { label: 'Active Pickups', value: stats.activePkups,  color: '#00c8ff' },
    { label: 'Overflow',       value: stats.overflow,     color: '#fbbf24' },
    { label: 'Delayed Routes', value: stats.delayed,      color: '#f87171' },
    { label: 'Contamination',  value: stats.contamination,color: '#f87171' },
    { label: 'Invoice Issues', value: stats.invoiceIssues,color: '#fbbf24' },
  ]

  const navItems: BottomNavItem[] = [
    { label: 'Overview',    icon: <span style={{ fontSize: 18 }}>🏢</span>, active: location.pathname === '/dashboard/admin/commercial',             onClick: () => navigate('/dashboard/admin/commercial')             },
    { label: 'Accounts',   icon: <span style={{ fontSize: 18 }}>👥</span>, active: location.pathname === '/dashboard/admin/commercial/accounts',    onClick: () => navigate('/dashboard/admin/commercial/accounts')    },
    { label: 'Pickups',    icon: <span style={{ fontSize: 18 }}>🚛</span>, active: location.pathname === '/dashboard/admin/commercial/pickups',     onClick: () => navigate('/dashboard/admin/commercial/pickups')     },
    { label: 'Alerts',     icon: <span style={{ fontSize: 18 }}>🔔</span>, active: location.pathname === '/dashboard/admin/commercial/alerts',      onClick: () => navigate('/dashboard/admin/commercial/alerts'),     badge: (stats.delayed + stats.contamination) || undefined },
    { label: 'Inspections',icon: <span style={{ fontSize: 18 }}>🔍</span>, active: location.pathname === '/dashboard/admin/commercial/inspections', onClick: () => navigate('/dashboard/admin/commercial/inspections'), badge: stats.pendingInspections || undefined },
    { label: 'Reports',    icon: <span style={{ fontSize: 18 }}>📊</span>, active: location.pathname === '/dashboard/admin/commercial/reports',     onClick: () => navigate('/dashboard/admin/commercial/reports')     },
    { label: 'Dispatch',   icon: <span style={{ fontSize: 18 }}>🗺️</span>, active: location.pathname === '/dashboard/admin/commercial/dispatch',    onClick: () => navigate('/dashboard/admin/commercial/dispatch')    },
    { label: 'Support',    icon: <span style={{ fontSize: 18 }}>🎧</span>, active: location.pathname === '/dashboard/admin/commercial/support',     onClick: () => navigate('/dashboard/admin/commercial/support')     },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate('/dashboard/admin')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Admin
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Commercial Ops
        </span>
        <NotificationBell role="admin" onClick={() => setShowNotif(true)} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-2xl mx-auto w-full">

        {/* ── Sync ── */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 12 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {SUMMARY_STATS.map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4, lineHeight: 1.3 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Quick nav ── */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: 'Manage Accounts',    icon: '👥', color: '#4ade80', path: '/dashboard/admin/commercial/accounts',    badge: undefined },
            { label: 'All Pickups',        icon: '🚛', color: '#00c8ff', path: '/dashboard/admin/commercial/pickups',     badge: undefined },
            { label: 'Active Alerts',      icon: '🔔', color: '#f87171', path: '/dashboard/admin/commercial/alerts',      badge: stats.delayed + stats.contamination > 0 ? String(stats.delayed + stats.contamination) : undefined },
            { label: 'Inspection Review',  icon: '🔍', color: '#a78bfa', path: '/dashboard/admin/commercial/inspections', badge: stats.pendingInspections > 0 ? String(stats.pendingInspections) : undefined },
            { label: 'Reports',            icon: '📊', color: '#fbbf24', path: '/dashboard/admin/commercial/reports',     badge: undefined },
            { label: 'Dispatch Control',   icon: '🗺️', color: '#00c8ff', path: '/dashboard/admin/commercial/dispatch',    badge: undefined },
            { label: 'Support Requests',   icon: '🎧', color: '#a78bfa', path: '/dashboard/admin/commercial/support',     badge: undefined },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="rounded-2xl px-4 py-4 text-left transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                {a.badge && (
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(248,113,113,0.2)', color: '#f87171' }}>
                    {a.badge}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{a.label}</p>
            </button>
          ))}
        </div>

        {/* ── Commercial Dispatch Map ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Commercial Dispatch Map
        </p>
        <DispatchMapPreview stats={stats} onOpen={() => navigate('/dashboard/admin/commercial/dispatch')} />

        {/* ── Active Pickups mini ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Active Commercial Pickups
        </p>
        <GlassCard padding="md" className="mb-4">
          {recentPickups.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
              No active pickups
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentPickups.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.business}
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{p.material}</p>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${p.statusColor}22`, color: p.statusColor }}>
                    {p.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate('/dashboard/admin/commercial/pickups')}
            style={{ marginTop: 12, fontSize: 11, color: '#00c8ff', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            View all pickups →
          </button>
        </GlassCard>

        {/* ── Featured account (demo) ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Featured Account
        </p>
        <GlassCard variant="accent" padding="lg" glow className="mb-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Greenway Office Plaza</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Enterprise Weekly · NASH-01</p>
            </div>
            <StatusBadge variant="green" label="On Track" dot />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
            {[
              { label: 'Pickup Days',   value: 'Mon / Wed / Fri' },
              { label: 'Monthly Rev.',  value: '$1,840'          },
              { label: 'Contamination', value: '2.0%'            },
              { label: 'SLA Status',    value: 'On Track'        },
            ].map(row => (
              <div key={row.label}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{row.label}</p>
                <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 1 }}>{row.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PrimaryButton size="sm" fullWidth onClick={() => navigate('/dashboard/admin/commercial/accounts')}>
              👁 View Account
            </PrimaryButton>
            <PrimaryButton size="sm" fullWidth onClick={() => navigate('/dashboard/admin/commercial/pickups')}>
              🚛 Pickups
            </PrimaryButton>
            <PrimaryButton size="sm" fullWidth variant="secondary" onClick={() => showToast('Alert sent')}>
              📢 Send Alert
            </PrimaryButton>
            <PrimaryButton size="sm" fullWidth variant="secondary" onClick={() => showToast('Escalated to supervisor')}>
              ⬆️ Escalate
            </PrimaryButton>
          </div>
        </GlassCard>

        {/* ── SLA Performance (demo) ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          SLA / Contract Performance
        </p>
        <GlassCard padding="md" className="mb-2">
          {[
            { label: 'On-Time Pickup Rate', pct: 94, color: '#4ade80' },
            { label: 'SLA Compliance',      pct: 91, color: '#00c8ff' },
            { label: 'Avg Contamination',   pct: 24, color: '#fbbf24', inverted: true },
          ].map(row => (
            <div key={row.label} className="mb-3 last:mb-0">
              <div className="flex justify-between mb-1">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{row.label}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: row.color }}>
                  {row.inverted ? `${(row.pct / 10).toFixed(1)}%` : `${row.pct}%`}
                </p>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, borderRadius: 999, boxShadow: `0 0 7px ${row.color}80` }} />
              </div>
            </div>
          ))}
        </GlassCard>
      </div>

      <BottomNav items={navItems} />

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
      {showNotif && <NotificationCenter role="admin" onClose={() => setShowNotif(false)} />}
    </div>
  )
}
